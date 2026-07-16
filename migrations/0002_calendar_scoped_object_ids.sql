CREATE TABLE calendar_objects_new (
  id TEXT NOT NULL,
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
  PRIMARY KEY (calendar_id, id),
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

INSERT INTO calendar_objects_new (
  id,
  calendar_id,
  uid,
  object_type,
  ical,
  etag,
  summary,
  description,
  location,
  starts_at,
  ends_at,
  timezone,
  status,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  id,
  calendar_id,
  uid,
  object_type,
  ical,
  etag,
  summary,
  description,
  location,
  starts_at,
  ends_at,
  timezone,
  status,
  created_at,
  updated_at,
  deleted_at
FROM calendar_objects;

DROP TABLE calendar_objects;
ALTER TABLE calendar_objects_new RENAME TO calendar_objects;

CREATE UNIQUE INDEX calendar_objects_calendar_uid_idx ON calendar_objects(calendar_id, uid);
CREATE INDEX calendar_objects_calendar_active_idx ON calendar_objects(calendar_id, deleted_at, starts_at);
