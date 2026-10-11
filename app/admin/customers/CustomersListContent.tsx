"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import { CopyableText } from "../CopyableText";
import { TrendDownIcon, TrendUpIcon } from "../icons";
import { CustomerDetailPanel } from "./CustomerDetailPanel";

type SortKey = "email" | "orders" | "spent" | "first" | "last";
type SortDir = "asc" | "desc";

interface CustomerRow {
  email: string;
  ordersCount: number;
  totalSpentPaise: number;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  guidesCount: number;
}

interface CustomersResponse {
  customers: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "orders", label: "Orders" },
  { key: "spent", label: "Total spent" },
  { key: "first", label: "First purchase" },
  { key: "last", label: "Last purchase" },
];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDateIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function CustomersListContent() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("last");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [data, setData] = useState<CustomersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = { sort, dir, page: String(page), pageSize: String(pageSize) };
    if (search) params.search = search;

    getJson<CustomersResponse>("/api/admin/customers", params)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load customers. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, sort, dir, page]);

  function handleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "email" ? "asc" : "desc");
    }
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="admin__filter-bar">
        <div className="admin__filter admin__filter--grow">
          <label htmlFor="customers-search">Search</label>
          <input
            id="customers-search"
            type="text"
            placeholder="Search by email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="admin__state">{error}</p>}
      {!error && !data && <p className="admin__state">Loading customers…</p>}

      {data && (
        <>
          <p className="admin__result-count">
            {data.total} customer{data.total === 1 ? "" : "s"}
          </p>

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
                  <th>Guides bought</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.length === 0 && (
                  <tr>
                    <td colSpan={6}>No customers match this search.</td>
                  </tr>
                )}
                {data.customers.map((c) => (
                  <tr key={c.email} className="admin__row--clickable" onClick={() => setSelectedEmail(c.email)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <CopyableText text={c.email} />
                    </td>
                    <td>{c.ordersCount}</td>
                    <td>{formatRupees(c.totalSpentPaise)}</td>
                    <td>{formatDateIST(c.firstPurchaseAt)}</td>
                    <td>{formatDateIST(c.lastPurchaseAt)}</td>
                    <td>
                      {c.guidesCount} guide{c.guidesCount === 1 ? "" : "s"}
                    </td>
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

      {selectedEmail && <CustomerDetailPanel email={selectedEmail} onClose={() => setSelectedEmail(null)} />}
    </>
  );
}
