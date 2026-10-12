#!/usr/bin/env node
// Integration tests for the free-bonus-PDF feature.
//
// Same harness as scripts/test-admin-guides.mjs: runs the REAL bundled
// worker/index.ts inside Miniflare, against a fresh in-memory D1 (built from
// the actual committed migration files, now including 0011/0012) and R2
// bucket — never the live database or storage. Cloudflare Access's JWKS is
// intercepted the same way; Resend's API is additionally intercepted here so
// delivery/resend emails can be inspected without sending anything real.
//
// Run: node scripts/test-bonus.mjs
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
// See test-admin-guides.mjs's header for why multipart bodies need undici's
// FormData/File rather than Node's globals.
import undici from "undici";
const { FormData } = undici;
import * as esbuild from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
import { generateKeyPairSync, sign as cryptoSign, createHmac, randomUUID } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TEAM_DOMAIN = "autumn-snow-fc56.cloudflareaccess.com";
const AUD = "571be00718dd48f8043e00a92cbcef8ca24aa922c7f775ae21d2843367ab9aff";
const WEBHOOK_SECRET = "test-webhook-secret";

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

// --- Throwaway RSA keypair + JWKS for Access, same technique as test-admin-guides.mjs ---
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const KID = "test-key-1";
const jwks = { keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] };

