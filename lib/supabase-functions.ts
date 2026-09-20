/**
 * The only channel between this static site and the backend.
 *
 * Every call goes to a Supabase Edge Function with the anon key attached. The
 * anon key is public by design — it identifies the project, it does not grant
 * access. The tables have RLS on with no policies, so nothing here can read or
 * write data directly; the functions do that with a service role key that never
 * leaves the server.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export class FunctionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "FunctionError";
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

function endpoint(name: string): string {
  if (!SUPABASE_URL || !ANON_KEY) {
    // A misconfigured build should say so plainly rather than fail obscurely
    // on the buyer's first click.
    throw new FunctionError(
      "not_configured",
      "Checkout is not configured for this site. Please contact hello@archivist.in.",
    );
  }
  return `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/${name}`;
}

async function request<T>(name: string, init: RequestInit, query?: string): Promise<T> {
  const url = `${endpoint(name)}${query ?? ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        apikey: ANON_KEY as string,
        Authorization: `Bearer ${ANON_KEY as string}`,
      },
    });
  } catch {
    throw new FunctionError("network_error", "We could not reach the server. Check your connection and try again.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Fall through: a non-JSON body is handled as an unknown failure below.
  }

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new FunctionError(error?.code ?? "server_error", error?.message ?? GENERIC_MESSAGE);
  }

  return body as T;
}

export function postFunction<T>(name: string, payload: unknown): Promise<T> {
  return request<T>(name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getFunction<T>(name: string, params: Record<string, string>): Promise<T> {
  return request<T>(name, { method: "GET" }, `?${new URLSearchParams(params).toString()}`);
}
