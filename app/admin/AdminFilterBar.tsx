"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";

export type RangeKey = "today" | "7d" | "30d" | "all" | "custom";

export interface RangeValue {
  range: RangeKey;
  start: string;
  end: string;
}

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

interface GuideOption {
  slug: string;
  title: string;
}

interface AdminFilterBarProps {
  rangeValue: RangeValue;
  onRangeChange: (value: RangeValue) => void;
  guideValue: string;
  onGuideChange: (slug: string) => void;
}

function todayISTDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function AdminFilterBar({ rangeValue, onRangeChange, guideValue, onGuideChange }: AdminFilterBarProps) {
  const [guides, setGuides] = useState<GuideOption[]>([]);

  useEffect(() => {
    getJson<{ guides: GuideOption[] }>("/api/admin/guides", {})
      .then((data) => setGuides(data.guides))
      .catch(() => setGuides([]));
  }, []);

  const today = todayISTDateString();

  return (
    <div className="admin__filter-bar">
      <div className="admin__filter">
        <label htmlFor="filter-range">Date range</label>
        <select
          id="filter-range"
          value={rangeValue.range}
          onChange={(e) => onRangeChange({ ...rangeValue, range: e.target.value as RangeKey })}
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {rangeValue.range === "custom" && (
        <>
          <div className="admin__filter">
            <label htmlFor="filter-start">From</label>
            <input
              id="filter-start"
              type="date"
              value={rangeValue.start}
              max={rangeValue.end || today}
              onChange={(e) => onRangeChange({ ...rangeValue, start: e.target.value })}
            />
          </div>
          <div className="admin__filter">
            <label htmlFor="filter-end">To</label>
            <input
              id="filter-end"
              type="date"
              value={rangeValue.end}
              min={rangeValue.start}
              max={today}
              onChange={(e) => onRangeChange({ ...rangeValue, end: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="admin__filter">
        <label htmlFor="filter-guide">Guide</label>
        <select id="filter-guide" value={guideValue} onChange={(e) => onGuideChange(e.target.value)}>
          <option value="all">All guides</option>
          {guides.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
