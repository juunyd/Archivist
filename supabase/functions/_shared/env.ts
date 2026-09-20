/** Reads a required secret, failing loudly at cold start rather than mid-payment. */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) || fallback;
}

/** Canonical site origin, used to build download links in emails. */
export const siteUrl = (): string =>
  optionalEnv("SITE_URL", "https://archivist.in").replace(/\/+$/, "");

export const emailFrom = (): string =>
  optionalEnv("EMAIL_FROM", "Archivist <books@archivist.in>");

export const supportEmail = "hello@archivist.in";
