import { describe, expect, test } from "bun:test";
import { eventSchema } from "../src/schema";

const timedEvent = {
  title: "Dentist",
  startsAt: "2026-09-06T10:00:00+02:00",
  endsAt: "2026-09-06T11:00:00+02:00",
};

describe("eventSchema", () => {
  test("infers all-day events from date-only values", () => {
    const event = eventSchema.parse({
      title: "Holiday",
      startsAt: "2026-09-06",
      endsAt: "2026-09-14",
    });

    expect(event.allDay).toBe(true);
    expect(event.startsAt).toBe("2026-09-06");
    expect(event.endsAt).toBe("2026-09-14");
  });

  test("infers timed events from date-time values", () => {
    expect(eventSchema.parse(timedEvent).allDay).toBe(false);
  });

  test("accepts an explicit all-day flag with date-only values", () => {
    expect(
      eventSchema.parse({
        title: "Holiday",
        startsAt: "2026-09-06",
        endsAt: "2026-09-14",
        allDay: true,
      }).allDay,
    ).toBe(true);
  });

  test("rejects mixed date and date-time values", () => {
    expect(() =>
      eventSchema.parse({
        ...timedEvent,
        startsAt: "2026-09-06",
      }),
    ).toThrow();
  });

  test("rejects an all-day flag on date-time values", () => {
    expect(() =>
      eventSchema.parse({
        ...timedEvent,
        allDay: true,
      }),
    ).toThrow();
  });

  test("requires the exclusive end date to follow the start date", () => {
    expect(() =>
      eventSchema.parse({
        title: "Holiday",
        startsAt: "2026-09-06",
        endsAt: "2026-09-06",
      }),
    ).toThrow();
  });
});
