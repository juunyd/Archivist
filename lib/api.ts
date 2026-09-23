/**
 * The only channel between this static site and the backend.
 *
 * Every call goes to a same-origin `/api/*` route on the Worker that also
 * serves this static export (see worker/index.ts) — no separate host, no
 * anon key, no CORS round trip for a same-origin request. The Worker reaches
 * D1 and R2 with bindings that never leave the server; nothing here can read
 * or write data directly.
 */

export class FunctionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "FunctionError";
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
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

export function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  return request<T>(`${path}?${new URLSearchParams(params).toString()}`, { method: "GET" });
}
