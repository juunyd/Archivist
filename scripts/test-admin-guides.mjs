#!/usr/bin/env node
// Integration tests for the admin guides API (Phase 3).
//
// Runs the REAL bundled worker/index.ts inside Miniflare (the same engine
// `wrangler dev` uses), against a fresh in-memory D1 database and R2 bucket
// built from the actual committed migration files — never the live
// database or live storage. Cloudflare Access's JWKS endpoint is
// intercepted via Miniflare's `outboundService` hook and replaced with a
// JWKS this script controls, signed with a throwaway RSA keypair generated
// for the run — so requireAccess() runs its real signature/issuer/
// audience/expiry checks against a genuine token, not a stubbed-out path.
//
// Run: node scripts/test-admin-guides.mjs
//
// Organised in one section per admin-guides Step (Step 1: CRUD, Step 2:
// uploads, ...) so later Phase 3 steps can extend this file rather than
// starting a new harness each time.
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
// Miniflare's dispatchFetch constructs its Request using its own bundled
// copy of `undici`, not Node's global fetch classes — Node's built-in
// global FormData/File are a *different* class from undici's, so a
// multipart body built with the globals silently fails `instanceof`
// checks deep inside Miniflare and never gets a correct boundary. Build
// multipart bodies with these instead of the global FormData/File.
import undici from "undici";
const { FormData } = undici;
// Blob isn't realm-split the way File/FormData are — Node's global Blob
// works fine as a FormData value here (confirmed: it round-trips through
// undici's own FormData/Request correctly), so there's no need for an
// undici-specific Blob.
import * as esbuild from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TEAM_DOMAIN = "autumn-snow-fc56.cloudflareaccess.com";
const AUD = "571be00718dd48f8043e00a92cbcef8ca24aa922c7f775ae21d2843367ab9aff";

let passed = 0;
let failed = 0;
const failures = [];

function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64url");
}

// --- Throwaway RSA keypair + JWKS, matching worker/lib/access.ts's expectations ---
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const KID = "test-key-1";
const jwks = { keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] };

function makeToken({
  aud = AUD,
  iss = `https://${TEAM_DOMAIN}`,
  exp = Math.floor(Date.now() / 1000) + 3600,
  email = "tester@example.com",
  kid = KID,
  badSignature = false,
} = {}) {
  const header = b64url(JSON.stringify({ alg: "RS256", kid }));
  const payload = b64url(JSON.stringify({ iss, aud, exp, email }));
  const signingInput = `${header}.${payload}`;
  const sigKey = badSignature ? generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey : privateKey;
  const signature = b64url(cryptoSign("RSA-SHA256", Buffer.from(signingInput), sigKey));
  return `${signingInput}.${signature}`;
}

const VALID_TOKEN = makeToken();

