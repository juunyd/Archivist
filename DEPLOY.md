# Deploying Archivist to Cloudflare Pages

This project builds to a fully static export (`next build` with
`output: "export"` in [next.config.js](next.config.js)) — there is no Node
server at runtime. All backend logic (checkout, order status, email) lives
in Supabase Edge Functions, called directly from the browser. Cloudflare
Pages only ever serves static files.

## 1. Connect the repository

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages →
   Connect to Git**.
3. Select the GitHub repo and branch (e.g. `main`) to deploy from.

## 2. Build configuration

When Cloudflare asks for a framework preset and build settings, use:

| Setting | Value |
|---|---|
| Framework preset | **Next.js (Static HTML Export)** |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | `/` (or the subfolder this project lives in, if monorepo) |

Node version: set an environment variable `NODE_VERSION=20` (or later) in
the Pages project's build settings if Cloudflare doesn't already default to
a compatible version — this repo was built and tested against Node 24, and
requires at least Node 18.

## 3. Environment variables

In **Pages project → Settings → Environment variables**, add the same keys
listed in [.env.example](.env.example) for both the **Production** and
**Preview** environments:

- `NEXT_PUBLIC_SITE_URL` — the deployed site's canonical URL (e.g.
  `https://archivist.in` for production, or the `*.pages.dev` preview URL
  for preview deployments).
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

All four are safe to expose publicly — they're inlined into the static
build and shipped to every visitor's browser. **Never** add a secret key
(Supabase `service_role` key, Razorpay key secret, Resend API key, webhook
signing secrets, etc.) here or anywhere in this repo. Those are configured
as Supabase Edge Function secrets instead (`supabase secrets set ...`),
which is a separate project entirely from this Cloudflare Pages site.

Because `NEXT_PUBLIC_*` values are baked in at build time, changing one
requires a new deployment (redeploy, or push a commit) to take effect —
they cannot be changed at runtime.

## 4. Deploy

Trigger the first deploy (Cloudflare does this automatically after
connecting the repo). Every subsequent push to the connected branch
triggers a new build + deploy; pull requests get their own preview URL.

Cloudflare Pages serves `public/_headers` and `public/_redirects` from the
build output automatically — both are already copied into `out/` by
`next build`; no extra configuration is needed for the security headers or
`/images/*` caching rule already defined in
[public/_headers](public/_headers).

The custom 404 page ([app/not-found.tsx](app/not-found.tsx)) is exported to
`out/404.html`; Cloudflare Pages automatically serves this file (with a 404
status) for any unmatched route.

## 5. Custom domain

1. In the Pages project, go to **Custom domains → Set up a custom domain**.
2. Enter the domain (e.g. `archivist.in`).
3. If the domain's DNS is already on Cloudflare, the CNAME record is added
   automatically. Otherwise, add the CNAME record Cloudflare shows you at
   your DNS provider, pointing the domain (or subdomain) at
   `<project-name>.pages.dev`.
4. Wait for DNS propagation and certificate issuance (usually a few
   minutes). Cloudflare provisions and renews the TLS certificate
   automatically.
5. Update `NEXT_PUBLIC_SITE_URL` in the Production environment variables to
   the final custom domain, and redeploy so metadata/Open Graph tags point
   at the right URL.

## Local build parity check

Before pushing, you can reproduce exactly what Cloudflare will build:

```bash
npm ci
npm run build
npx serve out   # or any static file server, to spot-check the output
```
