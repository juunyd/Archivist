// Minimal CSV writer for admin exports (Emails page). No library — the only
// thing this needs is RFC 4180 quoting for commas/quotes/newlines, which is
// a few lines on its own.
import { corsHeaders } from "./cors";

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function csvResponse(req: Request, filename: string, headers: string[], rows: string[][]): Response {
  const body = toCsv(headers, rows);
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