function makeToken() {
  const header = b64url(JSON.stringify({ alg: "RS256", kid: KID }));
  const payload = b64url(
    JSON.stringify({
      iss: `https://${TEAM_DOMAIN}`,
      aud: AUD,
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: "tester@example.com",
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = b64url(cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey));
  return `${signingInput}.${signature}`;
}

const VALID_TOKEN = makeToken();

function webhookSignature(rawBody) {
  return createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

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

// --- Load every real migration file, in order, including 0011/0012 ---
function stripSqlLineComments(sql) {
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

const migrationsDir = join(ROOT, "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
// 0008's UPDATEs target specific production slugs that 0004 seeds under
// those exact names — matching zero rows here is documented, expected
// behaviour (see that migration's own header), not a test bug. No bonus
// test relies on any of 0004/0008's seeded content; every guide used below
// is created fresh through the real admin API.
const allStatements = migrationFiles.flatMap((f) => splitStatements(readFileSync(join(migrationsDir, f), "utf8")));

let capturedEmails = [];

const mf = new Miniflare(
  convertV4MiniflareOptions({
    name: "bonus",
    modules: true,
    script: workerScript,
    compatibilityDate: "2026-09-18",
    bindings: {
      SITE_URL: "https://archivist.in",
      EMAIL_FROM: "Archivist <noreply@archivist.in>",
      CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
      CF_ACCESS_AUD: AUD,
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      RESEND_API_KEY: "test-resend-key",
      // META_PIXEL_ID/META_CAPI_ACCESS_TOKEN deliberately left unset:
      // sendPurchaseEvent() returns early with no network call when either
      // is missing, so no outbound interception is needed for Meta here.
    },
    d1Databases: { DB: "test-bonus-db" },
    r2Buckets: { BOOK_FILES: "test-bonus-bucket" },
    serviceBindings: {
      ASSETS: () => new Response("Not found.", { status: 404 }),
    },
    outboundService(request) {
      const url = new URL(request.url);
      if (url.hostname === TEAM_DOMAIN && url.pathname === "/cdn-cgi/access/certs") {
        return new Response(JSON.stringify(jwks), { headers: { "content-type": "application/json" } });
      }
      if (url.origin === "https://api.resend.com" && request.method === "POST") {
        return request.json().then((body) => {
          capturedEmails.push(body);
          return new Response(JSON.stringify({ id: "test-email-id" }), {
            headers: { "content-type": "application/json" },
          });
        });
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

function adminFetch(path, { method = "GET", token = VALID_TOKEN, body, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  if (token) headers["Cf-Access-Jwt-Assertion"] = token;
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof Uint8Array)) {
    headers["Content-Type"] = "application/json";
  }
  return mf.dispatchFetch(`http://worker.local${path}`, {
    method,
    headers,
    body: body === undefined || body instanceof FormData || body instanceof Uint8Array ? body : JSON.stringify(body),
  });
}

function publicFetch(path, init) {
  return mf.dispatchFetch(`http://worker.local${path}`, init);
}

// Tiny valid PNG (1x1) and tiny real PDFs — just enough to pass the type/magic-byte checks.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const MAIN_PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("main guide pdf content\n")]);
const BONUS_PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("bonus pdf content\n")]);

function pngForm() {
  const form = new FormData();
  form.set("file", new Blob([PNG_1X1], { type: "image/png" }), "cover.png");
  return form;
}

const BASE_GUIDE_FIELDS = {
  subtitle: "A test subtitle",
  blurb: "A test blurb.",
  description: "A test description.",
  pricePaise: 34900,
  pageCount: 40,
  chapterCount: 10,
  whatsInside: [{ title: "Chapter one", description: "Covers the basics." }],
};

/** Creates a guide, uploads a real cover+PDF, and publishes it — the baseline every scenario starts from. */
async function createPublishedGuide(slug) {
  const createRes = await adminFetch("/api/admin/guides", {
    method: "POST",
    body: { ...BASE_GUIDE_FIELDS, slug, title: `Test guide ${slug}`, status: "draft" },
  });
  if (createRes.status !== 201) throw new Error(`setup: could not create ${slug}: ${await createRes.text()}`);

  await adminFetch(`/api/admin/guides/${slug}/cover`, { method: "POST", body: pngForm() });
  await adminFetch(`/api/admin/guides/${slug}/pdf`, {
    method: "POST",
    body: MAIN_PDF,
    headers: { "Content-Type": "application/pdf" },
  });

  const publishRes = await adminFetch(`/api/admin/guides/${slug}`, {
    method: "PUT",
    body: { ...BASE_GUIDE_FIELDS, slug, title: `Test guide ${slug}`, status: "published" },
  });
  if (publishRes.status !== 200) throw new Error(`setup: could not publish ${slug}: ${await publishRes.text()}`);
}

/** Uploads a bonus cover+PDF and switches the bonus on via the admin PUT — the normal, fully-gated path. */
async function addAndEnableBonus(slug, { bonusTitle = "Bonus checklist", bonusDescription = "A short bonus." } = {}) {
  await adminFetch(`/api/admin/guides/${slug}/bonus-cover`, { method: "POST", body: pngForm() });
  await adminFetch(`/api/admin/guides/${slug}/bonus-pdf`, {
    method: "POST",
    body: BONUS_PDF,
    headers: { "Content-Type": "application/pdf" },
  });
  const res = await adminFetch(`/api/admin/guides/${slug}`, {
    method: "PUT",
    body: { ...BASE_GUIDE_FIELDS, slug, title: `Test guide ${slug}`, status: "published", bonusTitle, bonusDescription, bonusEnabled: true },
  });
  if (res.status !== 200) throw new Error(`setup: could not enable bonus for ${slug}: ${await res.text()}`);
  return res.json();
}

/** Inserts an order directly via SQL — the same fixture technique test-admin-guides.mjs uses. */
async function insertOrder({ id, slug, status, email = "buyer@example.com" }) {
  const token = randomUUID();
  const razorpayOrderId = `rzp_${id}`;
  await db
    .prepare(
      `INSERT INTO orders (id, book_slug, amount_paise, razorpay_order_id, download_token, status, buyer_email)
       VALUES (?1, ?2, 34900, ?3, ?4, ?5, ?6)`,
    )
    .bind(id, slug, razorpayOrderId, token, status, email)
    .run();
  return { id, token, razorpayOrderId, email };
}

async function downloadCount(orderId) {
  const row = await db.prepare(`SELECT download_count FROM orders WHERE id = ?1`).bind(orderId).first();
  return row?.download_count ?? null;
}

async function bonusGranted(orderId) {
  const row = await db.prepare(`SELECT bonus_granted FROM orders WHERE id = ?1`).bind(orderId).first();
  return row?.bonus_granted ?? null;
}

try {
  // =====================================================================
  // 1. No-bonus guide: unchanged in every surface.
  // =====================================================================
  await createPublishedGuide("bonus-test-none");

  const catalogRes1 = await publicFetch("/api/catalog");
  const catalogBody1 = await catalogRes1.json();
  const noneInCatalog = catalogBody1.guides.find((g) => g.slug === "bonus-test-none");
  check("1a. no-bonus guide: /api/catalog has no bonus key", noneInCatalog != null && !("bonus" in noneInCatalog), JSON.stringify(noneInCatalog));

  const noneOrder = await insertOrder({ id: "order-none-paid", slug: "bonus-test-none", status: "paid" });
  const noneMainRes = await publicFetch(`/api/download?token=${noneOrder.token}`);
  check("1b. no-bonus guide: main download -> 200", noneMainRes.status === 200, `got ${noneMainRes.status}`);
  check("1c. no-bonus guide: no X-Bonus-Title header", noneMainRes.headers.get("x-bonus-title") === null);

  const noneBonusRes = await publicFetch(`/api/download?token=${noneOrder.token}&file=bonus`);
  const noneBonusBody = await noneBonusRes.json();
  check("1d. no-bonus guide: &file=bonus -> 404 bonus_not_available", noneBonusRes.status === 404 && noneBonusBody.error?.code === "bonus_not_available", `got ${noneBonusRes.status} ${JSON.stringify(noneBonusBody)}`);
  check("1e. no-bonus guide: download_count unaffected by the failed bonus call", (await downloadCount("order-none-paid")) === 1, `got ${await downloadCount("order-none-paid")}`);

  // =====================================================================
  // 2. Guide with a bonus: catalogue shows it, PDF path never leaks.
  // =====================================================================
  await createPublishedGuide("bonus-test-with");
  await addAndEnableBonus("bonus-test-with", { bonusTitle: "Free Checklist", bonusDescription: "A one-page checklist." });

  const catalogRes2 = await publicFetch("/api/catalog");
  const catalogText2 = await catalogRes2.text();
  const catalogBody2 = JSON.parse(catalogText2);
  const withInCatalog = catalogBody2.guides.find((g) => g.slug === "bonus-test-with");
  check(
    "2a. guide-with-bonus: /api/catalog includes bonus {title, description, coverPath}",
    withInCatalog?.bonus?.title === "Free Checklist" &&
      withInCatalog?.bonus?.description === "A one-page checklist." &&
      typeof withInCatalog?.bonus?.coverPath === "string",
    JSON.stringify(withInCatalog),
  );
  check(
    "2b. guide-with-bonus: raw catalogue JSON never contains the bonus PDF's R2 key",
    !catalogText2.includes("bonus-test-with-bonus.pdf"),
    "catalogue payload contained the bonus PDF key",
  );

  // =====================================================================
  // 3. Paid order sees two downloads (shared counter).
  // =====================================================================
  const withOrder = await insertOrder({ id: "order-with-paid", slug: "bonus-test-with", status: "paid" });
  const withMainRes = await publicFetch(`/api/download?token=${withOrder.token}`);
  check("3a. paid order: main download -> 200", withMainRes.status === 200, `got ${withMainRes.status}`);
  check("3b. paid order: X-Bonus-Title header set", withMainRes.headers.get("x-bonus-title") != null);

  const withBonusRes = await publicFetch(`/api/download?token=${withOrder.token}&file=bonus`);
  const withBonusBytes = Buffer.from(await withBonusRes.arrayBuffer());
  check("3c. paid order: &file=bonus -> 200", withBonusRes.status === 200, `got ${withBonusRes.status}`);
  check("3d. paid order: bonus response is the real bonus PDF bytes", withBonusBytes.equals(BONUS_PDF));
  check("3e. paid order: download_count is 2 (shared counter: 1 main + 1 bonus)", (await downloadCount("order-with-paid")) === 2, `got ${await downloadCount("order-with-paid")}`);

  // =====================================================================
  // 4. Unpaid order sees none.
  // =====================================================================
  const unpaidOrder = await insertOrder({ id: "order-with-unpaid", slug: "bonus-test-with", status: "created" });
  const unpaidMainRes = await publicFetch(`/api/download?token=${unpaidOrder.token}`);
  check("4a. unpaid order: main download -> not 200", unpaidMainRes.status !== 200, `got ${unpaidMainRes.status}`);
  const unpaidBonusRes = await publicFetch(`/api/download?token=${unpaidOrder.token}&file=bonus`);
  check("4b. unpaid order: &file=bonus -> not 200", unpaidBonusRes.status !== 200, `got ${unpaidBonusRes.status}`);
  check("4c. unpaid order: download_count stays 0", (await downloadCount("order-with-unpaid")) === 0, `got ${await downloadCount("order-with-unpaid")}`);

  // =====================================================================
  // 5. Bonus switched off later: a buyer already granted it keeps access;
  //    a buyer who never saw it (fresh order placed after the switch-off)
  //    does not get it.
  // =====================================================================
  const grandfatherOrder = await insertOrder({ id: "order-grandfather", slug: "bonus-test-with", status: "paid" });
  const grantRes = await publicFetch(`/api/download?token=${grandfatherOrder.token}&file=bonus`);
  check("5a. grandfather setup: bonus download succeeds while bonus is on", grantRes.status === 200, `got ${grantRes.status}`);
  check("5b. grandfather setup: bonus_granted recorded as 1", (await bonusGranted("order-grandfather")) === 1, `got ${await bonusGranted("order-grandfather")}`);

  const disableRes = await adminFetch("/api/admin/guides/bonus-test-with", {
    method: "PUT",
    body: { ...BASE_GUIDE_FIELDS, slug: "bonus-test-with", title: "Test guide bonus-test-with", status: "published", bonusEnabled: false },
  });
  check("5c. admin can switch the bonus off", disableRes.status === 200, `got ${disableRes.status}`);

  const grandfatherAfterRes = await publicFetch(`/api/download?token=${grandfatherOrder.token}&file=bonus`);
  check("5d. grandfathered buyer still gets the bonus after switch-off", grandfatherAfterRes.status === 200, `got ${grandfatherAfterRes.status}`);

  const freshAfterDisableOrder = await insertOrder({ id: "order-fresh-after-disable", slug: "bonus-test-with", status: "paid" });
  const freshAfterDisableRes = await publicFetch(`/api/download?token=${freshAfterDisableOrder.token}&file=bonus`);
  check("5e. a buyer never granted the bonus does not get it once it's off", freshAfterDisableRes.status === 404, `got ${freshAfterDisableRes.status}`);

  // Restore the bonus for the remaining scenarios (email checks reuse this guide).
  await adminFetch("/api/admin/guides/bonus-test-with", {
    method: "PUT",
    body: { ...BASE_GUIDE_FIELDS, slug: "bonus-test-with", title: "Test guide bonus-test-with", status: "published", bonusTitle: "Free Checklist", bonusDescription: "A one-page checklist.", bonusEnabled: true },
  });

  // =====================================================================
  // 6. Missing bonus file: the main guide download still works; only the
  //    bonus call fails, and it costs nothing (download_count untouched).
  // =====================================================================
  await createPublishedGuide("bonus-test-missing");
  await addAndEnableBonus("bonus-test-missing");
  // Point bonus_pdf_path at a key never actually put into R2 — same
  // bypass-the-API technique test-admin-guides.mjs uses for its equivalent
  // "recorded path, no real object" publish-gate test.
  await db
    .prepare(`UPDATE books SET bonus_pdf_path = 'bonus-test-missing/does-not-exist.pdf' WHERE slug = 'bonus-test-missing'`)
    .run();

  const missingOrder = await insertOrder({ id: "order-missing-bonus", slug: "bonus-test-missing", status: "paid" });
  const missingMainRes = await publicFetch(`/api/download?token=${missingOrder.token}`);
  const missingMainBytes = Buffer.from(await missingMainRes.arrayBuffer());
  check("6a. missing bonus file: main guide download still -> 200", missingMainRes.status === 200, `got ${missingMainRes.status}`);
  check("6b. missing bonus file: main guide bytes are correct", missingMainBytes.equals(MAIN_PDF));

  const missingBonusRes = await publicFetch(`/api/download?token=${missingOrder.token}&file=bonus`);
  const missingBonusBody = await missingBonusRes.json();
  check(
    "6c. missing bonus file: &file=bonus -> 404 bonus_file_unavailable",
    missingBonusRes.status === 404 && missingBonusBody.error?.code === "bonus_file_unavailable",
    `got ${missingBonusRes.status} ${JSON.stringify(missingBonusBody)}`,
  );
  check(
    "6d. missing bonus file: download_count incremented only once (the successful main call)",
    (await downloadCount("order-missing-bonus")) === 1,
    `got ${await downloadCount("order-missing-bonus")}`,
  );

  // =====================================================================
  // 7. Delivery email mentions the bonus, reached via a real signed webhook
  //    (no Razorpay API call happens on this path — webhook.ts reads the
  //    payment entity straight out of the signed payload).
  // =====================================================================
  const emailOrderId = "order-email-delivery";
  const emailToken = randomUUID();
  const razorpayOrderId = `rzp_${emailOrderId}`;
  await db
    .prepare(
      `INSERT INTO orders (id, book_slug, amount_paise, razorpay_order_id, download_token, status)
       VALUES (?1, 'bonus-test-with', 34900, ?2, ?3, 'created')`,
    )
    .bind(emailOrderId, razorpayOrderId, emailToken)
    .run();

  capturedEmails = [];
  const webhookPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_delivery",
          order_id: razorpayOrderId,
          amount: 34900,
          currency: "INR",
          status: "captured",
          email: "delivery-buyer@example.com",
          contact: null,
          method: "card",
        },
      },
    },
  });
  const webhookRes = await publicFetch("/api/webhooks/razorpay", {
    method: "POST",
    headers: { "X-Razorpay-Signature": webhookSignature(webhookPayload) },
    body: webhookPayload,
  });
  check("7a. signed webhook -> 200", webhookRes.status === 200, `got ${webhookRes.status}: ${await webhookRes.text()}`);
  check("7b. delivery email was sent (captured by the Resend intercept)", capturedEmails.length === 1, `captured ${capturedEmails.length}`);
  const deliveryEmail = capturedEmails[0];
  check(
    "7c. delivery email mentions the bonus title and a bonus download link",
    (deliveryEmail?.html ?? "").includes("Free Checklist") && (deliveryEmail?.html ?? "").includes("file=bonus"),
    JSON.stringify(deliveryEmail?.subject),
  );
  check(
    "7d. delivery email's plain-text body also mentions the bonus",
    (deliveryEmail?.text ?? "").includes("Free Checklist") && (deliveryEmail?.text ?? "").includes("file=bonus"),
  );

  // =====================================================================
  // 8. Resend-link email also mentions the bonus.
  // =====================================================================
  await insertOrder({ id: "order-resend", slug: "bonus-test-with", status: "paid", email: "resend-buyer@example.com" });

  capturedEmails = [];
  const resendRes = await publicFetch("/api/resend-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "resend-buyer@example.com" }),
  });
  check("8a. POST /api/resend-link -> 200", resendRes.status === 200, `got ${resendRes.status}`);
  check("8b. resend-link email was sent", capturedEmails.length === 1, `captured ${capturedEmails.length}`);
  const resendEmail = capturedEmails[0];
  check(
    "8c. resend-link email mentions the bonus title and a bonus download link",
    (resendEmail?.html ?? "").includes("Free Checklist") && (resendEmail?.html ?? "").includes("file=bonus"),
  );
} finally {
  await mf.dispose();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failing checks:", failures.join(", "));
  process.exit(1);
}
