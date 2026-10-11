"use client";

import { useId, useState } from "react";

export interface ChartDay {
  date: string;
  revenuePaise: number;
  spendPaise: number;
}

// Validated against the dataviz skill's palette checker (2-slot categorical,
// light mode): blue/orange clears the CVD, lightness and contrast gates.
// Brand ink/red were tried first and failed the lightness+chroma checks —
// pure near-black isn't a hue, so it can't anchor a categorical slot.
const REVENUE_COLOR = "#2a78d6";
const SPEND_COLOR = "#eb6834";

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function formatDayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

export function RevenueSpendChart({ data }: { data: ChartDay[] }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 760;
  const height = 240;
  const padLeft = 44;
  const padBottom = 28;
  const padTop = 12;
  const chartWidth = width - padLeft - 12;
  const chartHeight = height - padTop - padBottom;

  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.revenuePaise, d.spendPaise)));
  const niceMax = Math.ceil(maxValue / 4) * 4 || 1;
  const groupWidth = chartWidth / data.length;
  const barGap = 2;
  const barWidth = Math.max(2, groupWidth / 2 - barGap * 1.5);

  const yFor = (value: number) => padTop + chartHeight - (value / niceMax) * chartHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  if (data.every((d) => d.revenuePaise === 0 && d.spendPaise === 0)) {
    return <p className="admin__state">No revenue or ad spend recorded in the last 30 days yet.</p>;
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 13, color: "var(--gray-800)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: REVENUE_COLOR, display: "inline-block" }} />
          Revenue
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: SPEND_COLOR, display: "inline-block" }} />
          Ad spend
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily revenue versus ad spend, last 30 days"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <clipPath id={`${gradientId}-clip`}>
            <rect x={padLeft} y={padTop} width={chartWidth} height={chartHeight} />
          </clipPath>
        </defs>

        {gridLines.map((fraction) => {
          const y = padTop + chartHeight - fraction * chartHeight;
          return (
            <g key={fraction}>
              <line x1={padLeft} x2={width - 12} y1={y} y2={y} stroke="var(--gray-300)" strokeWidth={1} />
              <text x={padLeft - 8} y={y} fontSize={10} fill="var(--gray-600)" textAnchor="end" dominantBaseline="middle">
                {formatRupees(fraction * niceMax)}
              </text>
            </g>
          );
        })}

        {data.map((day, i) => {
          const groupX = padLeft + i * groupWidth;
          const revenueHeight = (day.revenuePaise / niceMax) * chartHeight;
          const spendHeight = (day.spendPaise / niceMax) * chartHeight;
          const showLabel = i % 5 === 0 || i === data.length - 1;
          const isHovered = hoverIndex === i;

          return (
            <g
              key={day.date}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={groupX}
                y={padTop}
                width={groupWidth}
                height={chartHeight}
                fill={isHovered ? "var(--gray-100)" : "transparent"}
              />
              <rect
                x={groupX + groupWidth / 2 - barWidth - barGap / 2}
                y={yFor(day.revenuePaise)}
                width={barWidth}
                height={revenueHeight}
                rx={2}
                fill={REVENUE_COLOR}
              >
                <title>{`${day.date}: ${formatRupees(day.revenuePaise)} revenue`}</title>
              </rect>
              <rect
                x={groupX + groupWidth / 2 + barGap / 2}
                y={yFor(day.spendPaise)}
                width={barWidth}
                height={spendHeight}
                rx={2}
                fill={SPEND_COLOR}
              >
                <title>{`${day.date}: ${formatRupees(day.spendPaise)} ad spend`}</title>
              </rect>
              {showLabel && (
                <text
                  x={groupX + groupWidth / 2}
                  y={height - 8}
                  fontSize={10}
                  fill="var(--gray-600)"
                  textAnchor="middle"
                >
                  {formatDayLabel(day.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          style={{
            fontSize: 13,
            color: "var(--gray-900)",
            marginTop: 4,
          }}
        >
          <strong>{formatDayLabel(hovered.date)}</strong> — revenue {formatRupees(hovered.revenuePaise)}, ad spend{" "}
          {formatRupees(hovered.spendPaise)}
        </div>
      )}
    </div>
  );
}
