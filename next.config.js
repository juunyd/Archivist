/**
 * A value that changes on every build. Next inlines it into the bundle, so
 * every render worker in one build sees the same string.
 *
 * lib/catalogue.ts sends it as a request header on the catalogue fetch, which
 * puts it in Next's fetch-cache key. Cloudflare restores `.next/cache` between
 * builds, and without this a build could serve itself a previous build's copy
 * of the shop — publishing a price change would appear to do nothing. Within a
 * single build the header is constant, so the catalogue is fetched once and
 * every page reads the same cached response.
 */
const catalogueRevision = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Cloudflare Pages serves static exports as directories with index.html;
  // trailingSlash keeps generated links and output file layout consistent
  // with that (out/terms/index.html instead of out/terms.html).
  trailingSlash: true,
  env: { CATALOGUE_REVISION: catalogueRevision },
};

module.exports = nextConfig;
