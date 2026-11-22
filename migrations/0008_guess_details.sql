-- Add detail only for new filings. Existing player rows remain unchanged.
ALTER TABLE strikes ADD COLUMN guess TEXT;
ALTER TABLE strikes ADD COLUMN holder_claim_id TEXT;
ALTER TABLE strikes ADD COLUMN house INTEGER NOT NULL DEFAULT 0;
