# Deploying Archivist to Cloudflare Workers

This project builds to a fully static export (`next build` with
`output: "export"` in [next.config.js](next.config.js)) — there is no Node
server at runtime. All backend logic (checkout, order status, email) lives
in Supabase Edge Functions, called directly from the browser. Cloudflare
Workers serves the exported files as static assets, per
[wrangler.jsonc](wrangler.jsonc)'s `assets` config — there is no Worker
script handling requests, just the `out/` directory.

## 1. Connect the repository

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create →
   Workers → Connect to Git** (Workers Builds).
3. Select the GitHub repo and branch (e.g. `main`) to deploy from.

## 2. Build configuration

When Cloudflare asks for build settings, use:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` (or the subfolder this project lives in, if monorepo) |

`npm run build` runs `next build`, which writes the static export to `out/`
— the directory [wrangler.jsonc](wrangler.jsonc)'s `assets.directory` points
at. `npx wrangler deploy` then publishes that directory as the Worker's
static assets; there is no separate build step for a Worker script.

Node version: set an environment variable `NODE_VERSION=20` (or later) in
the Workers project's build settings if Cloudflare doesn't already default
to a compatible version — this repo was built and tested against Node 24,
and requires at least Node 18.

## 3. Environment variables

In **Workers project → Settings → Variables and Secrets**, add the same
keys listed in [.env.example](.env.example) for both the **Production** and
**Preview** environments:

- `NEXT_PUBLIC_SITE_URL` — the deployed site's canonical URL (e.g.
  `https://archivist.in` for production, or the preview URL Cloudflare
  assigns for preview deployments).
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

All three are safe to expose publicly — they're inlined into the static
build and shipped to every visitor's browser. There is no
`NEXT_PUBLIC_RAZORPAY_KEY_ID` or equivalent: `create-order` returns the
Razorpay publishable key id alongside the order, so the browser learns it at
checkout time and no Razorpay identifier needs to be baked into the build.

**Never** add a secret key (Supabase `service_role` key, Razorpay key
secret, Resend API key, webhook signing secrets, etc.) here or anywhere in
this repo. Those are configured as Supabase Edge Function secrets instead
(`supabase secrets set ...`), which is a separate project entirely from this
Cloudflare Workers site.

Because `NEXT_PUBLIC_*` values are baked in at build time, changing one
requires a new deployment (redeploy, or push a commit) to take effect —
they cannot be changed at runtime.

## 4. Deploy

Trigger the first deploy (Cloudflare does this automatically after
connecting the repo). Every subsequent push to the connected branch
triggers a new build + deploy; pull requests get their own preview URL.

Cloudflare Workers serves `public/_headers` from the build output
automatically — it's already copied into `out/` by `next build`; no extra
configuration is needed for the security headers or `/images/*` caching
rule already defined in [public/_headers](public/_headers).

The custom 404 page ([app/not-found.tsx](app/not-found.tsx)) is exported to
`out/404.html`; [wrangler.jsonc](wrangler.jsonc)'s
`assets.not_found_handling: "404-page"` serves this file (with a 404
status) for any unmatched route.

## 5. Custom domain

1. In the Workers project, go to **Settings → Domains & Routes → Add**.
2. Enter the domain (e.g. `archivist.in`).
3. If the domain's DNS is already on Cloudflare, the route is added
   automatically. Otherwise, follow Cloudflare's instructions to point the
   domain (or subdomain) at the Worker.
4. Wait for DNS propagation and certificate issuance (usually a few
   minutes). Cloudflare provisions and renews the TLS certificate
   automatically.
5. Update `NEXT_PUBLIC_SITE_URL` in the Production environment variables to
   the final custom domain, and redeploy so metadata/Open Graph tags point
   at the right URL.

## Local build parity check

Before pushing, you can reproduce exactly what Cloudflare will build and
deploy:

```bash
npm ci
npm run build
npx wrangler dev     # serve out/ locally the way Workers will, or:
npx serve out         # any static file server, to spot-check the output
```

`npm run deploy` runs both `next build` and `npx wrangler deploy` in one
step, for a manual deploy outside the Git-connected flow.
