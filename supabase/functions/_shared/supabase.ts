// Explicit npm: specifier, pinned. The Supabase deploy bundler does not read
// supabase/functions/deno.json, so a bare specifier fails at deploy time.
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.58.0";
import { requireEnv } from "./env.ts";

/**
 * Service-role client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
 * into every Edge Function by the platform. This key bypasses RLS and must
 * never leave the function runtime.
 */
let client: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

export interface BookRow {
  slug: string;
  title: string;
  price_paise: number;
  currency: string;
  pdf_path: string | null;
  active: boolean;
}

export interface OrderRow {
  id: string;
  book_slug: string;
  amount_paise: number;
  currency: string;
  status: "created" | "paid" | "failed" | "refunded";
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  download_token: string;
  download_count: number;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  email_sent_at: string | null;
}
