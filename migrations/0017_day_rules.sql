-- Additive immutable per-day policy. Old Workers ignore this table and retain legacy days.
CREATE TABLE IF NOT EXISTS day_rules (
 category_id TEXT PRIMARY KEY REFERENCES categories(id),
 policy_json TEXT NOT NULL,
 policy_digest TEXT NOT NULL,
 pool_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
