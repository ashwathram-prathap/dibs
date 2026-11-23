-- Additive: all R16 claims, strikes, identities, points and indexes stay intact.
-- New live-day records use one clustered key and no secondary indexes/triggers.
CREATE TABLE IF NOT EXISTS r17_players(id TEXT PRIMARY KEY, data TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS r17_files(category_id TEXT NOT NULL,user_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(category_id,user_id)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS r17_boards(category_id TEXT PRIMARY KEY,data TEXT NOT NULL) WITHOUT ROWID;
