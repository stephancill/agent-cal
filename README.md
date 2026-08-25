# Agent Cal

Cloudflare Worker API for AI-agent-owned calendars. Agents manage calendars through a JSON API and users subscribe to read-only iCalendar feeds in Apple Calendar or any `.ics` client.

## Links

- Production API: https://agent-cal.stupidtech.net
- Health check: https://agent-cal.stupidtech.net/health
- GitHub: https://github.com/stephancill/agent-cal
- Worker: `agent-cal`
- D1 database: `agent-cal`
- Agent skill source: `skills/agent-calendar`
- Packaged agent skill: https://agent-cal.stupidtech.net/agent-calendar.skill

## API

- `GET /health`
- `POST /v1/calendars`
- `GET /v1/calendars/:calendarId`
- `GET /v1/calendars/:calendarId/events`
- `POST /v1/calendars/:calendarId/events`
- `PUT /v1/calendars/:calendarId/events/:eventId`
- `DELETE /v1/calendars/:calendarId/events/:eventId`
- `GET /calendars/:calendarId/:feedSecret/calendar.ics`

Calendar setup returns an `updateToken`, `subscribeUrl`, and `webcalUrl`. Keep `updateToken` private; share only `webcalUrl` with users.

Event `startsAt` and `endsAt` values may be offset ISO date-times or ISO dates. Date-only values create a native all-day event; `endsAt` is exclusive:

```json
{
  "title": "Holiday",
  "startsAt": "2026-09-06",
  "endsAt": "2026-09-14",
  "allDay": true
}
```

## Skill CLI

The bundled skill includes a Python CLI that manages local credentials automatically:

```bash
python skills/agent-calendar/scripts/agent_calendar.py setup \
  --api-base https://agent-cal.stupidtech.net \
  --profile default \
  --name "Agent Calendar" \
  --timezone "UTC"
```

Create an event:

```bash
python skills/agent-calendar/scripts/agent_calendar.py create-event \
  --profile default \
  --title "Dentist" \
  --starts-at "2026-07-20T10:00:00+02:00" \
  --ends-at "2026-07-20T11:00:00+02:00"
```

Create an all-day event. `--ends-at` is the exclusive end date, so this event covers 6-13 September:

```bash
python skills/agent-calendar/scripts/agent_calendar.py create-event \
  --profile default \
  --title "Holiday" \
  --all-day \
  --starts-at "2026-09-06" \
  --ends-at "2026-09-14"
```

## Development

Install dependencies:

```bash
bun install
```

Run locally:

```bash
bun run dev
```

Apply D1 migrations:

```bash
bunx wrangler d1 migrations apply agent-cal --local
bunx wrangler d1 migrations apply agent-cal --remote
```

Check and format:

```bash
bun run lint
bun run format
```

Deploy:

```bash
bun run deploy
```
