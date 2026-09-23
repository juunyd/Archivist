"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { getJson } from "@/lib/api";

interface OrderStatusResponse {
  status: "created" | "paid" | "failed" | "refunded";
  maskedEmail: string | null;
  bookTitle: string | null;
  /** Present once the order is paid: the same link that goes out by email. */
  downloadUrl: string | null;
}

type View = "loading" | "paid" | "pending" | "failed" | "not_found" | "error";

// The webhook can land after the browser does, so a 'created' order is not yet
// bad news — poll for a while before saying anything discouraging.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 30000;

export function ThankYouContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");

  const [view, setView] = useState<View>("loading");
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const data = await getJson<OrderStatusResponse>("/api/order-status", {
          order_id: orderId,
        });
        if (cancelled) return;

        setOrder(data);

        if (data.status === "paid" || data.status === "refunded") {
          setView("paid");
          return;
        }
        if (data.status === "failed") {
          setView("failed");
          return;
        }

        // Still 'created'.
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setView("pending");
          return;
        }
        setView("pending");
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        const code = (error as { code?: string }).code;
        setView(code === "order_not_found" ? "not_found" : "error");
      }
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  if (!orderId) {
    return (
      <>
        <p className="thank-you__body">
          We couldn&apos;t find an order reference in this link. If you just
          completed checkout, check your email — your download link is sent
          there directly.
        </p>
        <Link href="/" className="thank-you__link">
          Back to Archivist
        </Link>
      </>
    );
  }

  const support = (
    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
  );

  return (
    <>
      <p className="thank-you__order">
        Order <strong>{orderId}</strong>
      </p>

      {view === "loading" && (
        <p className="thank-you__body">Checking your order&hellip;</p>
      )}

      {view === "paid" && (
        <>
          <p className="thank-you__body">
            Payment confirmed
            {order?.bookTitle ? <> for <strong>{order.bookTitle}</strong></> : null}.
            Your download link is on its way
            {order?.maskedEmail ? <> to {order.maskedEmail}</> : null}, and you
            can go straight to it here. The link keeps working, so you can
            download the book again whenever you need it.
          </p>
          {order?.downloadUrl && (
            <p className="thank-you__cta-row">
              <a className="cta-button thank-you__cta" href={order.downloadUrl}>
                <span>Download your book</span>
                <span className="cta-button__arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </p>
          )}
          <p className="thank-you__body">
            If the email hasn&apos;t arrived in a few minutes, check your spam
            folder or write to {support}.
          </p>
        </>
      )}

      {view === "pending" && (
        <p className="thank-you__body">
          Your payment is being confirmed. This usually takes a few seconds —
          you can safely leave this page, and the download link will be emailed
          to you as soon as it clears. If nothing arrives within an hour, write
          to {support}.
        </p>
      )}

      {view === "failed" && (
        <p className="thank-you__body">
          This payment did not go through, so you have not been charged. You can
          try again from the book&apos;s page, or write to {support} if you
          think this is wrong.
        </p>
      )}

      {view === "not_found" && (
        <p className="thank-you__body">
          We couldn&apos;t find that order. If you were charged, forward your
          payment receipt to {support} and we will sort it out.
        </p>
      )}

      {view === "error" && (
        <p className="thank-you__body">
          We couldn&apos;t check this order just now. Your payment is
          unaffected — if you were charged, the download link will still be
          emailed to you. Questions: {support}.
        </p>
      )}

      <Link href="/" className="thank-you__link">
        Back to Archivist
      </Link>
    </>
  );
}
