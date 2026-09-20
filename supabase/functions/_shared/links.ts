import { siteUrl } from "./env.ts";

/**
 * The buyer-facing download page. This is the only download link that ever
 * leaves the backend in an email or an API response — signed storage URLs are
 * minted per visit by get-download and expire in minutes.
 */
export const downloadUrlFor = (token: string): string =>
  `${siteUrl()}/download/?token=${token}`;
