import { siteUrl, type WorkerEnv } from "./env";

/**
 * The buyer-facing download page. This is the only download link that ever
 * leaves the backend in an email or an API response — the actual PDF bytes
 * are only ever streamed by /api/download after it validates the token, and
 * only then, so nothing durable points at R2 directly.
 */
export const downloadUrlFor = (env: WorkerEnv, token: string): string =>
  `${siteUrl(env)}/download/?token=${token}`;
