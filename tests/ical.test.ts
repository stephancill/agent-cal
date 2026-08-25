import { describe, expect, test } from "bun:test";
import { eventToIcs } from "../src/ical";
import { eventSchema } from "../src/schema";

describe("eventToIcs", () => {
  test("serializes all-day events as iCalendar DATE values", () => {
    const event = eventSchema.parse({
      title: "Holiday",
      startsAt: "2026-09-06",
      endsAt: "2026-09-14",
      allDay: true,
    });

    const ics = eventToIcs({
      uid: "holiday@agent-cal",
      event,
      now: "2026-08-25T12:00:00Z",
    });

    expect(ics).toContain("DTSTART;VALUE=DATE:20260906\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260914\r\n");
  });

  test("keeps timed events as UTC date-times", () => {
    const event = eventSchema.parse({
      title: "Dentist",
      startsAt: "2026-09-06T10:00:00+02:00",
      endsAt: "2026-09-06T11:00:00+02:00",
    });

    const ics = eventToIcs({
      uid: "dentist@agent-cal",
      event,
      now: "2026-08-25T12:00:00Z",
    });

    expect(ics).toContain("DTSTART:20260906T080000Z\r\n");
    expect(ics).toContain("DTEND:20260906T090000Z\r\n");
  });
});
