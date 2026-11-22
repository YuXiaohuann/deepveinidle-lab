CREATE TABLE IF NOT EXISTS usage_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  utc_date TEXT NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS usage_sessions_by_date ON usage_sessions (utc_date, id, name);
