"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useGalleryCarousel } from "./useGalleryCarousel";
import { GuideLightbox } from "./GuideLightbox";
import styles from "../app/[slug]/page.module.css";

export interface GuideGalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

interface GuideGalleryProps {
  images: GuideGalleryImage[];
  /** Applied to the outer wrapper — the current guide page's `.heroMedia`. */
  wrapperClassName: string;
  /** Applied to every slide's <img> — the current guide page's `.cover`, so sizing/aspect-ratio/border stay identical to today. */
  imageClassName: string;
  /**
   * Lets the admin editor overlay its click-to-replace-cover control on slide
   * 0 instead of a plain image — the gallery otherwise has no idea the admin
   * page exists. Ignored for the public page.
   */
  renderCoverSlot?: (defaultImage: ReactNode) => ReactNode;
}

/**
 * The guide page's hero image area. With a single image (the common case
 * today: every guide that has no preview pages uploaded) this renders the
 * exact same markup the hero always has — no dots, nothing new in the DOM.
 * With more than one image it becomes a one-at-a-time swipeable/clickable
 * gallery: one image fills the whole area (no peeking neighbor), small dots
 * below it, swipe on touch and arrow keys from the keyboard, tap/click opens
 * the full-screen lightbox.
 */
export function GuideGallery({ images, wrapperClassName, imageClassName, renderCoverSlot }: GuideGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { trackRef, currentIndex, goTo } = useGalleryCarousel(images.length, 0, lightboxIndex === null);

  if (images.length <= 1) {
    const image = images[0];
    const defaultImg = <Image src={image.src} alt={image.alt} width={900} height={1200} className={imageClassName} priority />;
    return <div className={wrapperClassName}>{renderCoverSlot ? renderCoverSlot(defaultImg) : defaultImg}</div>;
  }

  return (
    <div className={wrapperClassName}>
      <div className={styles.galleryInner}>
        <div
          className={styles.galleryTrack}
          ref={trackRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="Guide image gallery"
        >
          {images.map((image, index) => {
            const loadProps = index === 0 ? { priority: true as const } : { loading: "lazy" as const };
            const defaultImg = (
              <button
                type="button"
                className={styles.gallerySlideButton}
                onClick={() => setLightboxIndex(index)}
                aria-label={`${image.alt} — open full screen`}
              >
                <Image src={image.src} alt={image.alt} width={900} height={1200} className={imageClassName} {...loadProps} />
              </button>
            );
            return (
              <div key={image.src} className={styles.gallerySlide} aria-roledescription="slide" aria-label={image.alt}>
                {index === 0 && renderCoverSlot ? renderCoverSlot(defaultImg) : defaultImg}
              </div>
            );
          })}
        </div>

        <div className={styles.galleryDots} role="tablist" aria-label="Choose image">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Go to image ${index + 1} of ${images.length}`}
              className={`${styles.galleryDot}${index === currentIndex ? ` ${styles.galleryDotActive}` : ""}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      </div>

      {lightboxIndex !== null && (
        <GuideLightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