// --- Bundle the real worker entrypoint ---
const bundle = await esbuild.build({
  entryPoints: [join(ROOT, "worker/index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  write: false,
  absWorkingDir: ROOT,
});
const workerScript = bundle.outputFiles[0].text;

// --- Load the real migration SQL, split into statements ---
function stripSqlLineComments(sql) {
  // A `--` comment can itself contain a semicolon (several of these
  // migration files' header comments do), which would otherwise split a
  // comment line in two and leak its tail in as bare SQL. Strip comments
  // first, then split.
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

function splitStatements(sql) {
  return stripSqlLineComments(sql)
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 0004_seed_books.sql seeds four placeholder slugs that are stale — not the
// real production catalogue (0008's own header comment notes its UPDATEs
// simply match zero rows against a DB that never had the real slugs
// inserted; production got them via a manual corrective INSERT outside the
// migration history). So: skip 0004, and insert the four real production
// base rows ourselves, in its place, before 0008's UPDATEs run.
const migrationsDir = join(ROOT, "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && f !== "0004_seed_books.sql")
  .sort();

const REAL_SLUGS = ["i-lost-money-in-fno", "the-revenge-trading-cure", "should-i-quit-trading", "the-comeback-plan"];
const realBooksInsert = `INSERT INTO books (slug, title, price_paise, currency, pdf_path, status) VALUES ${REAL_SLUGS.map(
  (slug) => `('${slug}', 'Test title: ${slug}', 34900, 'INR', '${slug}/${slug}.pdf', 'published')`,
).join(", ")}`;

const allStatements = migrationFiles.flatMap((f) => {
  const statements = splitStatements(readFileSync(join(migrationsDir, f), "utf8"));
  return f.startsWith("0008_") ? [realBooksInsert, ...statements] : statements;
});

// --- Start Miniflare with a fresh in-memory D1 + R2, JWKS intercepted ---
const mf = new Miniflare(
  convertV4MiniflareOptions({
    name: "main",
    modules: true,
    script: workerScript,
    compatibilityDate: "2026-09-18",
    bindings: {
      SITE_URL: "https://archivist.in",
      EMAIL_FROM: "Archivist <noreply@archivist.in>",
      CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
      CF_ACCESS_AUD: AUD,
    },
    d1Databases: { DB: "test-admin-guides-db" },
    r2Buckets: { BOOK_FILES: "test-admin-guides-bucket" },
    outboundService(request) {
      const url = new URL(request.url);
      if (url.hostname === TEAM_DOMAIN && url.pathname === "/cdn-cgi/access/certs") {
        return new Response(JSON.stringify(jwks), { headers: { "content-type": "application/json" } });
      }
      return new Response("unexpected outbound request in test", { status: 502 });
    },
  }),
);

await mf.ready;
const db = await mf.getD1Database("DB");

for (const stmt of allStatements) {
  await db.prepare(stmt).run();
}

// A fake order so one guide has order history, without touching production.
await db
  .prepare(
    `INSERT INTO orders (id, book_slug, amount_paise, razorpay_order_id, download_token, status)
     VALUES ('test-order-1', 'i-lost-money-in-fno', 34900, 'rzp_test_order_1', 'test-download-token-1', 'created')`,
  )
  .run();

function adminFetch(path, { method = "GET", token = VALID_TOKEN, body, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  if (token) headers["Cf-Access-Jwt-Assertion"] = token;
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof Uint8Array)) {
    headers["Content-Type"] = "application/json";
  }
  return mf.dispatchFetch(`http://worker.local${path}`, {
    method,
    headers,
    body:
      body === undefined || body instanceof FormData || body instanceof Uint8Array ? body : JSON.stringify(body),
  });
}

try {
  // =====================================================================
  // Step 1: list, detail, create, publish gate, slug lock, unpublish, auth
  // =====================================================================

  const listRes = await adminFetch("/api/admin/guides");
  const listBody = await listRes.json();
  check("1a. GET /api/admin/guides -> 200", listRes.status === 200, `got ${listRes.status}`);
  check(
    "1b. list contains the 4 seeded guides",
    Array.isArray(listBody.guides) && REAL_SLUGS.every((slug) => listBody.guides.some((g) => g.slug === slug)),
    JSON.stringify(listBody.guides?.map((g) => g.slug)),
  );

  const detailRes = await adminFetch("/api/admin/guides/i-lost-money-in-fno");
  const detailBody = await detailRes.json();
  check("1c. GET /api/admin/guides/:slug -> 200", detailRes.status === 200, `got ${detailRes.status}`);
  check(
    "1d. detail has full content fields",
    detailBody.guide?.slug === "i-lost-money-in-fno" &&
      Array.isArray(detailBody.guide?.whatsInside) &&
      detailBody.guide.whatsInside.length > 0 &&
      Array.isArray(detailBody.guide?.faqs) &&
      detailBody.guide.faqs.length > 0,
    JSON.stringify(detailBody.guide),
  );
  check("1e. detail reports slugLocked (has orders)", detailBody.guide?.slugLocked === true, JSON.stringify(detailBody.guide));

  const newGuideBody = {
    slug: "test-guide-automated",
    title: "Automated Test Guide",
    subtitle: "A guide created by an automated test",
    blurb: "Short blurb for the automated test guide.",
    description: "Longer description for the automated test guide.",
    pricePaise: 9900,
    pageCount: 20,
    chapterCount: 5,
    whatsInside: [{ title: "Chapter one", description: "Covers the basics." }],
    faqs: [{ question: "Is this real?", answer: "No, it's a test fixture." }],
    status: "draft",
  };
  const createRes = await adminFetch("/api/admin/guides", { method: "POST", body: newGuideBody });
  const createBody = await createRes.json();
  check("2a. POST /api/admin/guides -> 201", createRes.status === 201, `got ${createRes.status}: ${JSON.stringify(createBody)}`);
  check("2b. created guide is a draft", createBody.guide?.status === "draft", JSON.stringify(createBody.guide));

  const publishAttempt = { ...newGuideBody, status: "published" };
  const publishRes = await adminFetch("/api/admin/guides/test-guide-automated", { method: "PUT", body: publishAttempt });
  const publishBody = await publishRes.json();
  check("3a. PUT with status=published on a cover/PDF-less guide -> 400", publishRes.status === 400, `got ${publishRes.status}`);
  check("3b. error code is cannot_publish", publishBody.error?.code === "cannot_publish", JSON.stringify(publishBody));

  const existing = detailBody.guide;
  const renameAttempt = {
    slug: "renamed-guide",
    title: existing.title,
    subtitle: existing.subtitle,
    blurb: existing.blurb,
    description: existing.description,
    pricePaise: existing.pricePaise,
    compareAtPricePaise: existing.compareAtPricePaise,
    pageCount: existing.pageCount,
    chapterCount: existing.chapterCount,
    whatsInside: existing.whatsInside,
    faqs: existing.faqs,
    badge: existing.badge,
    status: existing.status,
    sortOrder: existing.sortOrder,
  };
  const renameRes = await adminFetch("/api/admin/guides/i-lost-money-in-fno", { method: "PUT", body: renameAttempt });
  const renameBody = await renameRes.json();
  check("4a. PUT changing slug on a guide with orders -> 409", renameRes.status === 409, `got ${renameRes.status}`);
  check("4b. error code is slug_locked", renameBody.error?.code === "slug_locked", JSON.stringify(renameBody));

  const stillThereRes = await adminFetch("/api/admin/guides/i-lost-money-in-fno");
  check("4c. original slug still resolves after rejected rename", stillThereRes.status === 200, `got ${stillThereRes.status}`);

  const unpublishRes = await adminFetch("/api/admin/guides/i-lost-money-in-fno/unpublish", { method: "POST" });
  const unpublishBody = await unpublishRes.json();
  check("5a. POST .../unpublish -> 200", unpublishRes.status === 200, `got ${unpublishRes.status}`);
  check("5b. guide status is now draft", unpublishBody.guide?.status === "draft", JSON.stringify(unpublishBody.guide));

  check("6a. no token -> 401", (await adminFetch("/api/admin/guides", { token: null })).status === 401);
  check("6b. malformed token -> 401", (await adminFetch("/api/admin/guides", { token: "not.a.jwt" })).status === 401);
  check(
    "6c. token signed by the wrong key -> 401",
    (await adminFetch("/api/admin/guides", { token: makeToken({ badSignature: true }) })).status === 401,
  );
  check(
    "6d. token with wrong audience -> 401",
    (await adminFetch("/api/admin/guides", { token: makeToken({ aud: "wrong-audience" }) })).status === 401,
  );
  check(
    "6e. expired token -> 401",
    (await adminFetch("/api/admin/guides", { token: makeToken({ exp: Math.floor(Date.now() / 1000) - 10 }) })).status === 401,
  );
  check("6f. sanity: valid token still returns 200", (await adminFetch("/api/admin/guides")).status === 200);

  // =====================================================================
  // Step 2: cover + PDF uploads, publish-gate storage check, slug lock by PDF
  // =====================================================================

  // A tiny valid PNG (1x1, transparent) and a tiny PDF with a real %PDF
  // signature — just enough to exercise the type/magic-byte checks.
  const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  const FAKE_PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("fake pdf content for testing\n")]);

  function pngForm() {
    const form = new FormData();
    form.set("file", new Blob([PNG_1X1], { type: "image/png" }), "cover.png");
    return form;
  }

  // 7. Cover upload: happy path + bad type + oversize.
  const coverRes = await adminFetch("/api/admin/guides/test-guide-automated/cover", { method: "POST", body: pngForm() });
  const coverBody = await coverRes.json();
  check("7a. POST .../cover (valid PNG) -> 200", coverRes.status === 200, `got ${coverRes.status}: ${JSON.stringify(coverBody)}`);
  check(
    "7b. coverPath recorded as /covers/<slug>.png",
    coverBody.guide?.coverPath === "/covers/test-guide-automated.png",
    JSON.stringify(coverBody.guide),
  );

  const badTypeForm = new FormData();
  badTypeForm.set("file", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "cover.txt");
  const badTypeRes = await adminFetch("/api/admin/guides/test-guide-automated/cover", { method: "POST", body: badTypeForm });
  check("7c. cover with unsupported type -> 415", badTypeRes.status === 415, `got ${badTypeRes.status}`);

  const oversizedForm = new FormData();
  oversizedForm.set("file", new Blob([Buffer.alloc(2 * 1024 * 1024 + 1, 1)], { type: "image/png" }), "cover.png");
  const oversizedRes = await adminFetch("/api/admin/guides/test-guide-automated/cover", { method: "POST", body: oversizedForm });
  check("7d. oversized cover (>2MB) -> 413", oversizedRes.status === 413, `got ${oversizedRes.status}`);

  // 8. Cover serving route: happy path, ETag/conditional GET, 404 for unknown file.
  const serveRes = await adminFetch("/covers/test-guide-automated.png", { token: null });
  check("8a. GET /covers/:file -> 200", serveRes.status === 200, `got ${serveRes.status}`);
  check(
    "8b. serves with long Cache-Control and an ETag",
    (serveRes.headers.get("cache-control") ?? "").includes("max-age=31536000") && !!serveRes.headers.get("etag"),
    `cache-control=${serveRes.headers.get("cache-control")} etag=${serveRes.headers.get("etag")}`,
  );
  const etag = serveRes.headers.get("etag");
  const conditionalRes = await adminFetch("/covers/test-guide-automated.png", {
    token: null,
    headers: { "If-None-Match": etag },
  });
  check("8c. conditional GET with matching ETag -> 304", conditionalRes.status === 304, `got ${conditionalRes.status}`);
  const missingCoverRes = await adminFetch("/covers/does-not-exist.png", { token: null });
  check("8d. unknown cover file -> 404", missingCoverRes.status === 404, `got ${missingCoverRes.status}`);

  // 9. PDF upload: happy path, bad magic bytes, wrong content-type, oversize, overwrite confirm.
  const pdfRes = await adminFetch("/api/admin/guides/test-guide-automated/pdf", {
    method: "POST",
    body: FAKE_PDF,
    headers: { "Content-Type": "application/pdf" },
  });
  const pdfBody = await pdfRes.json();
  check("9a. POST .../pdf (valid %PDF) -> 200", pdfRes.status === 200, `got ${pdfRes.status}: ${JSON.stringify(pdfBody)}`);
  check(
    "9b. pdfPath recorded as <slug>/<slug>.pdf",
    pdfBody.guide?.pdfPath === "test-guide-automated/test-guide-automated.pdf",
    JSON.stringify(pdfBody.guide),
  );

  const notAPdf = Buffer.from("this is definitely not a pdf");
  const badMagicRes = await adminFetch("/api/admin/guides/test-guide-automated/pdf", {
    method: "POST",
    body: notAPdf,
    headers: { "Content-Type": "application/pdf" },
  });
  check("9c. body without %PDF signature -> 400 invalid_pdf", badMagicRes.status === 400, `got ${badMagicRes.status}`);

  const wrongTypeRes = await adminFetch("/api/admin/guides/test-guide-automated/pdf", {
    method: "POST",
    body: FAKE_PDF,
    headers: { "Content-Type": "application/octet-stream" },
  });
  check("9d. wrong Content-Type -> 415", wrongTypeRes.status === 415, `got ${wrongTypeRes.status}`);

  const oversizedPdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(25 * 1024 * 1024, 1)]);
  const oversizedPdfRes = await adminFetch("/api/admin/guides/test-guide-automated/pdf", {
    method: "POST",
    body: oversizedPdf,
    headers: { "Content-Type": "application/pdf" },
  });
  check("9e. oversized PDF (>25MB) -> 413", oversizedPdfRes.status === 413, `got ${oversizedPdfRes.status}`);

  // Re-uploading without ?confirm=true must be refused — this guide already has a PDF.
  const noConfirmRes = await adminFetch("/api/admin/guides/test-guide-automated/pdf", {
    method: "POST",
    body: FAKE_PDF,
    headers: { "Content-Type": "application/pdf" },
  });
  const noConfirmBody = await noConfirmRes.json();
  check("9f. re-upload without confirm -> 409 pdf_exists", noConfirmRes.status === 409, `got ${noConfirmRes.status}`);
  check("9g. error code is pdf_exists", noConfirmBody.error?.code === "pdf_exists", JSON.stringify(noConfirmBody));

  const withConfirmRes = await adminFetch("/api/admin/guides/test-guide-automated/pdf?confirm=true", {
    method: "POST",
    body: FAKE_PDF,
    headers: { "Content-Type": "application/pdf" },
  });
  check("9h. re-upload with ?confirm=true -> 200", withConfirmRes.status === 200, `got ${withConfirmRes.status}`);

  // 10. Now that it has a real cover + PDF, publishing should succeed.
  const publishNowRes = await adminFetch("/api/admin/guides/test-guide-automated", {
    method: "PUT",
    body: publishAttempt,
  });
  const publishNowBody = await publishNowRes.json();
  check(
    "10a. publish succeeds once cover + PDF are really in storage -> 200",
    publishNowRes.status === 200,
    `got ${publishNowRes.status}: ${JSON.stringify(publishNowBody)}`,
  );
  check("10b. guide is now published", publishNowBody.guide?.status === "published", JSON.stringify(publishNowBody.guide));

  // 11. A guide with a PDF cannot have its slug changed, even with zero orders.
  const pdfSlugRenameAttempt = { ...publishAttempt, slug: "renamed-test-guide" };
  const pdfSlugRenameRes = await adminFetch("/api/admin/guides/test-guide-automated", {
    method: "PUT",
    body: pdfSlugRenameAttempt,
  });
  const pdfSlugRenameBody = await pdfSlugRenameRes.json();
  check("11a. slug change blocked by PDF presence (zero orders) -> 409", pdfSlugRenameRes.status === 409, `got ${pdfSlugRenameRes.status}`);
  check("11b. error code is slug_locked", pdfSlugRenameBody.error?.code === "slug_locked", JSON.stringify(pdfSlugRenameBody));

  // 12. Publish gate checks the file is REALLY in storage, not just that a path is saved.
  // Point pdf_path at a key that was never actually put into R2 (bypassing the API, the
  // way a corrupted row or a failed upload might) and confirm publishing is blocked.
  await db
    .prepare(`UPDATE books SET pdf_path = 'test-guide-automated/missing.pdf' WHERE slug = 'test-guide-automated'`)
    .run();
  const missingObjectPublishRes = await adminFetch("/api/admin/guides/test-guide-automated", {
    method: "PUT",
    body: publishAttempt,
  });
  const missingObjectPublishBody = await missingObjectPublishRes.json();
  check(
    "12a. saved pdf_path with no matching R2 object -> 400 cannot_publish",
    missingObjectPublishRes.status === 400,
    `got ${missingObjectPublishRes.status}`,
  );
  check(
    "12b. error mentions storage, not just a missing path",
    (missingObjectPublishBody.error?.message ?? "").toLowerCase().includes("storage"),
    JSON.stringify(missingObjectPublishBody),
  );
  // Restore the real pdf_path so later assertions aren't affected.
  await db
    .prepare(`UPDATE books SET pdf_path = 'test-guide-automated/test-guide-automated.pdf' WHERE slug = 'test-guide-automated'`)
    .run();

  // 13. CORS no longer advertises PUT (admin pages are same-origin; it was never needed).
  const preflightRes = await mf.dispatchFetch("http://worker.local/api/admin/guides", {
    method: "OPTIONS",
    headers: { Origin: "https://archivist.in", "Access-Control-Request-Method": "PUT" },
  });
  const allowedMethods = preflightRes.headers.get("access-control-allow-methods") ?? "";
  check(
    "13a. preflight Access-Control-Allow-Methods excludes PUT",
    !allowedMethods.split(",").map((m) => m.trim()).includes("PUT"),
    `got "${allowedMethods}"`,
  );
  check("13b. preflight still allows GET and POST", allowedMethods.includes("GET") && allowedMethods.includes("POST"), `got "${allowedMethods}"`);
} finally {
  await mf.dispose();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failing checks:", failures.join(", "));
  process.exit(1);
}
