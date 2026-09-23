"use client";

import { useEffect, useRef, useState } from "react";
import type { Guide } from "@/lib/guides";
import { CtaButton } from "./CtaButton";

interface StickyBuyBarProps {
  guide: Pick<Guide, "slug" | "title" | "price">;
  sentinelId: string;
}

export function StickyBuyBar({ guide, sentinelId }: StickyBuyBarProps) {
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
      <span className="sticky-buy-bar__price">&#8377;{guide.price}</span>
      <CtaButton guide={guide} label="Get Instant Access" size="compact" className="sticky-buy-bar__cta" />
    </div>
  );
}
