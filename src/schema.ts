import { z } from "zod";

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.iso.date();
const eventDate = z.union([isoDateTime, isoDate]);

export const createCalendarSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
});

export const eventSchema = z
  .object({
    id: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).optional(),
    location: z.string().trim().max(1000).optional(),
    startsAt: eventDate,
    endsAt: eventDate,
    allDay: z.boolean().optional(),
    timezone: z.string().trim().min(1).max(100).default("UTC"),
    status: z
      .enum(["confirmed", "tentative", "cancelled"])
      .default("confirmed"),
    rrule: z
      .string()
      .trim()
      .regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Za-z0-9,]+)*$/)
      .optional(),
  })
  .superRefine((event, context) => {
    const startsOnDate = isDateOnly(event.startsAt);
    const endsOnDate = isDateOnly(event.endsAt);

    if (startsOnDate !== endsOnDate) {
      context.addIssue({
        code: "custom",
        message: "startsAt and endsAt must both be dates or both be date-times",
        path: ["endsAt"],
      });
      return;
    }

    if (event.allDay === true && !startsOnDate) {
      context.addIssue({
        code: "custom",
        message: "allDay events require date-only startsAt and endsAt",
        path: ["allDay"],
      });
    }

    if (event.allDay === false && startsOnDate) {
      context.addIssue({
        code: "custom",
        message: "date-only events must be all-day events",
        path: ["allDay"],
      });
    }

    const endsAfterStart = startsOnDate
      ? event.endsAt > event.startsAt
      : Date.parse(event.endsAt) > Date.parse(event.startsAt);
    if (!endsAfterStart) {
      context.addIssue({
        code: "custom",
        message: "endsAt must be after startsAt",
        path: ["endsAt"],
      });
    }
  })
  .transform((event) => ({
    ...event,
    allDay: event.allDay ?? isDateOnly(event.startsAt),
  }));

export function isDateOnly(value: string): boolean {
  return isoDate.safeParse(value).success;
}

export type CreateCalendarInput = z.infer<typeof createCalendarSchema>;
export type EventInput = z.infer<typeof eventSchema>;
