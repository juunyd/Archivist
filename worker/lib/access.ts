// Verifies Cloudflare Access's JWT on every /api/admin/* request, so the API
// is protected even if someone reaches it without going through the /admin
// page (the Access policy on the page is the first gate; this is the second,
// enforced in code rather than trusted to stay configured correctly forever).
//
// Cloudflare Access puts the token in the Cf-Access-Jwt-Assertion header (set
// by the Access proxy itself, not forgeable by a visitor going through it) and
// signs it RS256 against a per-team JWKS at
// https://<team-domain>/cdn-cgi/access/certs. There is no JWT library in this
// project — everything else here (webhook signatures, CAPI hashing) already
// does its own Web Crypto, so this follows the same pattern instead of adding
// a dependency for one check.
import { requireEnv, type WorkerEnv } from "./env";

interface AccessJwk extends JsonWebKey {
  kid: string;
}

interface Jwks {
  keys: AccessJwk[];
}

// Module-scope cache: survives for as long as this isolate does, which is all
// the TTL this needs — a new isolate just fetches again. Keyed by team domain
// so a stale cache from one domain can't be served for another in the
// (never expected) case both are in play.
const jwksCache = new Map<string, { jwks: Jwks; fetchedAt: number }>();
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getJwks(teamDomain: string): Promise<Jwks> {
  const cached = jwksCache.get(teamDomain);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.jwks;
  }

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) {
    throw new Error(`access: could not fetch JWKS (${response.status})`);
  }
  const jwks = (await response.json()) as Jwks;
  jwksCache.set(teamDomain, { jwks, fetchedAt: Date.now() });
  return jwks;
}

function base64UrlToUint8Array(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(segment)));
}

export interface AccessIdentity {
  email: string | null;
}

type AccessVerification =
  | { ok: true; identity: AccessIdentity }
  | { ok: false; reason: string };

/**
 * Verifies the token's signature, issuer, audience and expiry. Does not
 * verify anything about *who* the email belongs to beyond what Access itself
 * already enforced in the policy the user configures — this only confirms
 * the token is genuinely Access's, for this app, and not expired.
 */
async function verifyAccessJwt(token: string, env: WorkerEnv): Promise<AccessVerification> {
  const teamDomain = requireEnv(env, "CF_ACCESS_TEAM_DOMAIN");
  const aud = requireEnv(env, "CF_ACCESS_AUD");

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed_token" };
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let header: { alg?: string; kid?: string };
  let payload: { aud?: string | string[]; iss?: string; exp?: number; email?: string };
  try {
    header = decodeJsonSegment(headerSeg) as typeof header;
    payload = decodeJsonSegment(payloadSeg) as typeof payload;
  } catch {
    return { ok: false, reason: "malformed_token" };
  }

  if (header.alg !== "RS256" || !header.kid) {
    return { ok: false, reason: "unsupported_alg" };
  }

  let jwks: Jwks;
  try {
    jwks = await getJwks(teamDomain);
  } catch (error) {
    console.error("access: JWKS fetch failed", error);
    return { ok: false, reason: "jwks_unavailable" };
  }

  let jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    // Key rotation: refetch once, bypassing the cache, before giving up.
    jwksCache.delete(teamDomain);
    try {
      jwks = await getJwks(teamDomain);
    } catch (error) {
      console.error("access: JWKS re-fetch failed", error);
      return { ok: false, reason: "jwks_unavailable" };
    }
    jwk = jwks.keys.find((key) => key.kid === header.kid);
  }
  if (!jwk) return { ok: false, reason: "unknown_key" };

  let publicKey: CryptoKey;
  try {
    publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch (error) {
    console.error("access: could not import JWKS key", error);
    return { ok: false, reason: "bad_key" };
  }

  const signedInput = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
  const signature = base64UrlToUint8Array(signatureSeg);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedInput,
  );
  if (!valid) return { ok: false, reason: "bad_signature" };

  const expectedIssuer = `https://${teamDomain}`;
  if (payload.iss !== expectedIssuer) return { ok: false, reason: "bad_issuer" };

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) return { ok: false, reason: "bad_audience" };

  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, identity: { email: payload.email ?? null } };
}

/**
 * Call at the top of every /api/admin/* handler. Returns the caller's
 * identity on success, or a ready-to-return 401 Response on failure — the
 * route never has to decide what the rejection looks like.
 */
export async function requireAccess(
  req: Request,
  env: WorkerEnv,
): Promise<{ ok: true; identity: AccessIdentity } | { ok: false; response: Response }> {
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    return { ok: false, response: unauthorized() };
  }

  let result: AccessVerification;
  try {
    result = await verifyAccessJwt(token, env);
  } catch (error) {
    console.error("access: verification threw", error);
    return { ok: false, response: unauthorized() };
  }

  if (!result.ok) {
    console.warn(`access: rejected token (${result.reason})`);
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, identity: result.identity };
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Unauthorized." } }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
