import { z } from "zod";

const isoDateTime = z.string().datetime({ offset: true });

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
    startsAt: isoDateTime,
    endsAt: isoDateTime,
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
  .refine((event) => Date.parse(event.endsAt) > Date.parse(event.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export type CreateCalendarInput = z.infer<typeof createCalendarSchema>;
export type EventInput = z.infer<typeof eventSchema>;
