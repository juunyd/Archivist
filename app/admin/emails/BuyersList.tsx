"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import { CopyableText } from "../CopyableText";
import { TrendDownIcon, TrendUpIcon } from "../icons";

type SortDir = "asc" | "desc";

interface BuyerRow {
  email: string;
  ordersCount: number;
  lastPurchaseAt: string;
}

interface CustomersResponse {
  customers: BuyerRow[];
  total: number;
  page: number;
  pageSize: number;
}

function formatDateIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function BuyersList() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [data, setData] = useState<CustomersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = { sort: "last", dir, page: String(page), pageSize: String(pageSize) };
    if (search) params.search = search;

    getJson<CustomersResponse>("/api/admin/customers", params)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load buyers. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, dir, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const csvParams = new URLSearchParams({ format: "csv", sort: "last", dir, ...(search ? { search } : {}) });

  return (
    <div className="admin__card">
      <div className="admin__card-header-row">
        <h2 className="admin__section-title">Buyers{data ? ` (${data.total})` : ""}</h2>
        <a className="admin__view-all" href={`/api/admin/customers?${csvParams.toString()}`}>
          Download CSV
        </a>
      </div>

      <div className="admin__filter admin__filter--grow admin__filter--bare">
        <label htmlFor="buyers-search">Search</label>
        <input
          id="buyers-search"
          type="text"
          placeholder="Search by email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {error && <p className="admin__state admin__state--inline">{error}</p>}
      {!error && !data && <p className="admin__state admin__state--inline">Loading…</p>}

      {data && (
        <>
          <div className="admin__table-wrap admin__table-wrap--panel">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>
                    <button type="button" className="admin__sort-btn" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
                      Last purchase
                      {dir === "asc" ? <TrendUpIcon /> : <TrendDownIcon />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.customers.length === 0 && (
                  <tr>
                    <td colSpan={3}>No buyers match this search.</td>
                  </tr>
                )}
                {data.customers.map((b) => (
                  <tr key={b.email}>
                    <td>
                      <CopyableText text={b.email} />
                    </td>
                    <td>{b.ordersCount}</td>
                    <td>{formatDateIST(b.lastPurchaseAt)}</td>
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
    </div>
  );
}
