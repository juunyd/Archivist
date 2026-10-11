-- Additive only: counts guide page views per IST calendar day, for the
-- Overview funnel (views -> checkouts started -> paid orders). No cookies,
-- no IP, no buyer identity — just a per-day, per-guide tally.
--
-- One row per (date, slug), same upsert-by-primary-key shape as
-- daily_ad_spend (0006_create_daily_ad_spend.sql): a second view on the same
-- day for the same guide increments the existing row instead of inserting a
-- duplicate.

CREATE TABLE page_views_daily (
  date       TEXT NOT NULL,              -- 'YYYY-MM-DD', IST calendar date
  slug       TEXT NOT NULL,              -- books.slug
  views      INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (date, slug)
);

-- Supports "views for this guide across all time" and the admin funnel's
-- per-guide breakdown without a full table scan.
CREATE INDEX page_views_daily_slug_idx ON page_views_daily (slug, date);
