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
import { publishBlockedReason, validateGuideInput } from "../../lib/guide-validation";

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
        if (await slugExists(env, input.slug)) {
          return jsonError(req, 409, "slug_taken", `A guide with slug "${input.slug}" already exists.`);
        }
      }

      if (input.status === "published") {
        const blocked = publishBlockedReason(existing.cover_path, existing.pdf_path);
        if (blocked) return jsonError(req, 400, "cannot_publish", blocked);
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
