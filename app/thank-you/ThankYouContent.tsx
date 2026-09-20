"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

type OrderStatus = "idle" | "loading" | "paid" | "pending" | "not_found" | "error";

export function ThankYouContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<OrderStatus>("idle");

  useEffect(() => {
    if (!orderId) return;

    setStatus("loading");

    // PLACEHOLDER: once the Supabase Edge Function exists, replace this
    // block with a real fetch, e.g.:
    //
    //   const res = await fetch(
    //     `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/order-status?order_id=${orderId}`,
    //     { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
    //   );
    //   const data = await res.json();
    //   setStatus(data.status);
    //
    // This static page never talks to a database directly — it only ever
    // calls a public Supabase Edge Function endpoint, client-side.
    const timeout = setTimeout(() => setStatus("pending"), 400);
    return () => clearTimeout(timeout);
  }, [orderId]);

  if (!orderId) {
    return (
      <>
        <p className="thank-you__body">
          We couldn&apos;t find an order reference in this link. If you just
          completed checkout, check your email — your receipt and download
          links are sent there directly.
        </p>
        <Link href="/" className="thank-you__link">
          Back to Archivist
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="thank-you__order">
        Order <strong>{orderId}</strong>
      </p>
      {status === "loading" || status === "idle" ? (
        <p className="thank-you__body">Checking your order status&hellip;</p>
      ) : status === "paid" ? (
        <p className="thank-you__body">
          Payment confirmed. Your download links have been emailed to you.
        </p>
      ) : status === "pending" ? (
        <p className="thank-you__body">
          Order status checking isn&apos;t wired up yet — this is a
          placeholder response. Once payments are live, this page will call a
          Supabase Edge Function to confirm your order and show real status
          here.
        </p>
      ) : (
        <p className="thank-you__body">
          We couldn&apos;t confirm this order. If you were charged, contact{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      )}
      <Link href="/" className="thank-you__link">
        Back to Archivist
      </Link>
    </>
  );
}
