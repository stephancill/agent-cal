import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerToken, randomToken, sha256 } from "./auth";
import {
  deleteEvent,
  getCalendar,
  listObjects,
  requireAuthorizedCalendar,
  upsertEvent,
} from "./db";
import { calendarFeed } from "./ical";
import { createCalendarSchema, eventSchema } from "./schema";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>agent-cal</title>
    <meta property="og:title" content="agent-cal" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://agent-cal.stupidtech.net/" />
    <meta
      property="og:description"
      content="A shared calendar API for AI agents, with Apple Calendar subscriptions."
    />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <h1>agent-cal</h1>
    <p>A shared calendar API for AI agents.</p>
    <p>
      Give an agent a private update token and a user a read-only Apple Calendar subscription URL.
      The agent can create, update, and delete events for you.
    </p>

    <h2>How it works</h2>
    <ol>
      <li>An agent creates a calendar once.</li>
      <li>The agent persists the returned update token.</li>
      <li>You subscribe to the returned <code>webcal://</code> URL in Apple Calendar.</li>
      <li>The agent manages events through the API; your calendar app refreshes the feed.</li>
    </ol>

    <h2>Endpoints</h2>
    <ul>
      <li><code>GET /health</code></li>
      <li><code>POST /v1/calendars</code></li>
      <li><code>GET /v1/calendars/:calendarId</code></li>
      <li><code>GET /v1/calendars/:calendarId/events</code></li>
      <li><code>POST /v1/calendars/:calendarId/events</code></li>
      <li><code>PUT /v1/calendars/:calendarId/events/:eventId</code></li>
      <li><code>DELETE /v1/calendars/:calendarId/events/:eventId</code></li>
      <li><code>GET /calendars/:calendarId/:feedSecret/calendar.ics</code></li>
    </ul>

    <h2>Setup</h2>
    <p>Use the bundled skill CLI:</p>
    <pre><code>python skills/agent-calendar/scripts/agent_calendar.py setup \\
  --api-base https://agent-cal.stupidtech.net \\
  --profile default \\
  --name "Agent Calendar" \\
  --timezone "UTC"</code></pre>

    <h2>Create an event</h2>
    <pre><code>python skills/agent-calendar/scripts/agent_calendar.py create-event \\
  --profile default \\
  --title "Dentist" \\
  --starts-at "2026-07-20T10:00:00+02:00" \\
  --ends-at "2026-07-20T11:00:00+02:00"</code></pre>

    <h2>Notes</h2>
    <ul>
      <li>Apple Calendar subscriptions are read-only.</li>
      <li>Calendar feed URLs are unauthenticated but unguessable.</li>
      <li>Update tokens should be kept private by the agent.</li>
      <li>CalDAV editing support can be added later on top of the calendar object store.</li>
    </ul>

    <p>
      <a href="https://github.com/stephancill/agent-cal">github</a>
      -
      <a href="/SKILL.md">skill</a>
      -
      <a href="https://x.com/stephancill">twitter</a>
      -
      <a href="https://stupidtech.net">stupidtech.net</a>
    </p>
  </body>
</html>`),
);

app.get("/health", (c) => c.json({ ok: true, service: "agent-cal" }));

app.post(
  "/v1/calendars",
  zValidator("json", createCalendarSchema),
  async (c) => {
    const input = c.req.valid("json");
    const now = new Date().toISOString();
    const id = `cal_${crypto.randomUUID()}`;
    const feedSecret = randomToken("feed");
    const updateToken = randomToken("upd");

    await c.env.DB.prepare(
      `INSERT INTO calendars (id, name, description, timezone, feed_secret_hash, update_token_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.name,
        input.description ?? null,
        input.timezone,
        await sha256(feedSecret),
        await sha256(updateToken),
        now,
        now,
      )
      .run();

    const origin = new URL(c.req.url).origin;
    const feedPath = `/calendars/${encodeURIComponent(id)}/${encodeURIComponent(feedSecret)}/calendar.ics`;
    const subscribeUrl = `${origin}${feedPath}`;
    const webcalUrl = `webcal://${new URL(origin).host}${feedPath}`;

    return c.json(
      { calendarId: id, updateToken, subscribeUrl, webcalUrl },
      201,
    );
  },
);

