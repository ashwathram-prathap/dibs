-- Additive migration only: retain the legacy category count constraint and all player rows.
-- Static catalogs carry their true count in source_json; public queries use it.
CREATE TABLE recovery_keys(key_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id),created_at TEXT NOT NULL);
CREATE TABLE claim_requests(user_id TEXT NOT NULL,category_id TEXT NOT NULL,request_id TEXT NOT NULL,answer_key TEXT NOT NULL,status INTEGER NOT NULL,response_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,category_id,request_id)) WITHOUT ROWID;
CREATE TABLE missing_answers(day TEXT NOT NULL,category_id TEXT NOT NULL,answer TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(day,category_id,answer)) WITHOUT ROWID;
ALTER TABLE claims ADD COLUMN request_id TEXT;
ALTER TABLE claims ADD COLUMN request_answer TEXT;
ALTER TABLE strikes ADD COLUMN request_id TEXT;
ALTER TABLE strikes ADD COLUMN request_answer TEXT;
CREATE UNIQUE INDEX claim_request_once ON claims(user_id,category_id,request_id);
CREATE UNIQUE INDEX strike_request_once ON strikes(user_id,category_id,request_id);
