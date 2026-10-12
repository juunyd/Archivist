import { siteUrl, type WorkerEnv } from "./env";

/**
 * The buyer-facing download page. This is the only download link that ever
 * leaves the backend in an email or an API response — the actual PDF bytes
 * are only ever streamed by /api/download after it validates the token, and
 * only then, so nothing durable points at R2 directly.
 */
export const downloadUrlFor = (env: WorkerEnv, token: string): string =>
  `${siteUrl(env)}/download/?token=${token}`;

/**
 * Cover art for an email. There is no cover column in D1 — the marketing
 * site's covers live at /images/covers/{slug}.png, keyed by the same slug
 * as orders.book_slug, so this follows that convention rather than adding a
 * column that would just have to be kept in sync with the covers folder.
 */
export const coverUrlFor = (env: WorkerEnv, guideSlug: string): string =>
  `${siteUrl(env)}/images/covers/${guideSlug}.png`;

/** The buyer-facing bonus download — same token, same /api/download route, just a different file selector. */
export const bonusDownloadUrlFor = (env: WorkerEnv, token: string): string =>
  `${siteUrl(env)}/api/download?token=${token}&file=bonus`;

/**
 * Bonus cover art for an email. Unlike coverUrlFor above, this has no legacy
 * static-asset path to fall back to — bonus_cover_path is always a real,
 * already-correct R2-served path (/covers/{slug}-bonus.{ext}) once set, so
 * this just resolves it against the site origin.
 */
export const bonusCoverUrlFor = (env: WorkerEnv, bonusCoverPath: string): string =>
  `${siteUrl(env)}${bonusCoverPath}`;
