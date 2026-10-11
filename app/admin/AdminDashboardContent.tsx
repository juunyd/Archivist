"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getJson } from "@/lib/api";
import { RevenueChart, type ChartDay } from "./RevenueChart";
import { FunnelSection, type PerGuideFunnel } from "./FunnelSection";
import { AdminFilterBar, type RangeValue } from "./AdminFilterBar";
import { TrendDownIcon, TrendUpIcon } from "./icons";

interface WindowStats {
  startDate: string | null;
  endDate: string;
  revenuePaise: number;
  paidOrders: number;
  checkoutsStarted: number;
  views: number;
  failedPayments: number;
  downloads: number;
  newCustomers: number;
}

interface PerGuideStats {
  slug: string;
  title: string;
  revenuePaise: number;
  paidOrders: number;
  checkoutsStarted: number;
  conversionRatePercent: number;
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
  range: { key: string; startDate: string | null; endDate: string; previousStartDate: string | null; previousEndDate: string | null };
  current: WindowStats;
  previous: WindowStats | null;
  trackingStartDate: string | null;
  bestSellers: PerGuideStats[] | null;
  weakest: PerGuideStats[] | null;
  perGuideFunnel: PerGuideFunnel[] | null;
  chart: ChartDay[];
  recentOrders: RecentOrder[];
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatInt(n: number): string {
  return n.toLocaleString("en-IN");
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

function daysAgoISTDateString(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  );
}

type Direction = "higherIsBetter" | "lowerIsBetter";

interface CardDef {
  key: string;
  label: string;
  format: (w: WindowStats) => string;
  raw: (w: WindowStats) => number | null;
  direction: Direction;
}

const CARDS: CardDef[] = [
  { key: "revenue", label: "Revenue", format: (w) => formatRupees(w.revenuePaise), raw: (w) => w.revenuePaise, direction: "higherIsBetter" },
  { key: "orders", label: "Orders", format: (w) => formatInt(w.paidOrders), raw: (w) => w.paidOrders, direction: "higherIsBetter" },
  { key: "failed", label: "Failed payments", format: (w) => formatInt(w.failedPayments), raw: (w) => w.failedPayments, direction: "lowerIsBetter" },
  { key: "downloads", label: "Downloads", format: (w) => formatInt(w.downloads), raw: (w) => w.downloads, direction: "higherIsBetter" },
  { key: "newCustomers", label: "New customers", format: (w) => formatInt(w.newCustomers), raw: (w) => w.newCustomers, direction: "higherIsBetter" },
];

function DeltaBadge({ current, previous, direction }: { current: number | null; previous: number | null; direction: Direction }) {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="admin__delta admin__delta--good">
        <TrendUpIcon /> new
      </span>
    );
  }
  const changePercent = ((current - previous) / previous) * 100;
  if (Math.abs(changePercent) < 0.05) return null;
  const up = changePercent > 0;
  const good = direction === "higherIsBetter" ? up : !up;
  return (
    <span className={`admin__delta ${good ? "admin__delta--good" : "admin__delta--bad"}`}>
      {up ? <TrendUpIcon /> : <TrendDownIcon />}
      {Math.abs(changePercent).toFixed(0)}%
    </span>
  );
}

function GuideBarList({
  title,
  guides,
  variant,
  renderValue,
  barPercent,
}: {
  title: string;
  guides: PerGuideStats[];
  variant: "good" | "weak";
  renderValue: (g: PerGuideStats) => string;
  barPercent: (g: PerGuideStats) => number;
}) {
  return (
    <div className="admin__card admin__card--list">
      <h2 className="admin__section-title">{title}</h2>
      {guides.length === 0 && <p className="admin__state admin__state--inline">No data for this period.</p>}
      <ul className="admin__bar-list">
        {guides.map((g) => (
          <li key={g.slug} className="admin__bar-row">
            <div className="admin__bar-row-top">
              <span className="admin__bar-row-label">{g.title}</span>
              <span className="admin__bar-row-value">{renderValue(g)}</span>
            </div>
            <div className="admin__bar-track">
              <div
                className={`admin__bar-fill admin__bar-fill--${variant}`}
                style={{ width: `${Math.max(2, Math.min(100, barPercent(g)))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDashboardContent() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rangeValue, setRangeValue] = useState<RangeValue>({
    range: "7d",
    start: daysAgoISTDateString(6),
    end: todayISTDateString(),
  });
  const [guideValue, setGuideValue] = useState("all");

  const canFetch = rangeValue.range !== "custom" || (!!rangeValue.start && !!rangeValue.end && rangeValue.start <= rangeValue.end);

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    const params: Record<string, string> = { range: rangeValue.range };
    if (rangeValue.range === "custom") {
      params.start = rangeValue.start;
      params.end = rangeValue.end;
    }
    if (guideValue !== "all") params.guide = guideValue;

    getJson<StatsResponse>("/api/admin/stats", params)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load dashboard data. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [rangeValue.range, rangeValue.start, rangeValue.end, guideValue, canFetch]);

  const bestSellerMax = useMemo(
    () => Math.max(1, ...(stats?.bestSellers ?? []).map((g) => g.revenuePaise)),
    [stats],
  );

  return (
    <>
      <AdminFilterBar
        rangeValue={rangeValue}
        onRangeChange={setRangeValue}
        guideValue={guideValue}
        onGuideChange={setGuideValue}
      />

      {error && <p className="admin__state">{error}</p>}
      {!error && !stats && <p className="admin__state">Loading dashboard…</p>}

      {stats && (
        <>
          <section className="admin__section">
            <div className="admin__cards">
              {CARDS.map((card) => (
                <div className="admin__card" key={card.key}>
                  <p className="admin__card-label">{card.label}</p>
                  <div className="admin__card-value-row">
                    <p className="admin__card-value">{card.format(stats.current)}</p>
                    <DeltaBadge
                      current={card.raw(stats.current)}
                      previous={stats.previous ? card.raw(stats.previous) : null}
                      direction={card.direction}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <FunnelSection
            views={stats.current.views}
            checkoutsStarted={stats.current.checkoutsStarted}
            paidOrders={stats.current.paidOrders}
            trackingStartDate={stats.trackingStartDate}
            perGuideFunnel={stats.perGuideFunnel}
          />

          <section className="admin__section">
            <div className="admin__card">
              <h2 className="admin__section-title">Revenue, last 30 days</h2>
              <RevenueChart data={stats.chart} />
            </div>
          </section>

          {stats.bestSellers && stats.weakest && (
            <section className="admin__section admin__grid-2">
              <GuideBarList
                title="Best sellers"
                guides={stats.bestSellers}
                variant="good"
                renderValue={(g) => `${formatRupees(g.revenuePaise)} · ${g.paidOrders} order${g.paidOrders === 1 ? "" : "s"}`}
                barPercent={(g) => (g.revenuePaise / bestSellerMax) * 100}
              />
              <GuideBarList
                title="Weakest"
                guides={stats.weakest}
                variant="weak"
                renderValue={(g) => `${g.conversionRatePercent.toFixed(0)}% · ${g.paidOrders}/${g.checkoutsStarted}`}
                barPercent={(g) => g.conversionRatePercent}
              />
            </section>
          )}

          <section className="admin__section">
            <div className="admin__card-header-row">
              <h2 className="admin__section-title">Recent orders</h2>
              <Link href="/admin/orders/" className="admin__view-all">
                View all orders →
              </Link>
            </div>
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
                      <td colSpan={5}>No orders in this period.</td>
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
      )}
    </>
  );
}