app.get("/v1/calendars/:calendarId", async (c) => {
  const calendar = await requireAuthorizedCalendar({
    env: c.env,
    calendarId: c.req.param("calendarId"),
    token: bearerToken(c.req.header("authorization")),
  });
  if (!calendar) return c.json({ error: "unauthorized" }, 401);
  return c.json({
    calendarId: calendar.id,
    name: calendar.name,
    description: calendar.description,
    timezone: calendar.timezone,
    createdAt: calendar.created_at,
    updatedAt: calendar.updated_at,
  });
});

app.get("/v1/calendars/:calendarId/events", async (c) => {
  const calendar = await requireAuthorizedCalendar({
    env: c.env,
    calendarId: c.req.param("calendarId"),
    token: bearerToken(c.req.header("authorization")),
  });
  if (!calendar) return c.json({ error: "unauthorized" }, 401);
  const events = await listObjects(c.env.DB, calendar.id);
  return c.json({ events: events.map(toApiEvent) });
});

app.post(
  "/v1/calendars/:calendarId/events",
  zValidator("json", eventSchema),
  async (c) => {
    const calendar = await requireAuthorizedCalendar({
      env: c.env,
      calendarId: c.req.param("calendarId"),
      token: bearerToken(c.req.header("authorization")),
    });
    if (!calendar) return c.json({ error: "unauthorized" }, 401);
    const object = await upsertEvent({
      db: c.env.DB,
      calendarId: calendar.id,
      event: c.req.valid("json"),
    });
    return c.json({ event: toApiEvent(object) }, 201);
  },
);

app.put(
  "/v1/calendars/:calendarId/events/:eventId",
  zValidator("json", eventSchema),
  async (c) => {
    const calendar = await requireAuthorizedCalendar({
      env: c.env,
      calendarId: c.req.param("calendarId"),
      token: bearerToken(c.req.header("authorization")),
    });
    if (!calendar) return c.json({ error: "unauthorized" }, 401);
    const object = await upsertEvent({
      db: c.env.DB,
      calendarId: calendar.id,
      eventId: c.req.param("eventId"),
      event: c.req.valid("json"),
    });
    return c.json({ event: toApiEvent(object) });
  },
);

app.delete("/v1/calendars/:calendarId/events/:eventId", async (c) => {
  const calendar = await requireAuthorizedCalendar({
    env: c.env,
    calendarId: c.req.param("calendarId"),
    token: bearerToken(c.req.header("authorization")),
  });
  if (!calendar) return c.json({ error: "unauthorized" }, 401);
  const deleted = await deleteEvent(
    c.env.DB,
    calendar.id,
    c.req.param("eventId"),
  );
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.get("/calendars/:calendarId/:feedSecret/calendar.ics", async (c) => {
  const calendar = await getCalendar(c.env.DB, c.req.param("calendarId"));
  if (!calendar) return c.text("Not found", 404);
  if (calendar.feed_secret_hash !== (await sha256(c.req.param("feedSecret"))))
    return c.text("Not found", 404);
  const objects = await listObjects(c.env.DB, calendar.id);
  return c.body(calendarFeed({ calendar, objects }), 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

function toApiEvent(object: {
  id: string;
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  etag: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: object.id,
    uid: object.uid,
    title: object.summary,
    description: object.description,
    location: object.location,
    startsAt: object.starts_at,
    endsAt: object.ends_at,
    timezone: object.timezone,
    status: object.status,
    etag: object.etag,
    createdAt: object.created_at,
    updatedAt: object.updated_at,
  };
}

export default app;
