-- House ownership is separate from player identities and claims.
CREATE TABLE house_words (
 category_id TEXT NOT NULL REFERENCES categories(id),
 answer_id TEXT NOT NULL REFERENCES answers(id),
 revealed INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(category_id,answer_id)
);
CREATE TABLE daily_specials (
 category_id TEXT PRIMARY KEY REFERENCES categories(id),
 seed TEXT NOT NULL,
 golden_json TEXT NOT NULL,
 commitment TEXT NOT NULL,
 committed_at TEXT NOT NULL
);
CREATE TRIGGER house_cannot_be_claimed BEFORE INSERT ON claims
WHEN EXISTS(SELECT 1 FROM house_words WHERE category_id=NEW.category_id AND answer_id=NEW.answer_id)
BEGIN SELECT RAISE(ABORT, 'HOUSE_RESERVED'); END;
