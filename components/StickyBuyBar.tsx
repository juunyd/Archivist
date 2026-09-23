"use client";

import { useEffect, useRef, useState } from "react";
import type { Book } from "@/lib/books";
import { CtaButton } from "./CtaButton";

interface StickyBuyBarProps {
  book: Pick<Book, "slug" | "title" | "price">;
  sentinelId: string;
}

export function StickyBuyBar({ book, sentinelId }: StickyBuyBarProps) {
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) return;

    const apply = () => {
      setVisible(sentinel.getBoundingClientRect().top < 0);
    };

    window.addEventListener("scroll", apply, { passive: true, capture: true });
    window.addEventListener("resize", apply, { passive: true });
    apply();

    return () => {
      window.removeEventListener("scroll", apply, { capture: true });
      window.removeEventListener("resize", apply);
    };
  }, [sentinelId]);

  return (
    <div
      ref={barRef}
      className="sticky-buy-bar"
      style={{ transform: visible ? "translateY(0)" : "translateY(130%)" }}
      aria-hidden={!visible}
    >
      <span className="sticky-buy-bar__price">&#8377;{book.price}</span>
      <CtaButton book={book} label="Get Instant Access" size="compact" className="sticky-buy-bar__cta" />
    </div>
  );
}
