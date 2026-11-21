PRAGMA foreign_keys=ON;
CREATE TABLE categories(id TEXT PRIMARY KEY,date TEXT UNIQUE,name TEXT NOT NULL,slug TEXT NOT NULL,total_registrable INTEGER NOT NULL CHECK(total_registrable>=2000),drop_at TEXT,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),source_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE answers(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id),canonical TEXT NOT NULL,display TEXT NOT NULL,aliases_json TEXT NOT NULL DEFAULT '[]',obscurity INTEGER CHECK(obscurity BETWEEN 1 AND 5),UNIQUE(category_id,canonical));
CREATE TABLE answer_keys(category_id TEXT NOT NULL,match_key TEXT NOT NULL,answer_id TEXT NOT NULL REFERENCES answers(id) ON DELETE CASCADE,PRIMARY KEY(category_id,match_key));
CREATE INDEX answers_category ON answers(category_id,display);
CREATE TABLE users(id TEXT PRIMARY KEY,handle TEXT NOT NULL UNIQUE,school TEXT NOT NULL DEFAULT 'None',created_at TEXT NOT NULL,rerolls_used INTEGER NOT NULL DEFAULT 0 CHECK(rerolls_used BETWEEN 0 AND 3),hidden INTEGER NOT NULL DEFAULT 0,provider_subject TEXT UNIQUE);
CREATE TABLE rate_limits(ip_hash TEXT NOT NULL,day TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(ip_hash,day));
CREATE TABLE claims(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id),answer_id TEXT NOT NULL REFERENCES answers(id),user_id TEXT NOT NULL REFERENCES users(id),claim_no INTEGER NOT NULL,created_at TEXT NOT NULL,voided INTEGER NOT NULL DEFAULT 0,ip_hash TEXT NOT NULL,ip_day TEXT NOT NULL,UNIQUE(category_id,answer_id),UNIQUE(category_id,user_id),UNIQUE(category_id,claim_no));
CREATE INDEX claims_user_date ON claims(user_id,created_at);
CREATE INDEX claims_category_order ON claims(category_id,claim_no DESC);
CREATE TRIGGER claim_guard BEFORE INSERT ON claims BEGIN
 SELECT CASE WHEN (SELECT hidden FROM users WHERE id=NEW.user_id)!=0 THEN RAISE(ABORT,'USER_HIDDEN') END;
 SELECT CASE WHEN (SELECT category_id FROM answers WHERE id=NEW.answer_id)!=NEW.category_id THEN RAISE(ABORT,'CATEGORY_MISMATCH') END;
 SELECT CASE WHEN COALESCE((SELECT count FROM rate_limits WHERE ip_hash=NEW.ip_hash AND day=NEW.ip_day),0)>=5 THEN RAISE(ABORT,'IP_LIMIT') END;
END;
CREATE TRIGGER count_success AFTER INSERT ON claims BEGIN
 INSERT INTO rate_limits(ip_hash,day,count) VALUES(NEW.ip_hash,NEW.ip_day,1) ON CONFLICT(ip_hash,day) DO UPDATE SET count=count+1;
END;
CREATE TABLE attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,at INTEGER NOT NULL);
CREATE INDEX attempts_recent ON attempts(user_id,at);
CREATE TRIGGER attempt_guard BEFORE INSERT ON attempts BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM attempts WHERE user_id=NEW.user_id AND at>NEW.at-60000)>=3 THEN RAISE(ABORT,'USER_RATE_LIMIT') END;
END;
CREATE TABLE share_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,day TEXT NOT NULL,format TEXT NOT NULL CHECK(format IN ('feed','story')));
CREATE INDEX shares_day ON share_events(day);
CREATE TABLE admin_audit(id TEXT PRIMARY KEY,action TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL);
