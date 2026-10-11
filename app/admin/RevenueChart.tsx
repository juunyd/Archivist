"use client";

import { useState } from "react";

export interface ChartDay {
  date: string;
  revenuePaise: number;
}

const REVENUE_COLOR = "#2a78d6";

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function formatDayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

export function RevenueChart({ data }: { data: ChartDay[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 760;
  const height = 240;
  const padLeft = 44;
  const padBottom = 28;
  const padTop = 12;
  const chartWidth = width - padLeft - 12;
  const chartHeight = height - padTop - padBottom;

  const maxValue = Math.max(1, ...data.map((d) => d.revenuePaise));
  const niceMax = Math.ceil(maxValue / 4) * 4 || 1;
  const groupWidth = chartWidth / data.length;
  const barWidth = Math.max(3, groupWidth * 0.6);

  const yFor = (value: number) => padTop + chartHeight - (value / niceMax) * chartHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  if (data.every((d) => d.revenuePaise === 0)) {
    return <p className="admin__state">No revenue recorded in the last 30 days yet.</p>;
  }

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily revenue, last 30 days"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
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
          const barHeight = (day.revenuePaise / niceMax) * chartHeight;
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
                x={groupX + groupWidth / 2 - barWidth / 2}
                y={yFor(day.revenuePaise)}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={REVENUE_COLOR}
              >
                <title>{`${day.date}: ${formatRupees(day.revenuePaise)} revenue`}</title>
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
        <div style={{ fontSize: 13, color: "var(--gray-900)", marginTop: 4 }}>
          <strong>{formatDayLabel(hovered.date)}</strong> — revenue {formatRupees(hovered.revenuePaise)}
        </div>
      )}
    </div>
  );
}
