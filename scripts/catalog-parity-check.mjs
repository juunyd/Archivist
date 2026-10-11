#!/usr/bin/env node
// Builds the static site twice — once from lib/guides.ts (GUIDES_SOURCE=legacy),
// once from /api/catalog (the default, see lib/catalog.ts) — and diffs the
// homepage and all four guide pages' generated HTML. The two builds must
// produce identical markup apart from build-specific noise (Next's build id,
// hashed chunk/font filenames, and React's useId roots), normalized out below
// before comparing.
//
// Run: node scripts/catalog-parity-check.mjs
//
// This is the gate for deleting lib/guides.ts (Phase 2, item 4 of the amended
// brief): only delete it, in its own commit, once this prints "PARITY OK".
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = join(ROOT, "out");
const PARITY_DIR = join(ROOT, ".parity");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://archivist.in";

const PAGES = [
  "index.html",
  "i-lost-money-in-fno/index.html",
  "the-revenge-trading-cure/index.html",
  "should-i-quit-trading/index.html",
  "the-comeback-plan/index.html",
];

function run(label, env) {
  console.log(`\n--- Building: ${label} (NEXT_PUBLIC_SITE_URL=${SITE_URL}) ---`);
  rmSync(join(ROOT, ".next"), { recursive: true, force: true });
  rmSync(OUT_DIR, { recursive: true, force: true });
  const result = spawnSync("npx", ["next", "build"], {
    cwd: ROOT,
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: SITE_URL, ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`\nBuild failed for ${label}.`);
    process.exit(1);
  }
}

// Strips exactly the per-build noise this project is known to produce:
// hashed /_next chunk and font filenames, Next's internal build id, the
// cache-busted icon query string, and React useId() roots (deterministic by
// tree shape, but normalized anyway as a safety margin). Everything else —
// every word of guide copy, every price, every FAQ answer — must match
// byte-for-byte after this.
function normalize(html) {
  return html
    .replace(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.(js|css)/g, "/_next/static/chunks/<chunk>.$1")
    .replace(/\/_next\/static\/media\/[A-Za-z0-9_.-]+\.(woff2?|ttf|otf)/g, "/_next/static/media/<font>.$1")
    // Next's internal per-build id, embedded inside the RSC flight-data
    // script tag as an escaped JSON string (literal bytes: \"b\":\"...\"),
    // not a bare "b":"..." — the backslashes must be matched too.
    .replace(/\\?"b\\?":\\?"[^"\\]+\\?"/g, '"b":"<buildid>"')
    .replace(/icon\.png\?icon\.[^"]+"/g, 'icon.png?icon.<hash>"')
    .replace(/_R_[A-Za-z0-9]+_/g, "_R_<id>_")
    // Next's empty, invisible font-layout-shift meta tag. Its position in
    // <head> (and in the flight-data copy of <head>) shifts by a tag or two
    // depending on async scheduling — switching the legacy path from a
    // synchronous array read to an awaited Promise.resolve() (so both paths
    // go through the same async getGuideBySlug()) is enough to perturb it.
    // It carries no content (content="") and renders nothing, so it's noise
    // in the same category as a build id, not a real page difference.
    .replace(/<meta name="next-size-adjust" content=""\/>/g, "")
    .replace(/,?\[\\"\$\\",\\"meta\\",null,\{\\"name\\":\\"next-size-adjust\\",\\"content\\":\\"\\"\}\]/g, "");
}

function firstDiffContext(a, b) {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  const start = Math.max(0, i - 80);
  return {
    legacy: a.slice(start, i + 160),
    catalog: b.slice(start, i + 160),
    at: i,
  };
}

if (existsSync(PARITY_DIR)) rmSync(PARITY_DIR, { recursive: true, force: true });
mkdirSync(PARITY_DIR, { recursive: true });

run("legacy (lib/guides.ts)", { GUIDES_SOURCE: "legacy" });
rmSync(join(PARITY_DIR, "legacy"), { recursive: true, force: true });
cpSync(OUT_DIR, join(PARITY_DIR, "legacy"));

run("catalog (/api/catalog)", { GUIDES_SOURCE: "" });
rmSync(join(PARITY_DIR, "catalog"), { recursive: true, force: true });
cpSync(OUT_DIR, join(PARITY_DIR, "catalog"));

console.log("\n--- Diffing ---");
let allPass = true;
for (const page of PAGES) {
  const legacyPath = join(PARITY_DIR, "legacy", page);
  const catalogPath = join(PARITY_DIR, "catalog", page);
  const legacyHtml = normalize(readFileSync(legacyPath, "utf8"));
  const catalogHtml = normalize(readFileSync(catalogPath, "utf8"));

  if (legacyHtml === catalogHtml) {
    console.log(`PASS  ${page}`);
    continue;
  }

  allPass = false;
  console.log(`FAIL  ${page}`);
  const { legacy, catalog, at } = firstDiffContext(legacyHtml, catalogHtml);
  console.log(`  first difference at normalized offset ${at}:`);
  console.log(`  legacy:  ...${legacy}...`);
  console.log(`  catalog: ...${catalog}...`);
  writeFileSync(join(PARITY_DIR, `${page.replace(/\//g, "_")}.legacy.html`), legacyHtml);
  writeFileSync(join(PARITY_DIR, `${page.replace(/\//g, "_")}.catalog.html`), catalogHtml);
}

console.log(allPass ? "\nPARITY OK\n" : "\nPARITY FAILED — see .parity/ for normalized HTML\n");
process.exit(allPass ? 0 : 1);

// Imported here (not at top) only to keep the diff-focused imports grouped above.
function cpSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  spawnSync("cp", ["-R", `${src}/.`, dest], { stdio: "inherit" });
}
