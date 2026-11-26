CREATE INDEX IF NOT EXISTS usage_sessions_by_name
ON usage_sessions (name COLLATE NOCASE, utc_date);
