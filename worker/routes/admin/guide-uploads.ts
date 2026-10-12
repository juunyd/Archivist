// POST /api/admin/guides/:slug/cover and /pdf — store the two files a guide
// needs before it can be published. Both routes call requireAccess() first.
//
// Covers and PDFs share the BOOK_FILES bucket under different prefixes:
// covers/{slug}.{ext} (served publicly back out through GET /covers/:file,
// see cover-serve.ts) and {slug}/{slug}.pdf (never served except through the
// token-gated /api/download route — this upload route never returns the
// file itself, only the path it was stored at).
import { json, jsonError, methodNotAllowed } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import type { WorkerEnv } from "../../lib/env";
import {
  getAdminGuide,
  serializeGuideDetail,
  setGuideCoverPath,
  setGuidePdfPath,
  setGuideBonusCoverPath,
  setGuideBonusPdfPath,
  orderCountsForSlug,
} from "../../lib/guides-admin";

const MAX_COVER_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

const COVER_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export async function handleAdminGuideCoverUpload(req: Request, env: WorkerEnv, slug: string): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const guide = await getAdminGuide(env, slug);
  if (!guide) return jsonError(req, 404, "not_found", "No guide with that slug.");

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_COVER_BYTES) {
    return jsonError(req, 413, "file_too_large", `Cover must be ${formatMb(MAX_COVER_BYTES)} or smaller.`);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(req, 400, "invalid_request", 'Expected multipart/form-data with a "file" field.');
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(req, 400, "invalid_request", 'Missing "file" field.');
  }

  const ext = COVER_EXTENSION_BY_TYPE[file.type];
  if (!ext) {
    return jsonError(req, 415, "unsupported_type", "Cover must be a PNG, JPEG or WebP image.");
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    return jsonError(req, 400, "invalid_request", "The uploaded file is empty.");
  }
  if (bytes.byteLength > MAX_COVER_BYTES) {
    return jsonError(req, 413, "file_too_large", `Cover must be ${formatMb(MAX_COVER_BYTES)} or smaller.`);
  }

  const key = `covers/${slug}.${ext}`;
  try {
    await env.BOOK_FILES.put(key, bytes, { httpMetadata: { contentType: file.type } });
    await setGuideCoverPath(env, slug, `/covers/${slug}.${ext}`);
  } catch (error) {
    console.error("admin/guides: cover upload failed", error);
    return jsonError(req, 500, "server_error", "Could not save the cover. Please try again.");
  }

  const row = await getAdminGuide(env, slug);
  const counts = await orderCountsForSlug(env, slug);
  return json(req, { guide: serializeGuideDetail(row!, counts.paid, counts.total) });
}

export async function handleAdminGuideBonusCoverUpload(req: Request, env: WorkerEnv, slug: string): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const guide = await getAdminGuide(env, slug);
  if (!guide) return jsonError(req, 404, "not_found", "No guide with that slug.");

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_COVER_BYTES) {
    return jsonError(req, 413, "file_too_large", `Cover must be ${formatMb(MAX_COVER_BYTES)} or smaller.`);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(req, 400, "invalid_request", 'Expected multipart/form-data with a "file" field.');
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(req, 400, "invalid_request", 'Missing "file" field.');
  }

  const ext = COVER_EXTENSION_BY_TYPE[file.type];
  if (!ext) {
    return jsonError(req, 415, "unsupported_type", "Cover must be a PNG, JPEG or WebP image.");
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    return jsonError(req, 400, "invalid_request", "The uploaded file is empty.");
  }
  if (bytes.byteLength > MAX_COVER_BYTES) {
    return jsonError(req, 413, "file_too_large", `Cover must be ${formatMb(MAX_COVER_BYTES)} or smaller.`);
  }

  const key = `covers/${slug}-bonus.${ext}`;
  try {
    await env.BOOK_FILES.put(key, bytes, { httpMetadata: { contentType: file.type } });
    await setGuideBonusCoverPath(env, slug, `/covers/${slug}-bonus.${ext}`);
  } catch (error) {
    console.error("admin/guides: bonus cover upload failed", error);
    return jsonError(req, 500, "server_error", "Could not save the bonus cover. Please try again.");
  }

  const row = await getAdminGuide(env, slug);
  const counts = await orderCountsForSlug(env, slug);
  return json(req, { guide: serializeGuideDetail(row!, counts.paid, counts.total) });
}

