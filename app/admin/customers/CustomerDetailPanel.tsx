"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import { CopyableText } from "../CopyableText";
import { CloseIcon } from "../icons";

interface CustomerOrder {
  id: string;
  date: string;
  guideTitle: string;
  amountPaise: number;
  status: string;
}

interface CustomerDetail {
  email: string;
  summary: {
    ordersCount: number;
    totalSpentPaise: number;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
  };
  orders: CustomerOrder[];
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
  }).format(new Date(iso));
}

export function CustomerDetailPanel({ email, onClose }: { email: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    getJson<CustomerDetail>(`/api/admin/customers/${encodeURIComponent(email)}`, {})
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this customer.");
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="admin__panel-overlay" onClick={onClose}>
      <aside className="admin__panel" onClick={(e) => e.stopPropagation()} aria-label="Customer detail">
        <div className="admin__panel-header">
          <h2 className="admin__section-title">Customer</h2>
          <button type="button" className="admin__panel-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {error && <p className="admin__state admin__state--inline">{error}</p>}
        {!error && !detail && <p className="admin__state admin__state--inline">Loading…</p>}

        {detail && (
          <>
            <dl className="admin__detail-list">
              <div className="admin__detail-row">
                <dt>Email</dt>
                <dd>
                  <CopyableText text={detail.email} />
                </dd>
              </div>
              <div className="admin__detail-row">
                <dt>Paid orders</dt>
                <dd>{detail.summary.ordersCount}</dd>
              </div>
              <div className="admin__detail-row">
                <dt>Total spent</dt>
                <dd>{formatRupees(detail.summary.totalSpentPaise)}</dd>
              </div>
              <div className="admin__detail-row">
                <dt>First purchase</dt>
                <dd>{formatDateTimeIST(detail.summary.firstPurchaseAt)}</dd>
              </div>
              <div className="admin__detail-row">
                <dt>Last purchase</dt>
                <dd>{formatDateTimeIST(detail.summary.lastPurchaseAt)}</dd>
              </div>
            </dl>

            <h3 className="admin__panel-subtitle">All orders ({detail.orders.length})</h3>
            <div className="admin__table-wrap admin__table-wrap--panel">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Guide</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.orders.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDateTimeIST(o.date)}</td>
                      <td>{o.guideTitle}</td>
                      <td>{formatRupees(o.amountPaise)}</td>
                      <td>
                        <span className={`admin__status admin__status--${o.status}`}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
