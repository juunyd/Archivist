// POST/PUT /api/admin/guides/:slug/preview-images and
// DELETE /api/admin/guides/:slug/preview-images/:filename — manage the
// gallery's extra "preview page" images for a guide, on top of its cover.
//
// Stored under the same BOOK_FILES prefix as covers (covers/{slug}-preview-
// {uuid}.{ext}), so the existing public GET /covers/:file route (see
// cover-serve.ts) serves them with no changes — same bucket, same prefix,
// same charset the route's regex already accepts.
import { json, jsonError, methodNotAllowed, readJson } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import type { WorkerEnv } from "../../lib/env";
import {
  getAdminGuide,
  serializeGuideDetail,
  setGuidePreviewImages,
  parsePreviewImages,
  orderCountsForSlug,
  type PreviewImage,
} from "../../lib/guides-admin";
import { MAX_PREVIEW_IMAGES, validatePreviewImagesUpdate } from "../../lib/guide-validation";

const MAX_PREVIEW_IMAGE_BYTES = 2 * 1024 * 1024;

const PREVIEW_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/** The path's basename, e.g. "/covers/slug-preview-abc123.png" -> "slug-preview-abc123.png". */
function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

async function respondWithGuide(req: Request, env: WorkerEnv, slug: string): Promise<Response> {
  const row = await getAdminGuide(env, slug);
  if (!row) throw new Error("guide not found after a preview-images write that should have succeeded");
  const counts = await orderCountsForSlug(env, slug);
  return json(req, { guide: serializeGuideDetail(row, counts.paid, counts.total) });
}

export async function handleAdminGuidePreviewImages(req: Request, env: WorkerEnv, slug: string): Promise<Response> {
  if (req.method !== "POST" && req.method !== "PUT") return methodNotAllowed(req, "POST, PUT");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const guide = await getAdminGuide(env, slug);
  if (!guide) return jsonError(req, 404, "not_found", "No guide with that slug.");
  const current = parsePreviewImages(guide);

  if (req.method === "PUT") {
    const body = await readJson<unknown>(req);
    const result = validatePreviewImagesUpdate(body, current);
    if (!result.ok) {
      return jsonError(req, 400, "invalid_request", result.errors.join(" "));
    }
    try {
      await setGuidePreviewImages(env, slug, result.value);
    } catch (error) {
      console.error("admin/guides: preview images update failed", error);
      return jsonError(req, 500, "server_error", "Could not save the preview images. Please try again.");
    }
    return respondWithGuide(req, env, slug);
  }

  // POST: add one or more new images, up to the 8-image cap.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(req, 400, "invalid_request", 'Expected multipart/form-data with one or more "files" fields.');
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return jsonError(req, 400, "invalid_request", 'Missing "files" field.');
  }

  if (current.length + files.length > MAX_PREVIEW_IMAGES) {
    const remaining = Math.max(0, MAX_PREVIEW_IMAGES - current.length);
    return jsonError(
      req,
      400,
      "too_many_images",
      `This guide already has ${current.length} preview image${current.length === 1 ? "" : "s"}, and can take ${remaining} more (${MAX_PREVIEW_IMAGES} max). You tried to add ${files.length}.`,
    );
  }

  // Validate every file before writing any of them — no partial batches.
  const prepared: { ext: string; type: string; bytes: ArrayBuffer; name: string }[] = [];
  for (const file of files) {
    const ext = PREVIEW_EXTENSION_BY_TYPE[file.type];
    if (!ext) {
      return jsonError(req, 415, "unsupported_type", `"${file.name}" must be a PNG, JPEG or WebP image.`);
    }
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength === 0) {
      return jsonError(req, 400, "invalid_request", `"${file.name}" is empty.`);
    }
    if (bytes.byteLength > MAX_PREVIEW_IMAGE_BYTES) {
      return jsonError(req, 413, "file_too_large", `"${file.name}" must be ${formatMb(MAX_PREVIEW_IMAGE_BYTES)} or smaller.`);
    }
    prepared.push({ ext, type: file.type, bytes, name: file.name });
  }

  const added: PreviewImage[] = [];
  try {
    for (const file of prepared) {
      const id = crypto.randomUUID();
      const key = `covers/${slug}-preview-${id}.${file.ext}`;
      await env.BOOK_FILES.put(key, file.bytes, { httpMetadata: { contentType: file.type } });
      added.push({ path: `/covers/${slug}-preview-${id}.${file.ext}`, caption: null });
    }
    await setGuidePreviewImages(env, slug, [...current, ...added]);
  } catch (error) {
    console.error("admin/guides: preview image upload failed", error);
    return jsonError(req, 500, "server_error", "Could not save the preview images. Please try again.");
  }

  return respondWithGuide(req, env, slug);
}

export async function handleAdminGuidePreviewImageItem(
  req: Request,
  env: WorkerEnv,
  slug: string,
  filename: string,
): Promise<Response> {
  if (req.method !== "DELETE") return methodNotAllowed(req, "DELETE");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  const guide = await getAdminGuide(env, slug);
  if (!guide) return jsonError(req, 404, "not_found", "No guide with that slug.");

  const current = parsePreviewImages(guide);
  const match = current.find((img) => basename(img.path) === filename);
  if (!match) return jsonError(req, 404, "not_found", "No preview image with that filename on this guide.");

  try {
    await env.BOOK_FILES.delete(`covers/${filename}`);
    await setGuidePreviewImages(
      env,
      slug,
      current.filter((img) => img.path !== match.path),
    );
  } catch (error) {
    console.error("admin/guides: preview image removal failed", error);
    return jsonError(req, 500, "server_error", "Could not remove the preview image. Please try again.");
  }

  return respondWithGuide(req, env, slug);
}
