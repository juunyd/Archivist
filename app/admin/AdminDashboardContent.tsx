"use client";

import { useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/api";
import { RevenueSpendChart, type ChartDay } from "./RevenueSpendChart";

interface WindowStats {
  label: string;
  startDate: string | null;
  revenuePaise: number;
  paidOrders: number;
  checkoutsStarted: number;
  failedPayments: number;
  conversionRatePercent: number;
  adSpendPaise: number;
  costPerPurchasePaise: number | null;
  roas: number | null;
  estimatedProfitPerSalePaise: number | null;
}

interface PerGuideStats {
  slug: string;
  title: string;
  status: string | null;
  revenuePaise: number;
  paidOrders: number;
}

interface RecentOrder {
  date: string;
  guideTitle: string;
  amountPaise: number;
  maskedEmail: string | null;
  status: string;
}

interface StatsResponse {
  generatedAt: string;
  feeAssumptions: { paymentFeePercent: number; gstOnFeePercent: number };
  windows: { today: WindowStats; last7: WindowStats; last30: WindowStats; allTime: WindowStats };
  perGuide: PerGuideStats[];
  downloads: { total: number };
  resendRequests: { last7Days: number };
  chart: ChartDay[];
  recentOrders: RecentOrder[];
}

type WindowKey = "today" | "last7" | "last30" | "allTime";

const WINDOW_TABS: { key: WindowKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "last7", label: "7 days" },
  { key: "last30", label: "30 days" },
  { key: "allTime", label: "All time" },
];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatRupeesPrecise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTimeIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function todayISTDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function yesterdayISTDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
}

