CREATE TABLE calendars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  timezone TEXT NOT NULL,
  feed_secret_hash TEXT NOT NULL,
  update_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE calendar_objects (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  object_type TEXT NOT NULL,
  ical TEXT NOT NULL,
  etag TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX calendar_objects_calendar_uid_idx ON calendar_objects(calendar_id, uid);
CREATE INDEX calendar_objects_calendar_active_idx ON calendar_objects(calendar_id, deleted_at, starts_at);
