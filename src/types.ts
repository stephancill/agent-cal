export type Env = {
  DB: D1Database;
};

export type Calendar = {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  feed_secret_hash: string;
  update_token_hash: string;
  created_at: string;
  updated_at: string;
};

export type CalendarObject = {
  id: string;
  calendar_id: string;
  uid: string;
  object_type: string;
  ical: string;
  etag: string;
  summary: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
