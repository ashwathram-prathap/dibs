-- Preserve worldwide ownership while allowing three claims per player.
DROP TRIGGER claim_guard;
DROP TRIGGER count_success;
CREATE TABLE claims_r3(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id),answer_id TEXT NOT NULL REFERENCES answers(id),user_id TEXT NOT NULL REFERENCES users(id),claim_no INTEGER NOT NULL,created_at TEXT NOT NULL,voided INTEGER NOT NULL DEFAULT 0,ip_hash TEXT NOT NULL,ip_day TEXT NOT NULL,UNIQUE(category_id,answer_id),UNIQUE(category_id,claim_no));
INSERT INTO claims_r3 SELECT * FROM claims;
DROP TABLE claims;
ALTER TABLE claims_r3 RENAME TO claims;
CREATE INDEX claims_user_date ON claims(user_id,category_id,created_at);
CREATE INDEX claims_answer_id ON claims(answer_id);
CREATE INDEX claims_privacy_cleanup ON claims(ip_day) WHERE ip_hash!='';
-- No user FK: a taken-only file need not create a D1 identity.
CREATE TABLE strikes(category_id TEXT NOT NULL REFERENCES categories(id),user_id TEXT NOT NULL,seq INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(category_id,user_id,seq)) WITHOUT ROWID;
CREATE TRIGGER claim_guard BEFORE INSERT ON claims BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM claims WHERE category_id=NEW.category_id AND user_id=NEW.user_id)>=3 OR (SELECT COUNT(*) FROM strikes WHERE category_id=NEW.category_id AND user_id=NEW.user_id)>=5 THEN RAISE(ABORT,'FILE_CLOSED') END;
 SELECT CASE WHEN (SELECT hidden FROM users WHERE id=NEW.user_id)!=0 THEN RAISE(ABORT,'USER_HIDDEN') END;
 SELECT CASE WHEN (SELECT category_id FROM answers WHERE id=NEW.answer_id)!=NEW.category_id THEN RAISE(ABORT,'CATEGORY_MISMATCH') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM claims WHERE user_id=NEW.user_id AND ip_day=NEW.ip_day) AND COALESCE((SELECT count FROM rate_limits WHERE ip_hash=NEW.ip_hash AND day=NEW.ip_day),0)>=5 THEN RAISE(ABORT,'IP_LIMIT') END;
END;
CREATE TRIGGER count_success AFTER INSERT ON claims WHEN (SELECT COUNT(*) FROM claims WHERE user_id=NEW.user_id AND ip_day=NEW.ip_day)=1 BEGIN
 INSERT INTO rate_limits(ip_hash,day,count) VALUES(NEW.ip_hash,NEW.ip_day,1) ON CONFLICT(ip_hash,day) DO UPDATE SET count=count+1;
END;
CREATE TRIGGER strike_guard BEFORE INSERT ON strikes BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM claims WHERE category_id=NEW.category_id AND user_id=NEW.user_id)>=3 OR (SELECT COUNT(*) FROM strikes WHERE category_id=NEW.category_id AND user_id=NEW.user_id)>=5 THEN RAISE(ABORT,'FILE_CLOSED') END;
END;
DROP TRIGGER attempt_guard;
CREATE TRIGGER attempt_guard BEFORE INSERT ON attempts BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM attempts WHERE user_id=NEW.user_id AND at>NEW.at-60000)>=12 THEN RAISE(ABORT,'USER_RATE_LIMIT') END;
END;
