"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useGalleryCarousel } from "./useGalleryCarousel";
import type { GuideGalleryImage } from "./GuideGallery";
import styles from "./GuideLightbox.module.css";

interface GuideLightboxProps {
  images: GuideGalleryImage[];
  startIndex: number;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function touchDistance(touches: TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Full-screen image viewer: close button, swipe/arrows/keyboard between
 * images (shared with the in-page gallery via useGalleryCarousel), and
 * pinch/double-tap zoom with panning while zoomed — all hand-rolled touch
 * handling, no new dependency.
 */
export function GuideLightbox({ images, startIndex, onClose }: GuideLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const { trackRef, currentIndex, goTo, next, prev } = useGalleryCarousel(images.length, startIndex, true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const pinchState = useRef<{ startDist: number; startZoom: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  // Mount/focus/scroll-lock lifecycle, and jump to the opening slide without
  // an animation (it should appear already there, not visibly scroll to it).
  useEffect(() => {
    setMounted(true);
    previouslyFocused.current = document.activeElement;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const track = trackRef.current;
    if (track) {
      const slide = track.children[startIndex] as HTMLElement | undefined;
      if (slide) track.scrollLeft = slide.offsetLeft;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // A new slide always starts unzoomed.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  function toggleZoom() {
    setZoom(zoomRef.current > 1 ? 1 : DOUBLE_TAP_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  // Registered as real (non-passive) native listeners — React's JSX touch
  // handlers are passive by default and can't reliably preventDefault, which
  // this needs in order to take over panning from the track's native swipe
  // scroll once zoomed in.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        pinchState.current = { startDist: touchDistance(e.touches), startZoom: zoomRef.current };
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (zoomRef.current > 1) {
          panState.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            originX: panRef.current.x,
            originY: panRef.current.y,
          };
        }
        const now = Date.now();
        if (
          lastTap.current &&
          now - lastTap.current.time < DOUBLE_TAP_MS &&
          Math.hypot(touch.clientX - lastTap.current.x, touch.clientY - lastTap.current.y) < DOUBLE_TAP_SLOP
        ) {
          toggleZoom();
          lastTap.current = null;
        } else {
          lastTap.current = { time: now, x: touch.clientX, y: touch.clientY };
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchState.current) {
        e.preventDefault();
        const ratio = touchDistance(e.touches) / pinchState.current.startDist;
        setZoom(clamp(pinchState.current.startZoom * ratio, MIN_ZOOM, MAX_ZOOM));
      } else if (e.touches.length === 1 && panState.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - panState.current.startX;
        const dy = e.touches[0].clientY - panState.current.startY;
        setPan({ x: panState.current.originX + dx, y: panState.current.originY + dy });
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchState.current = null;
      if (e.touches.length === 0) panState.current = null;
    }

    track.addEventListener("touchstart", onTouchStart, { passive: false });
    track.addEventListener("touchmove", onTouchMove, { passive: false });
    track.addEventListener("touchend", onTouchEnd, { passive: false });
    track.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchmove", onTouchMove);
      track.removeEventListener("touchend", onTouchEnd);
      track.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackRef]);

  if (!mounted) return null;

  const activeImage = images[currentIndex];

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${activeImage.alt} — full screen viewer`}>
      <button type="button" ref={closeButtonRef} className={styles.close} onClick={onClose} aria-label="Close">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>

      <div className={styles.track} ref={trackRef}>
        {images.map((image, index) => (
          <div key={image.src} className={styles.slide}>
            <div
              className={styles.imageWrap}
              style={index === currentIndex ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` } : undefined}
              onDoubleClick={toggleZoom}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="100vw"
                className={styles.image}
                priority={index === startIndex}
              />
            </div>
            {image.caption && <p className={styles.caption}>{image.caption}</p>}
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={prev}
            disabled={currentIndex === 0}
            aria-label="Previous image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={next}
            disabled={currentIndex === images.length - 1}
            aria-label="Next image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className={styles.dots} role="tablist" aria-label="Choose image">
            {images.map((image, index) => (
              <button
                key={image.src}
                type="button"
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Go to image ${index + 1} of ${images.length}`}
                className={`${styles.dot}${index === currentIndex ? ` ${styles.dotActive}` : ""}`}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
