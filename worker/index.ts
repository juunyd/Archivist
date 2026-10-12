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
import { handleAdminOrderDetail, handleAdminOrdersList } from "./routes/admin/orders";
import { handleTrackView } from "./routes/track-view";
import {
  handleAdminGuideDetail,
  handleAdminGuideUnpublish,
  handleAdminGuidesList,
} from "./routes/admin/guides";
import {
  handleAdminGuideCoverUpload,
  handleAdminGuidePdfUpload,
  handleAdminGuideBonusCoverUpload,
  handleAdminGuideBonusPdfUpload,
} from "./routes/admin/guide-uploads";
import {
  handleAdminGuidePreviewImages,
  handleAdminGuidePreviewImageItem,
} from "./routes/admin/guide-preview-images";
import { handleAdminRebuild, handleAdminRebuildStatus } from "./routes/admin/rebuild";
import { handleCatalog } from "./routes/catalog";
import { handleCoverServe } from "./routes/cover-serve";

// Guide pages used to live at /books/[slug]/ and were flattened to /[slug]/.
// Redirected here (not via next.config.js redirects, which static export
// does not support) so old links and search results keep working instead of
// 404ing.
const OLD_BOOK_PATH = /^\/books\/([^/]+)\/?$/;

// Covers uploaded through the admin API (Step 2) are served straight out of
// R2 — not part of the static export, so this has to be matched here rather
// than falling through to env.ASSETS.fetch(). Legacy covers in
// public/images/covers/ are untouched and keep being served as static
// assets via the fallthrough below.
const COVER_SERVE_PATH = /^\/covers\/([a-z0-9-]+\.(?:png|jpg|webp))$/;

// /api/admin/guides/:slug and its sub-paths carry a dynamic segment, so
// they're matched here before the exact-path switch below (which only ever
// sees static routes). Order among these doesn't actually matter — each
// pattern's `[^/]+` can't span the `/` that distinguishes them — but cover/
// pdf/unpublish are checked first for readability.
const ADMIN_GUIDE_UNPUBLISH_PATH = /^\/api\/admin\/guides\/([^/]+)\/unpublish$/;
const ADMIN_GUIDE_COVER_PATH = /^\/api\/admin\/guides\/([^/]+)\/cover$/;
const ADMIN_GUIDE_PDF_PATH = /^\/api\/admin\/guides\/([^/]+)\/pdf$/;
const ADMIN_GUIDE_BONUS_COVER_PATH = /^\/api\/admin\/guides\/([^/]+)\/bonus-cover$/;
const ADMIN_GUIDE_BONUS_PDF_PATH = /^\/api\/admin\/guides\/([^/]+)\/bonus-pdf$/;
const ADMIN_GUIDE_PREVIEW_IMAGES_PATH = /^\/api\/admin\/guides\/([^/]+)\/preview-images$/;
const ADMIN_GUIDE_PREVIEW_IMAGE_ITEM_PATH = /^\/api\/admin\/guides\/([^/]+)\/preview-images\/([^/]+)$/;
const ADMIN_GUIDE_DETAIL_PATH = /^\/api\/admin\/guides\/([^/]+)$/;
const ADMIN_ORDER_DETAIL_PATH = /^\/api\/admin\/orders\/([^/]+)$/;

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      const oldBookMatch = OLD_BOOK_PATH.exec(url.pathname);
      if (oldBookMatch) {
        url.pathname = `/${oldBookMatch[1]}/`;
        return Response.redirect(url.toString(), 308);
      }

      const coverMatch = COVER_SERVE_PATH.exec(url.pathname);
      if (coverMatch) {
        return await handleCoverServe(request, env, coverMatch[1]);
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
      const coverUploadMatch = ADMIN_GUIDE_COVER_PATH.exec(url.pathname);
      if (coverUploadMatch) {
        return await handleAdminGuideCoverUpload(request, env, decodeURIComponent(coverUploadMatch[1]));
      }
      const pdfUploadMatch = ADMIN_GUIDE_PDF_PATH.exec(url.pathname);
      if (pdfUploadMatch) {
        return await handleAdminGuidePdfUpload(request, env, decodeURIComponent(pdfUploadMatch[1]));
      }
      const bonusCoverUploadMatch = ADMIN_GUIDE_BONUS_COVER_PATH.exec(url.pathname);
      if (bonusCoverUploadMatch) {
        return await handleAdminGuideBonusCoverUpload(request, env, decodeURIComponent(bonusCoverUploadMatch[1]));
      }
      const bonusPdfUploadMatch = ADMIN_GUIDE_BONUS_PDF_PATH.exec(url.pathname);
      if (bonusPdfUploadMatch) {
        return await handleAdminGuideBonusPdfUpload(request, env, decodeURIComponent(bonusPdfUploadMatch[1]));
      }
      const previewImageItemMatch = ADMIN_GUIDE_PREVIEW_IMAGE_ITEM_PATH.exec(url.pathname);
      if (previewImageItemMatch) {
        return await handleAdminGuidePreviewImageItem(
          request,
          env,
          decodeURIComponent(previewImageItemMatch[1]),
          decodeURIComponent(previewImageItemMatch[2]),
        );
      }
      const previewImagesMatch = ADMIN_GUIDE_PREVIEW_IMAGES_PATH.exec(url.pathname);
      if (previewImagesMatch) {
        return await handleAdminGuidePreviewImages(request, env, decodeURIComponent(previewImagesMatch[1]));
      }
      const guideDetailMatch = ADMIN_GUIDE_DETAIL_PATH.exec(url.pathname);
      if (guideDetailMatch) {
        return await handleAdminGuideDetail(request, env, decodeURIComponent(guideDetailMatch[1]));
      }
      const orderDetailMatch = ADMIN_ORDER_DETAIL_PATH.exec(url.pathname);
      if (orderDetailMatch) {
        return await handleAdminOrderDetail(request, env, decodeURIComponent(orderDetailMatch[1]));
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
        case "/api/track/view":
          return await handleTrackView(request, env, ctx);
        case "/api/admin/orders":
          return await handleAdminOrdersList(request, env);
        case "/api/admin/guides":
          return await handleAdminGuidesList(request, env);
        case "/api/admin/rebuild":
          return await handleAdminRebuild(request, env);
        case "/api/admin/rebuild-status":
          return await handleAdminRebuildStatus(request, env);
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
