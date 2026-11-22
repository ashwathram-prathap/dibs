CREATE TABLE topic_library(slug TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 50,recipe_json TEXT NOT NULL,manifest_json TEXT NOT NULL,coverage_json TEXT NOT NULL,checked_at TEXT NOT NULL,uploaded INTEGER NOT NULL DEFAULT 0);
CREATE TABLE topic_schedule(date TEXT PRIMARY KEY,slug TEXT,request TEXT,status TEXT NOT NULL DEFAULT 'empty' CHECK(status IN ('empty','requested','needs recipe','building','ready','failed','live','closed','archived')),category_id TEXT,auto_picked INTEGER NOT NULL DEFAULT 0,reason TEXT NOT NULL DEFAULT '',build_result TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,built_at TEXT,revision INTEGER NOT NULL DEFAULT 1);
CREATE INDEX schedule_status_date ON topic_schedule(status,date);
CREATE TABLE schedule_log(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,at TEXT NOT NULL);
CREATE INDEX schedule_log_date ON schedule_log(date,id DESC);
CREATE TABLE rollout_state(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
