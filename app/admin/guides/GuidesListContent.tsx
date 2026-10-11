"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import { PublishChangesButton } from "./PublishChangesButton";

interface AdminGuideListItem {
  slug: string;
  title: string;
  number: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: "draft" | "published";
  coverPath: string | null;
  hasPdf: boolean;
  sortOrder: number | null;
  paidOrders: number;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function GuidesListContent() {
  const [guides, setGuides] = useState<AdminGuideListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getJson<{ guides: AdminGuideListItem[] }>("/api/admin/guides", {});
        setGuides(data.guides);
      } catch {
        setError("Could not load guides. Refresh to try again.");
      }
    })();
  }, []);

  if (error) return <p className="admin__state">{error}</p>;
  if (!guides) return <p className="admin__state">Loading guides…</p>;

  return (
    <>
      <div className="admin__guides-toolbar">
        <a href="/admin/guides/edit/" className="admin__form-submit admin__guides-new">
          New guide
        </a>
        <PublishChangesButton />
      </div>

      <div className="admin__table-wrap">
        <table className="admin__table admin__table--guides">
          <thead>
            <tr>
              <th>Cover</th>
              <th>Title</th>
              <th>Price</th>
              <th>Status</th>
              <th>Orders</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {guides.length === 0 && (
              <tr>
                <td colSpan={6}>No guides yet.</td>
              </tr>
            )}
            {guides.map((g) => (
              <tr key={g.slug}>
                <td>
                  {g.coverPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, no Image optimizer available
                    <img src={g.coverPath} alt="" className="admin__guide-thumb" />
                  ) : (
                    <span className="admin__guide-thumb admin__guide-thumb--empty" aria-hidden="true" />
                  )}
                </td>
                <td>{g.title}</td>
                <td>{formatRupees(g.pricePaise)}</td>
                <td>
                  <span className={`admin__status admin__status--${g.status}`}>{g.status}</span>
                </td>
                <td>{g.paidOrders}</td>
                <td>
                  <a href={`/admin/guides/edit/?slug=${encodeURIComponent(g.slug)}`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
