-- Foreign-key checks must not scan every other register during draft replacement.
CREATE INDEX IF NOT EXISTS answer_keys_answer_id ON answer_keys(answer_id);
CREATE INDEX IF NOT EXISTS claims_answer_id ON claims(answer_id);
