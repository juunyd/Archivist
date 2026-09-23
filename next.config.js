/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Cloudflare Pages serves static exports as directories with index.html;
  // trailingSlash keeps generated links and output file layout consistent
  // with that (out/terms/index.html instead of out/terms.html).
  trailingSlash: true,
};

module.exports = nextConfig;
