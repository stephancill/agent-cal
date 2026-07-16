import type { Calendar, CalendarObject } from "./types";
import type { EventInput } from "./schema";

export function eventToIcs({
  uid,
  event,
  now,
}: {
  uid: string;
  event: EventInput;
  now: string;
}): string {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${toIcsDateTime(now)}`,
    `DTSTART:${toIcsDateTime(event.startsAt)}`,
    `DTEND:${toIcsDateTime(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    `STATUS:${event.status.toUpperCase()}`,
    event.rrule ? `RRULE:${event.rrule}` : null,
    "END:VEVENT",
  ].filter((line): line is string => line !== null);

  return foldLines(lines).join("\r\n") + "\r\n";
}

export function calendarFeed({
  calendar,
  objects,
}: {
  calendar: Calendar;
  objects: CalendarObject[];
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//agent-cal//Agent Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-TIMEZONE:${escapeText(calendar.timezone)}`,
  ];

  const body = objects.map((object) => object.ical.trim()).join("\r\n");
  return `${foldLines(lines).join("\r\n")}\r\n${body}${body ? "\r\n" : ""}END:VCALENDAR\r\n`;
}

export function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function toIcsDateTime(value: string): string {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function foldLines(lines: string[]): string[] {
  const folded: string[] = [];
  for (const line of lines) {
    if (line.length <= 75) {
      folded.push(line);
      continue;
    }
    let remaining = line;
    folded.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
    while (remaining.length > 0) {
      folded.push(` ${remaining.slice(0, 74)}`);
      remaining = remaining.slice(74);
    }
  }
  return folded;
}
