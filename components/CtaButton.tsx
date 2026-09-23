"use client";

import { useEffect, useRef, useState } from "react";
import type { Guide } from "@/lib/guides";
import { startCheckout, type CheckoutPhase } from "@/lib/checkout";

interface CtaButtonProps {
  guide: Pick<Guide, "slug" | "title" | "price">;
  label?: string;
  size?: "default" | "compact";
  /** Match however the surrounding section aligns its button. */
  align?: "start" | "center";
  className?: string;
}

const BUSY_LABEL: Partial<Record<CheckoutPhase, string>> = {
  creating: "Opening checkout…",
  open: "Checkout open…",
  verifying: "Confirming payment…",
  redirecting: "Confirming payment…",
};

// Matches the validator the Edge Function uses, so the buyer is told about a
// typo here rather than after a round trip.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/**
 * Buy button with a one-field email step in front of it.
 *
 * The address is captured before Razorpay opens for two reasons: it prefills
 * Checkout, and it is stored on the order straight away, so a payment that
 * comes back without an email can still be delivered. No account, no password,
 * no second screen — the form replaces the button in place.
 */
export function CtaButton({
  guide,
  label,
  size = "default",
  align = "start",
  className,
}: CtaButtonProps) {
  const [collecting, setCollecting] = useState(false);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";

  useEffect(() => {
    if (collecting) inputRef.current?.focus();
  }, [collecting]);

  const openForm = () => {
    setError(null);
    setCollecting(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError("Enter a valid email address so we can send your guide.");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    void startCheckout(guide.slug, {
      email: value,
      onPhase: setPhase,
      onError: setError,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // Escape backs out of the form without losing the page position.
    if (event.key === "Escape" && !busy) {
      setCollecting(false);
      setError(null);
    }
  };

  const wrapClass = "cta-button__wrap";
  const formClass = [
    "checkout-email",
    align === "center" ? "checkout-email--center" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const buttonClass = [
    "cta-button",
    size === "compact" ? "cta-button--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!collecting) {
    return (
      <div className={wrapClass}>
        <button type="button" onClick={openForm} className={buttonClass}>
          <span>{label ?? `Get Instant Access - ₹${guide.price}`}</span>
          <span className="cta-button__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <form className={formClass} onSubmit={submit} onKeyDown={onKeyDown}>
        <label className="visually-hidden" htmlFor={`buy-email-${guide.slug}`}>
          Email address
        </label>
        <input
          ref={inputRef}
          id={`buy-email-${guide.slug}`}
          className="checkout-email__input"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          required
        />
        <button type="submit" className={buttonClass} disabled={busy} aria-busy={busy}>
          <span>{busy ? BUSY_LABEL[phase] : `Continue to payment - ₹${guide.price}`}</span>
          {!busy && (
            <span className="cta-button__arrow" aria-hidden="true">
              →
            </span>
          )}
        </button>
        <p className="checkout-email__note">
          We&apos;ll email <strong>{guide.title}</strong> here the moment your
          payment clears.
        </p>
      </form>
      {error && (
        <p className="cta-button__error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
