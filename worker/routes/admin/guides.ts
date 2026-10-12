// /api/admin/guides and /api/admin/guides/:slug — CRUD for the guide catalogue.
//
// Every handler here calls requireAccess() first. Nothing here ever hard-
// deletes a row: the only way to take a guide off sale is the unpublish
// action (status -> 'draft'), and a guide's slug can only change while it has
// zero orders (checked against `orders`, never assumed). price_paise is
// still the only number create-order ever reads — nothing here changes that
// contract, it only changes who can edit the value and from where.
import { json, jsonError, methodNotAllowed, readJson } from "../../lib/http";
import { requireAccess } from "../../lib/access";
import type { WorkerEnv } from "../../lib/env";
import {
  getAdminGuide,
  insertGuide,
  listAdminGuides,
  orderCountsForSlug,
  serializeGuideDetail,
  serializeGuideListRow,
  slugExists,
  unpublishGuide,
  updateGuide,
} from "../../lib/guides-admin";
import { bonusEnableBlockedReason, publishBlockedReason, validateGuideInput } from "../../lib/guide-validation";

export async function handleAdminGuidesList(req: Request, env: WorkerEnv): Promise<Response> {
  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  if (req.method === "GET") {
    try {
      const rows = await listAdminGuides(env);
      return json(req, { guides: rows.map(serializeGuideListRow) });
    } catch (error) {
      console.error("admin/guides: list failed", error);
      return jsonError(req, 500, "server_error", "Could not load guides.");
    }
  }

  if (req.method === "POST") {
    const body = await readJson<unknown>(req);
    const result = validateGuideInput(body);
    if (!result.ok) {
      return jsonError(req, 400, "invalid_request", result.errors.join(" "));
    }
    const input = result.value;

    if (input.status === "published") {
      // A brand-new guide has no cover or PDF yet — those are uploaded
      // (Step 2) after creation, against this same slug.
      return jsonError(req, 400, "cannot_publish", publishBlockedReason(null, null)!);
    }

    if (input.bonusEnabled) {
      // Same reasoning: a brand-new guide has no bonus cover or PDF yet either.
      return jsonError(req, 400, "cannot_enable_bonus", bonusEnableBlockedReason(null, null, null)!);
    }

    try {
      if (await slugExists(env, input.slug)) {
        return jsonError(req, 409, "slug_taken", `A guide with slug "${input.slug}" already exists.`);
      }
      await insertGuide(env, input);
      const row = await getAdminGuide(env, input.slug);
      if (!row) throw new Error("insert succeeded but row not found");
      return json(req, { guide: serializeGuideDetail(row, 0, 0) }, 201);
    } catch (error) {
      console.error("admin/guides: create failed", error);
      return jsonError(req, 500, "server_error", "Could not create guide.");
    }
  }

  return methodNotAllowed(req, "GET, POST");
}

export async function handleAdminGuideDetail(
  req: Request,
  env: WorkerEnv,
  slug: string,
): Promise<Response> {
  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  if (req.method === "GET") {
    try {
      const row = await getAdminGuide(env, slug);
      if (!row) return jsonError(req, 404, "not_found", "No guide with that slug.");
      const counts = await orderCountsForSlug(env, slug);
      return json(req, { guide: serializeGuideDetail(row, counts.paid, counts.total) });
    } catch (error) {
      console.error("admin/guides: get failed", error);
      return jsonError(req, 500, "server_error", "Could not load guide.");
    }
  }

  if (req.method === "PUT") {
    const existing = await getAdminGuide(env, slug);
    if (!existing) return jsonError(req, 404, "not_found", "No guide with that slug.");

    const body = await readJson<unknown>(req);
    const result = validateGuideInput(body);
    if (!result.ok) {
      return jsonError(req, 400, "invalid_request", result.errors.join(" "));
    }
    const input = result.value;

    try {
      const counts = await orderCountsForSlug(env, slug);

      if (input.slug !== slug) {
        if (counts.total > 0) {
          return jsonError(
            req,
            409,
            "slug_locked",
            `Cannot change slug: ${counts.total} order${counts.total === 1 ? "" : "s"} reference "${slug}". Unpublish or leave the slug as-is.`,
          );
        }
        if (existing.pdf_path) {
          return jsonError(
            req,
            409,
            "slug_locked",
            `Cannot change slug: this guide already has a PDF uploaded (${existing.pdf_path}). Re-upload under the new slug instead.`,
          );
        }
        if (await slugExists(env, input.slug)) {
          return jsonError(req, 409, "slug_taken", `A guide with slug "${input.slug}" already exists.`);
        }
      }

      if (input.status === "published") {
        const blocked = publishBlockedReason(existing.cover_path, existing.pdf_path);
        if (blocked) return jsonError(req, 400, "cannot_publish", blocked);

        // A saved path is not proof of a file — confirm the PDF Phase 2's
        // download route will later serve is actually sitting in R2, not
        // just recorded in D1 (e.g. after a failed or partial upload).
        const object = await env.BOOK_FILES.head(existing.pdf_path!);
        if (!object) {
          return jsonError(
            req,
            400,
            "cannot_publish",
            `Cannot publish: the PDF recorded for this guide (${existing.pdf_path}) was not found in storage. Re-upload it.`,
          );
        }
      }

      if (input.bonusEnabled) {
        const blocked = bonusEnableBlockedReason(input.bonusTitle, existing.bonus_cover_path, existing.bonus_pdf_path);
        if (blocked) return jsonError(req, 400, "cannot_enable_bonus", blocked);

        // Same existence re-check as the main PDF above, applied to the bonus PDF.
        const bonusObject = await env.BOOK_FILES.head(existing.bonus_pdf_path!);
        if (!bonusObject) {
          return jsonError(
            req,
            400,
            "cannot_enable_bonus",
            `Cannot enable the free bonus: the PDF recorded (${existing.bonus_pdf_path}) was not found in storage. Re-upload it.`,
          );
        }
      }

      await updateGuide(env, slug, input);
      const row = await getAdminGuide(env, input.slug);
      if (!row) throw new Error("update succeeded but row not found");
      return json(req, { guide: serializeGuideDetail(row, counts.paid, counts.total) });
    } catch (error) {
      console.error("admin/guides: update failed", error);
      return jsonError(req, 500, "server_error", "Could not update guide.");
    }
  }

  return methodNotAllowed(req, "GET, PUT");
}

export async function handleAdminGuideUnpublish(
  req: Request,
  env: WorkerEnv,
  slug: string,
): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed(req, "POST");

  const access = await requireAccess(req, env);
  if (!access.ok) return access.response;

  try {
    const changed = await unpublishGuide(env, slug);
    if (!changed) return jsonError(req, 404, "not_found", "No guide with that slug.");
    const row = await getAdminGuide(env, slug);
    if (!row) throw new Error("unpublish succeeded but row not found");
    const counts = await orderCountsForSlug(env, slug);
    return json(req, { guide: serializeGuideDetail(row, counts.paid, counts.total) });
  } catch (error) {
    console.error("admin/guides: unpublish failed", error);
    return jsonError(req, 500, "server_error", "Could not unpublish guide.");
  }
}
