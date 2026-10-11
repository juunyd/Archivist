"use client";

import { useEffect, useMemo, useState } from "react";
import { getJson } from "@/lib/api";
import { useGuideOptions } from "../useGuideOptions";
import { CopyableText } from "../CopyableText";
import { TrendDownIcon, TrendUpIcon } from "../icons";
import { OrderDetailPanel } from "./OrderDetailPanel";

type OrderStatus = "created" | "paid" | "failed" | "refunded";
type SortKey = "date" | "amount" | "guide" | "status";
type SortDir = "asc" | "desc";

interface OrderRow {
  id: string;
  date: string;
  guideTitle: string;
  guideSlug: string;
  amountPaise: number;
  email: string | null;
  status: string;
}

interface OrdersResponse {
  orders: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "created", label: "Started" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "guide", label: "Guide" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

export function OrdersListContent() {
  const guides = useGuideOptions();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [guide, setGuide] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = {
      sort,
      dir,
      page: String(page),
      pageSize: String(pageSize),
    };
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    if (guide !== "all") params.guide = guide;
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    getJson<OrdersResponse>("/api/admin/orders", params)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load orders. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, status, guide, startDate, endDate, sort, dir, page]);

  function handleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const csvHref = useMemo(() => {
    const params = new URLSearchParams({ format: "csv", sort, dir });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (guide !== "all") params.set("guide", guide);
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    return `/api/admin/orders?${params.toString()}`;
  }, [search, status, guide, startDate, endDate, sort, dir]);

  return (
    <>
      <div className="admin__filter-bar">
        <div className="admin__filter admin__filter--grow">
          <label htmlFor="orders-search">Search</label>
          <input
            id="orders-search"
            type="text"
            placeholder="Email, guide, order or payment ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="admin__filter">
          <label htmlFor="orders-status">Status</label>
          <select
            id="orders-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as OrderStatus | "all");
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin__filter">
          <label htmlFor="orders-guide">Guide</label>
          <select
            id="orders-guide"
            value={guide}
            onChange={(e) => {
              setGuide(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All guides</option>
            {guides.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <div className="admin__filter">
          <label htmlFor="orders-start">From</label>
          <input
            id="orders-start"
            type="date"
            value={startDate}
            max={endDate || todayISTDateString()}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="admin__filter">
          <label htmlFor="orders-end">To</label>
          <input
            id="orders-end"
            type="date"
            value={endDate}
            min={startDate}
            max={todayISTDateString()}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error && <p className="admin__state">{error}</p>}
      {!error && !data && <p className="admin__state">Loading orders…</p>}

      {data && (
        <>
          <div className="admin__card-header-row">
            <p className="admin__result-count">
              {data.total} order{data.total === 1 ? "" : "s"}
            </p>
            <a className="admin__view-all" href={csvHref}>
              Download CSV
            </a>
          </div>

          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key}>
                      <button type="button" className="admin__sort-btn" onClick={() => handleSort(col.key)}>
                        {col.label}
                        {sort === col.key && (dir === "asc" ? <TrendUpIcon /> : <TrendDownIcon />)}
                      </button>
                    </th>
                  ))}
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.length === 0 && (
                  <tr>
                    <td colSpan={5}>No orders match these filters.</td>
                  </tr>
                )}
                {data.orders.map((o) => (
                  <tr key={o.id} className="admin__row--clickable" onClick={() => setSelectedOrderId(o.id)}>
                    <td>{formatDateTimeIST(o.date)}</td>
                    <td>{o.guideTitle}</td>
                    <td>{formatRupees(o.amountPaise)}</td>
                    <td>
                      <span className={`admin__status admin__status--${o.status}`}>{o.status}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>{o.email ? <CopyableText text={o.email} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin__pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {data.page} of {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {selectedOrderId && <OrderDetailPanel orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />}
    </>
  );
}
