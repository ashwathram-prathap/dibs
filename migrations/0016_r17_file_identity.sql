-- A player's mirrored file carries identity and streak together. Cluster by player/day
-- for a one-row latest-file lookup; category-wide reads are administrative/archive work.
CREATE TABLE r17_files_by_player(user_id TEXT NOT NULL,day TEXT NOT NULL,category_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,day)) WITHOUT ROWID;
INSERT INTO r17_files_by_player SELECT f.user_id,g.date,f.category_id,f.revision,f.data FROM r17_files f JOIN categories g ON g.id=f.category_id;
DROP TABLE r17_files;
ALTER TABLE r17_files_by_player RENAME TO r17_files;