export function AdminDashboardContent() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<WindowKey>("last7");

  const [spendDate, setSpendDate] = useState(yesterdayISTDateString());
  const [spendAmount, setSpendAmount] = useState("");
  const [spendNote, setSpendNote] = useState("");
  const [spendSaving, setSpendSaving] = useState(false);
  const [spendMessage, setSpendMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function loadStats() {
    try {
      const data = await getJson<StatsResponse>("/api/admin/stats", {});
      setStats(data);
      setError(null);
    } catch {
      setError("Could not load dashboard data. Refresh to try again.");
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  async function handleSpendSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountRupees = Number.parseFloat(spendAmount);
    if (!Number.isFinite(amountRupees) || amountRupees < 0) {
      setSpendMessage({ text: "Enter a valid amount.", error: true });
      return;
    }
    setSpendSaving(true);
    setSpendMessage(null);
    try {
      await postJson("/api/admin/ad-spend", {
        date: spendDate,
        amountPaise: Math.round(amountRupees * 100),
        note: spendNote || undefined,
      });
      setSpendMessage({ text: "Saved." });
      setSpendNote("");
      void loadStats();
    } catch {
      setSpendMessage({ text: "Could not save. Try again.", error: true });
    } finally {
      setSpendSaving(false);
    }
  }

  if (error) return <p className="admin__state">{error}</p>;
  if (!stats) return <p className="admin__state">Loading dashboard…</p>;

  const w = stats.windows[activeWindow];

  return (
    <>
      <section className="admin__section">
        <div className="admin__window-tabs" role="tablist" aria-label="Time range">
          {WINDOW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="admin__window-tab"
              aria-pressed={activeWindow === tab.key}
              onClick={() => setActiveWindow(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin__cards">
          <div className="admin__card">
            <p className="admin__card-label">Revenue</p>
            <p className="admin__card-value">{formatRupees(w.revenuePaise)}</p>
            <p className="admin__card-sub">{w.paidOrders} paid order{w.paidOrders === 1 ? "" : "s"}</p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">Conversion</p>
            <p className="admin__card-value">{w.conversionRatePercent.toFixed(1)}%</p>
            <p className="admin__card-sub">
              {w.paidOrders} paid / {w.checkoutsStarted} started
            </p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">Failed payments</p>
            <p className="admin__card-value">{w.failedPayments}</p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">Ad spend</p>
            <p className="admin__card-value">{formatRupees(w.adSpendPaise)}</p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">Cost per purchase</p>
            <p className="admin__card-value">
              {w.costPerPurchasePaise === null ? "—" : formatRupeesPrecise(w.costPerPurchasePaise)}
            </p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">ROAS</p>
            <p className="admin__card-value">{w.roas === null ? "—" : `${w.roas.toFixed(2)}×`}</p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">Est. profit / sale</p>
            <p className="admin__card-value">
              {w.estimatedProfitPerSalePaise === null ? "—" : formatRupeesPrecise(w.estimatedProfitPerSalePaise)}
            </p>
          </div>
          <div className="admin__card">
            <p className="admin__card-label">Downloads (all time)</p>
            <p className="admin__card-value">{stats.downloads.total}</p>
            <p className="admin__card-sub">{stats.resendRequests.last7Days} resend request(s), last 7 days</p>
          </div>
        </div>

        <p className="admin__fee-note">
          Profit estimate assumes a {stats.feeAssumptions.paymentFeePercent}% payment fee plus{" "}
          {stats.feeAssumptions.gstOnFeePercent}% GST on that fee, then subtracts cost per purchase for the same
          window. Edit these assumptions in worker/lib/fees.ts.
        </p>
      </section>

      <section className="admin__section">
        <h2 className="admin__section-title">Revenue vs ad spend, last 30 days</h2>
        <RevenueSpendChart data={stats.chart} />
      </section>

      <section className="admin__section">
        <h2 className="admin__section-title">Record yesterday&apos;s ad spend</h2>
        <form className="admin__form" onSubmit={handleSpendSubmit}>
          <div className="admin__field">
            <label htmlFor="spend-date">Date</label>
            <input
              id="spend-date"
              type="date"
              value={spendDate}
              max={todayISTDateString()}
              onChange={(e) => setSpendDate(e.target.value)}
              required
            />
          </div>
          <div className="admin__field">
            <label htmlFor="spend-amount">Amount (₹)</label>
            <input
              id="spend-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={spendAmount}
              onChange={(e) => setSpendAmount(e.target.value)}
              required
            />
          </div>
          <div className="admin__field admin__field--note">
            <label htmlFor="spend-note">Note (optional)</label>
            <input id="spend-note" type="text" value={spendNote} onChange={(e) => setSpendNote(e.target.value)} />
          </div>
          <button className="admin__form-submit" type="submit" disabled={spendSaving}>
            {spendSaving ? "Saving…" : "Save spend"}
          </button>
          {spendMessage && (
            <span className={`admin__form-message${spendMessage.error ? " admin__form-message--error" : ""}`}>
              {spendMessage.text}
            </span>
          )}
        </form>
      </section>

      <section className="admin__section">
        <h2 className="admin__section-title">Revenue by guide (all time, paid orders)</h2>
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Guide</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.perGuide.length === 0 && (
                <tr>
                  <td colSpan={4}>No paid orders yet.</td>
                </tr>
              )}
              {stats.perGuide.map((g) => (
                <tr key={g.slug}>
                  <td>{g.title}</td>
                  <td>
                    {g.status && <span className={`admin__status admin__status--${g.status}`}>{g.status}</span>}
                  </td>
                  <td>{g.paidOrders}</td>
                  <td>{formatRupees(g.revenuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin__section">
        <h2 className="admin__section-title">Recent orders</h2>
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Guide</th>
                <th>Amount</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5}>No orders yet.</td>
                </tr>
              )}
              {stats.recentOrders.map((o, i) => (
                <tr key={i}>
                  <td>{formatDateTimeIST(o.date)}</td>
                  <td>{o.guideTitle}</td>
                  <td>{formatRupees(o.amountPaise)}</td>
                  <td>{o.maskedEmail ?? "—"}</td>
                  <td>
                    <span className={`admin__status admin__status--${o.status}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
