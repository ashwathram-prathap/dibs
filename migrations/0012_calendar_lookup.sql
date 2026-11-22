-- Last-used lookup must not scan the full retained calendar once per topic.
CREATE INDEX topic_schedule_slug_date ON topic_schedule(slug,date);
