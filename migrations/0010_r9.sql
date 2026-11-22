-- Additive only; no existing claims, strikes or identities are modified.
CREATE TABLE founder_role(slot INTEGER PRIMARY KEY CHECK(slot=1), user_id TEXT NOT NULL UNIQUE REFERENCES users(id), name TEXT NOT NULL DEFAULT 'THE REGISTRAR');
CREATE TABLE feedback(id TEXT PRIMARY KEY, user_id TEXT, text TEXT NOT NULL CHECK(length(text)<=500), created_at TEXT NOT NULL);
CREATE INDEX feedback_created ON feedback(created_at);
