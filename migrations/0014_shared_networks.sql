-- Shared networks: daily abuse backstop and rolling ten-minute admission limit.
DROP TRIGGER claim_guard;
DROP TRIGGER count_success;
CREATE INDEX claims_ip_window ON claims(ip_hash,ip_day,created_at,user_id);
CREATE TRIGGER claim_guard BEFORE INSERT ON claims BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM claims WHERE category_id=NEW.category_id AND user_id=NEW.user_id)>=3 OR (SELECT COUNT(*) FROM strikes WHERE category_id=NEW.category_id AND user_id=NEW.user_id)>=5 THEN RAISE(ABORT,'FILE_CLOSED') END;
 SELECT CASE WHEN (SELECT hidden FROM users WHERE id=NEW.user_id)!=0 THEN RAISE(ABORT,'USER_HIDDEN') END;
 SELECT CASE WHEN (SELECT category_id FROM answers WHERE id=NEW.answer_id)!=NEW.category_id THEN RAISE(ABORT,'CATEGORY_MISMATCH') END;
 SELECT CASE WHEN NEW.ip_hash!='' AND NOT EXISTS(SELECT 1 FROM claims WHERE user_id=NEW.user_id AND ip_day=NEW.ip_day) AND COALESCE((SELECT count FROM rate_limits WHERE ip_hash=NEW.ip_hash AND day=NEW.ip_day),0)>=5000 THEN RAISE(ABORT,'IP_LIMIT') END;
 SELECT CASE WHEN NEW.ip_hash!='' AND NOT EXISTS(SELECT 1 FROM claims WHERE user_id=NEW.user_id AND ip_day=NEW.ip_day) AND (SELECT COUNT(DISTINCT c.user_id) FROM claims c WHERE c.ip_hash=NEW.ip_hash AND c.ip_day=NEW.ip_day AND c.created_at>strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at,'-10 minutes') AND NOT EXISTS(SELECT 1 FROM claims earlier WHERE earlier.user_id=c.user_id AND earlier.ip_day=c.ip_day AND earlier.created_at<c.created_at))>=300 THEN RAISE(ABORT,'IP_LIMIT') END;
END;
CREATE TRIGGER count_success AFTER INSERT ON claims WHEN NEW.ip_hash!='' AND (SELECT COUNT(*) FROM claims WHERE user_id=NEW.user_id AND ip_day=NEW.ip_day)=1 BEGIN
 INSERT INTO rate_limits(ip_hash,day,count) VALUES(NEW.ip_hash,NEW.ip_day,1) ON CONFLICT(ip_hash,day) DO UPDATE SET count=count+1;
END;
