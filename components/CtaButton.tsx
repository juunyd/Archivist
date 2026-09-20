"use client";

import { useState } from "react";
import type { Book } from "@/lib/books";
import { startCheckout, type CheckoutPhase } from "@/lib/checkout";

interface CtaButtonProps {
  book: Pick<Book, "slug" | "title" | "price">;
  label?: string;
  size?: "default" | "compact";
  className?: string;
}

const BUSY_LABEL: Partial<Record<CheckoutPhase, string>> = {
  creating: "Opening checkout…",
  open: "Checkout open…",
  verifying: "Confirming payment…",
  redirecting: "Confirming payment…",
};

export function CtaButton({
  book,
  label,
  size = "default",
  className,
}: CtaButtonProps) {
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";
  const text = busy ? BUSY_LABEL[phase] : (label ?? `Get Instant Access - ₹${book.price}`);

  const onClick = () => {
    if (busy) return; // The library guards this too; this keeps the UI honest.
    setError(null);
    void startCheckout(book.slug, { onPhase: setPhase, onError: setError });
  };

  return (
    <div className="cta-button__wrap">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
        className={["cta-button", size === "compact" ? "cta-button--compact" : "", className]
          .filter(Boolean)
          .join(" ")}
      >
        <span>{text}</span>
        {!busy && (
          <span className="cta-button__arrow" aria-hidden="true">
            →
          </span>
        )}
      </button>
      {error && (
        <p className="cta-button__error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
