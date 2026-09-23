// Only our own origins may call these routes from a browser. Anything else
// gets no CORS headers back, so the browser refuses to read the response.
// Unchanged from supabase/functions/_shared/cors.ts.
const ALLOWED_ORIGINS = [
  "https://archivist.in",
  "http://localhost:3000",
];

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  return { ...BASE_HEADERS };
}

/** Standard preflight response; return this for OPTIONS before doing any work. */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
