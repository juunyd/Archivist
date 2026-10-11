"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import { CopyableText } from "../CopyableText";
import { CloseIcon } from "../icons";

interface OrderDetail {
  id: string;
  guideTitle: string;
  guideSlug: string;
  amountPaise: number;
  currency: string;
  status: string;
  email: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  downloadCount: number;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  emailSentAt: string | null;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTimeIST(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export function OrderDetailPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOrder(null);
    setError(null);
    getJson<{ order: OrderDetail }>(`/api/admin/orders/${encodeURIComponent(orderId)}`, {})
      .then((data) => {
        if (!cancelled) setOrder(data.order);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this order.");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="admin__panel-overlay" onClick={onClose}>
      <aside className="admin__panel" onClick={(e) => e.stopPropagation()} aria-label="Order detail">
        <div className="admin__panel-header">
          <h2 className="admin__section-title">Order detail</h2>
          <button type="button" className="admin__panel-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {error && <p className="admin__state admin__state--inline">{error}</p>}
        {!error && !order && <p className="admin__state admin__state--inline">Loading…</p>}

        {order && (
          <dl className="admin__detail-list">
            <div className="admin__detail-row">
              <dt>Guide</dt>
              <dd>{order.guideTitle}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Status</dt>
              <dd>
                <span className={`admin__status admin__status--${order.status}`}>{order.status}</span>
              </dd>
            </div>
            <div className="admin__detail-row">
              <dt>Amount</dt>
              <dd>{formatRupees(order.amountPaise)}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Email</dt>
              <dd>{order.email ? <CopyableText text={order.email} /> : "—"}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Order ID</dt>
              <dd>
                <CopyableText text={order.id} className="admin__detail-mono" />
              </dd>
            </div>
            <div className="admin__detail-row">
              <dt>Razorpay order ID</dt>
              <dd>
                <CopyableText text={order.razorpayOrderId} className="admin__detail-mono" />
              </dd>
            </div>
            <div className="admin__detail-row">
              <dt>Razorpay payment ID</dt>
              <dd>
                {order.razorpayPaymentId ? (
                  <CopyableText text={order.razorpayPaymentId} className="admin__detail-mono" />
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="admin__detail-row">
              <dt>Downloads</dt>
              <dd>{order.downloadCount}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Checkout started</dt>
              <dd>{formatDateTimeIST(order.createdAt)}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Paid</dt>
              <dd>{formatDateTimeIST(order.paidAt)}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Fulfilled</dt>
              <dd>{formatDateTimeIST(order.fulfilledAt)}</dd>
            </div>
            <div className="admin__detail-row">
              <dt>Email sent</dt>
              <dd>{order.emailSentAt ? formatDateTimeIST(order.emailSentAt) : "Not sent"}</dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}
