-- Additive only: lets an admin override the buy-button text per guide.
-- Nullable with no default — NULL means "use the default 'Get Instant
-- Access' label", so every guide that doesn't set this (including all four
-- live guides today) renders exactly as it did before this column existed.
-- The price is never stored here; it is always appended at render time from
-- price_paise, so it can never go stale.
ALTER TABLE books ADD COLUMN button_text TEXT;
