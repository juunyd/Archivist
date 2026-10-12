"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Shared index/scroll/keyboard logic for both the in-page gallery and the
 * full-screen lightbox — a native CSS scroll-snap track driven by a ref, with
 * no swipe library: the browser already does the swipe/scroll, this just
 * derives which slide is current and exposes goTo/next/prev that scroll
 * programmatically (for dots, arrows, thumbnails and arrow keys).
 */
export function useGalleryCarousel(count: number, initialIndex = 0, enableKeyboard = true) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndexState] = useState(initialIndex);
  const indexRef = useRef(initialIndex);

  const setCurrentIndex = useCallback((index: number) => {
    indexRef.current = index;
    setCurrentIndexState(index);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(count - 1, index));
      const slide = track.children[clamped] as HTMLElement | undefined;
      if (!slide) return;
      track.scrollTo({ left: slide.offsetLeft, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      setCurrentIndex(clamped);
    },
    [count, setCurrentIndex],
  );

  const goTo = scrollToIndex;
  const next = useCallback(() => scrollToIndex(indexRef.current + 1), [scrollToIndex]);
  const prev = useCallback(() => scrollToIndex(indexRef.current - 1), [scrollToIndex]);

  // Derives the current slide from native scroll position — covers touch
  // swipe and trackpad scroll, not just the programmatic calls above.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = trackRef.current;
        if (!el) return;
        let nearest = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < el.children.length; i++) {
          const child = el.children[i] as HTMLElement;
          const dist = Math.abs(child.offsetLeft - el.scrollLeft);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = i;
          }
        }
        if (nearest !== indexRef.current) setCurrentIndex(nearest);
      });
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [setCurrentIndex]);

  useEffect(() => {
    if (!enableKeyboard) return;
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableKeyboard, next, prev]);

  return { trackRef, currentIndex, goTo, next, prev };
}
