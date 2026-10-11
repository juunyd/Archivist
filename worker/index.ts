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
import { handleAdminStats } from "./routes/admin/stats";
import { handleAdminAdSpend } from "./routes/admin/ad-spend";
import {
  handleAdminGuideDetail,
  handleAdminGuideUnpublish,
  handleAdminGuidesList,
} from "./routes/admin/guides";
import { handleCatalog } from "./routes/catalog";

// Guide pages used to live at /books/[slug]/ and were flattened to /[slug]/.
// Redirected here (not via next.config.js redirects, which static export
// does not support) so old links and search results keep working instead of
// 404ing.
const OLD_BOOK_PATH = /^\/books\/([^/]+)\/?$/;

// /api/admin/guides/:slug and /api/admin/guides/:slug/unpublish carry a
// dynamic segment, so they're matched here before the exact-path switch
// below (which only ever sees static routes).
const ADMIN_GUIDE_UNPUBLISH_PATH = /^\/api\/admin\/guides\/([^/]+)\/unpublish$/;
const ADMIN_GUIDE_DETAIL_PATH = /^\/api\/admin\/guides\/([^/]+)$/;

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      const oldBookMatch = OLD_BOOK_PATH.exec(url.pathname);
      if (oldBookMatch) {
        url.pathname = `/${oldBookMatch[1]}/`;
        return Response.redirect(url.toString(), 308);
      }

      // Static export: pages, /images/*, _next/*, etc.
      return env.ASSETS.fetch(request);
    }

    const preflightResponse = preflight(request);
    if (preflightResponse) return preflightResponse;

    try {
      const unpublishMatch = ADMIN_GUIDE_UNPUBLISH_PATH.exec(url.pathname);
      if (unpublishMatch) {
        return await handleAdminGuideUnpublish(request, env, decodeURIComponent(unpublishMatch[1]));
      }
      const guideDetailMatch = ADMIN_GUIDE_DETAIL_PATH.exec(url.pathname);
      if (guideDetailMatch) {
        return await handleAdminGuideDetail(request, env, decodeURIComponent(guideDetailMatch[1]));
      }

      switch (url.pathname) {
        case "/api/create-order":
          return await handleCreateOrder(request, env);
        case "/api/verify":
          return await handleVerify(request, env, ctx);
        case "/api/webhooks/razorpay":
          return await handleWebhook(request, env, ctx);
        case "/api/order-status":
          return await handleOrderStatus(request, env);
        case "/api/download":
          return await handleDownload(request, env);
        case "/api/resend-link":
          return await handleResendLink(request, env);
        case "/api/admin/stats":
          return await handleAdminStats(request, env);
        case "/api/admin/ad-spend":
          return await handleAdminAdSpend(request, env);
        case "/api/admin/guides":
          return await handleAdminGuidesList(request, env);
        case "/api/catalog":
          return await handleCatalog(request, env);
        default:
          return jsonError(request, 404, "not_found", "Not found.");
      }
    } catch (error) {
      console.error(`unhandled error on ${url.pathname}`, error);
      return jsonError(request, 500, "server_error", "Something went wrong. Please try again.");
    }
  },
};
