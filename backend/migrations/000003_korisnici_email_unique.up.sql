-- Partial unique index on non-empty normalized email.
-- Empty/blank email remains allowed for staff/legacy rows.
-- If this statement fails, duplicate LOWER(TRIM(email)) values exist:
-- do NOT delete or merge rows; inspect duplicates, then re-run.

CREATE UNIQUE INDEX IF NOT EXISTS idx_korisnici_email_normalized
    ON korisnici (LOWER(TRIM(email)))
    WHERE TRIM(COALESCE(email, '')) <> '';
