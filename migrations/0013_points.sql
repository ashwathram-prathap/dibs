-- Additive and rollback-compatible. Earlier claims have no retained percentile.
ALTER TABLE claims ADD COLUMN points INTEGER NOT NULL DEFAULT 50;
ALTER TABLE claims ADD COLUMN percentile REAL;
ALTER TABLE claims ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0;
UPDATE claims SET bonus=100,points=150 WHERE EXISTS (SELECT 1 FROM daily_specials ds,json_each(ds.golden_json) j WHERE ds.category_id=claims.category_id AND j.value=claims.answer_id);
