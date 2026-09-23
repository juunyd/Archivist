// Worker entry point. Everything under /api/* is handled here; everything
// else falls through to the Next.js static export in out/ via the ASSETS
// binding. This replaces the six Supabase Edge Functions — same routes,
// same validation, same idempotency, now backed by D1 + R2 instead of
// Postgres + Supabase Storage.
import { preflight } from "./lib/cors";
import { jsonError } from "./lib/http";
import type { WorkerEnv } from "./lib/env";
import { handleCreateOrder } from "./routes/create-order";
import { handleVerify } from "./routes/verify";
import { handleWebhook } from "./routes/webhook";
import { handleOrderStatus } from "./routes/order-status";
import { handleDownload } from "./routes/download";
import { handleResendLink } from "./routes/resend-link";

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      // Static export: pages, /images/*, _next/*, etc.
      return env.ASSETS.fetch(request);
    }

    const preflightResponse = preflight(request);
    if (preflightResponse) return preflightResponse;

    try {
      switch (url.pathname) {
        case "/api/create-order":
          return await handleCreateOrder(request, env);
        case "/api/verify":
          return await handleVerify(request, env);
        case "/api/webhooks/razorpay":
          return await handleWebhook(request, env);
        case "/api/order-status":
          return await handleOrderStatus(request, env);
        case "/api/download":
          return await handleDownload(request, env);
        case "/api/resend-link":
          return await handleResendLink(request, env);
        default:
          return jsonError(request, 404, "not_found", "Not found.");
      }
    } catch (error) {
      console.error(`unhandled error on ${url.pathname}`, error);
      return jsonError(request, 500, "server_error", "Something went wrong. Please try again.");
    }
  },
};
