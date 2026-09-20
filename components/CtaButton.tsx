"use client";

import type { Book } from "@/lib/books";
import { startCheckout } from "@/lib/checkout";

interface CtaButtonProps {
  book: Pick<Book, "slug" | "title" | "price">;
  label?: string;
  size?: "default" | "compact";
  className?: string;
}

export function CtaButton({
  book,
  label,
  size = "default",
  className,
}: CtaButtonProps) {
  const text = label ?? `Get Instant Access - ₹${book.price}`;

  return (
    <button
      type="button"
      onClick={() => startCheckout(book)}
      className={["cta-button", size === "compact" ? "cta-button--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{text}</span>
      <span className="cta-button__arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
