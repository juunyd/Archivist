-- Columns needed to send a Meta Conversions API Purchase event when an order
-- is fulfilled, from worker/lib/fulfil.ts (see worker/lib/meta-capi.ts).
--
-- client_ip and client_user_agent are captured once, at checkout time, in
-- /api/create-order (the only point a real client Request is in hand) and
-- stored so they are still available later when fulfilment runs — which can
-- be minutes later, server-to-server, from the Razorpay webhook.
--
-- meta_event_id is the UUID the browser generates for its own Purchase pixel
-- event (see lib/checkout.ts). Storing it on the order lets the later server
-- Purchase event reuse the same id, so Meta deduplicates the two instead of
-- counting one sale twice.

ALTER TABLE orders ADD COLUMN client_ip TEXT;
ALTER TABLE orders ADD COLUMN client_user_agent TEXT;
ALTER TABLE orders ADD COLUMN meta_event_id TEXT;
