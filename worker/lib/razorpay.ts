import { requireEnv, type WorkerEnv } from "./env";

const API = "https://api.razorpay.com/v1";

function authHeader(env: WorkerEnv): string {
  const id = requireEnv(env, "RAZORPAY_KEY_ID");
  const secret = requireEnv(env, "RAZORPAY_KEY_SECRET");
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

export class RazorpayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function call<T>(
  env: WorkerEnv,
  path: string,
  init: RequestInit & { body?: string } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: authHeader(env),
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    // Razorpay's own message goes to the logs only; callers surface something generic.
    console.error(`Razorpay ${init.method ?? "GET"} ${path} -> ${response.status}: ${text}`);
    throw new RazorpayError(`Razorpay request failed (${response.status})`, response.status);
  }
  return JSON.parse(text) as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string; // created | authorized | captured | refunded | failed
  email: string | null;
  contact: string | null;
  method: string | null;
}

export function createRazorpayOrder(
  env: WorkerEnv,
  input: { amountPaise: number; currency: string; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder> {
  return call<RazorpayOrder>(env, "/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
  });
}

export const fetchRazorpayPayment = (env: WorkerEnv, paymentId: string): Promise<RazorpayPayment> =>
  call<RazorpayPayment>(env, `/payments/${encodeURIComponent(paymentId)}`);

export const fetchRazorpayOrder = (env: WorkerEnv, orderId: string): Promise<RazorpayOrder> =>
  call<RazorpayOrder>(env, `/orders/${encodeURIComponent(orderId)}`);

/** A payment counts as money received once Razorpay has it authorized or captured. */
export const isPaidStatus = (status: string): boolean =>
  status === "captured" || status === "authorized";
