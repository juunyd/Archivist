-- Abuse protection for /api/resend-link.
--
-- That endpoint answers identically whether or not an email has ever bought
-- anything, so it cannot be used to enumerate customers — but without a cap
-- it could still be used to mail-bomb a real buyer. Three requests per email
-- per hour is plenty for someone who has genuinely lost their link.
--
-- Rows are written for unknown addresses too, so the work done (and
-- therefore the response time) does not reveal whether an email exists in
-- orders.

CREATE TABLE resend_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX resend_requests_email_time_idx ON resend_requests (lower(email), requested_at DESC);
