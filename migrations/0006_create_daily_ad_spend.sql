-- Manual daily ad spend entry, for the admin analytics dashboard.
--
-- One row per IST calendar day (date is the PRIMARY KEY, so entering the same
-- day twice is an upsert, not a duplicate). amount_paise, not rupees, to match
-- every other money column in this schema (orders.amount_paise, books.price_paise).

CREATE TABLE daily_ad_spend (
  date         TEXT PRIMARY KEY, -- 'YYYY-MM-DD', IST calendar date
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  note         TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