export async function handleAdminGuideBonusPdfUpload(req: Request, env: WorkerEnv, slug: string): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const guide = await getAdminGuide(env, slug);
  if (!guide) return jsonError(req, 404, "not_found", "No guide with that slug.");

  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/pdf")) {
    return jsonError(req, 415, "unsupported_type", "Expected Content-Type: application/pdf, with the raw PDF bytes as the request body.");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PDF_BYTES) {
    return jsonError(req, 413, "file_too_large", `PDF must be ${formatMb(MAX_PDF_BYTES)} or smaller.`);
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError(req, 400, "invalid_request", "The uploaded file is empty.");
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return jsonError(req, 413, "file_too_large", `PDF must be ${formatMb(MAX_PDF_BYTES)} or smaller.`);
  }

  // "%PDF" — real magic bytes, not just a trusted Content-Type header.
  const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
  if (!PDF_MAGIC.every((byte, i) => bytes[i] === byte)) {
    return jsonError(req, 400, "invalid_pdf", "This file is not a valid PDF (missing %PDF signature).");
  }

  const confirmed = new URL(req.url).searchParams.get("confirm") === "true";
  if (guide.bonus_pdf_path && !confirmed) {
    return jsonError(
      req,
      409,
      "bonus_pdf_exists",
      "This guide already has a bonus PDF, and paying customers download that exact file. Pass ?confirm=true to overwrite it.",
    );
  }

  const key = `${slug}/${slug}-bonus.pdf`;
  try {
    await env.BOOK_FILES.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
    await setGuideBonusPdfPath(env, slug, key);
  } catch (error) {
    console.error("admin/guides: bonus pdf upload failed", error);
    return jsonError(req, 500, "server_error", "Could not save the bonus PDF. Please try again.");
  }

  const row = await getAdminGuide(env, slug);
  const counts = await orderCountsForSlug(env, slug);
  return json(req, { guide: serializeGuideDetail(row!, counts.paid, counts.total) });
}

export async function handleAdminGuidePdfUpload(req: Request, env: WorkerEnv, slug: string): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const guide = await getAdminGuide(env, slug);
  if (!guide) return jsonError(req, 404, "not_found", "No guide with that slug.");

  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/pdf")) {
    return jsonError(req, 415, "unsupported_type", "Expected Content-Type: application/pdf, with the raw PDF bytes as the request body.");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PDF_BYTES) {
    return jsonError(req, 413, "file_too_large", `PDF must be ${formatMb(MAX_PDF_BYTES)} or smaller.`);
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return jsonError(req, 400, "invalid_request", "The uploaded file is empty.");
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return jsonError(req, 413, "file_too_large", `PDF must be ${formatMb(MAX_PDF_BYTES)} or smaller.`);
  }

  // "%PDF" — real magic bytes, not just a trusted Content-Type header.
  const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
  if (!PDF_MAGIC.every((byte, i) => bytes[i] === byte)) {
    return jsonError(req, 400, "invalid_pdf", "This file is not a valid PDF (missing %PDF signature).");
  }

  const confirmed = new URL(req.url).searchParams.get("confirm") === "true";
  if (guide.pdf_path && !confirmed) {
    return jsonError(
      req,
      409,
      "pdf_exists",
      "This guide already has a PDF, and paying customers download that exact file. Pass ?confirm=true to overwrite it.",
    );
  }

  const key = `${slug}/${slug}.pdf`;
  try {
    await env.BOOK_FILES.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
    await setGuidePdfPath(env, slug, key);
  } catch (error) {
    console.error("admin/guides: pdf upload failed", error);
    return jsonError(req, 500, "server_error", "Could not save the PDF. Please try again.");
  }

  const row = await getAdminGuide(env, slug);
  const counts = await orderCountsForSlug(env, slug);
  return json(req, { guide: serializeGuideDetail(row!, counts.paid, counts.total) });
}
