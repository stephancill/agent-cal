import { sha256 } from "./auth";
import { eventToIcs } from "./ical";
import type { EventInput } from "./schema";
import type { Calendar, CalendarObject, Env } from "./types";

export async function getCalendar(
  db: D1Database,
  id: string,
): Promise<Calendar | null> {
  return db
    .prepare("SELECT * FROM calendars WHERE id = ?")
    .bind(id)
    .first<Calendar>();
}

export async function requireAuthorizedCalendar({
  env,
  calendarId,
  token,
}: {
  env: Env;
  calendarId: string;
  token: string | null;
}): Promise<Calendar | null> {
  if (!token) return null;
  const calendar = await getCalendar(env.DB, calendarId);
  if (!calendar) return null;
  return calendar.update_token_hash === (await sha256(token)) ? calendar : null;
}

export async function listObjects(
  db: D1Database,
  calendarId: string,
): Promise<CalendarObject[]> {
  const result = await db
    .prepare(
      "SELECT * FROM calendar_objects WHERE calendar_id = ? AND deleted_at IS NULL ORDER BY starts_at ASC, id ASC",
    )
    .bind(calendarId)
    .all<CalendarObject>();
  return result.results;
}

export async function getObject(
  db: D1Database,
  calendarId: string,
  objectId: string,
): Promise<CalendarObject | null> {
  return db
    .prepare(
      "SELECT * FROM calendar_objects WHERE calendar_id = ? AND id = ? AND deleted_at IS NULL",
    )
    .bind(calendarId, objectId)
    .first<CalendarObject>();
}

export async function upsertEvent({
  db,
  calendarId,
  event,
  eventId,
}: {
  db: D1Database;
  calendarId: string;
  event: EventInput;
  eventId?: string;
}): Promise<CalendarObject> {
  const now = new Date().toISOString();
  const id = eventId ?? event.id ?? `evt_${crypto.randomUUID()}`;
  const existing = await getObject(db, calendarId, id);
  const uid = existing?.uid ?? `${id}@agent-cal`;
  const ical = eventToIcs({ uid, event, now });
  const etag = await sha256(`${calendarId}:${id}:${ical}:${now}`);

  if (existing) {
    await db
      .prepare(
        `UPDATE calendar_objects
         SET ical = ?, etag = ?, summary = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, timezone = ?, status = ?, updated_at = ?, deleted_at = NULL
         WHERE calendar_id = ? AND id = ?`,
      )
      .bind(
        ical,
        etag,
        event.title,
        event.description ?? null,
        event.location ?? null,
        event.startsAt,
        event.endsAt,
        event.timezone,
        event.status,
        now,
        calendarId,
        id,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO calendar_objects (id, calendar_id, uid, object_type, ical, etag, summary, description, location, starts_at, ends_at, timezone, status, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 'VEVENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        id,
        calendarId,
        uid,
        ical,
        etag,
        event.title,
        event.description ?? null,
        event.location ?? null,
        event.startsAt,
        event.endsAt,
        event.timezone,
        event.status,
        now,
        now,
      )
      .run();
  }

  const object = await getObject(db, calendarId, id);
  if (!object) throw new Error("event write failed");
  return object;
}

export async function deleteEvent(
  db: D1Database,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      "UPDATE calendar_objects SET deleted_at = ?, updated_at = ? WHERE calendar_id = ? AND id = ? AND deleted_at IS NULL",
    )
    .bind(now, now, calendarId, eventId)
    .run();
  return result.meta.changes > 0;
}
