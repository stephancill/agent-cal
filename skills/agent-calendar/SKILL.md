---
name: agent-calendar
description: Create and manage AI-agent-owned calendars through the Agent Calendar API, including one-time setup, persisted local credentials, Apple Calendar read-only subscription URLs, and event create/update/delete operations. Use when an agent needs to maintain a calendar that users can subscribe to in Apple Calendar or another iCalendar client.
---

# Agent Calendar

Use the bundled CLI for all API operations. In an installed skill, run `python scripts/agent_calendar.py ...` from the skill directory. In this repository checkout, run `python skills/agent-calendar/scripts/agent_calendar.py ...` from the project root. The CLI stores credentials in `~/.config/agent-calendar/credentials.json` by default and supports multiple named profiles.

If local DNS has not propagated but the hostname is known to be live, pass `--resolve agent-cal.stupidtech.net:<ip>` before the subcommand, or set `AGENT_CALENDAR_RESOLVE=agent-cal.stupidtech.net:<ip>`. This behaves like `curl --resolve` and still uses the original hostname for TLS and HTTP `Host`.

## Setup

Before creating a calendar, run `status` or `profiles` to check for existing credentials.

Create or reuse a profile:

```bash
python scripts/agent_calendar.py setup --api-base https://agent-cal.stupidtech.net --profile default --name "Agent Calendar" --timezone "UTC"
```

DNS override example:

```bash
python scripts/agent_calendar.py --resolve agent-cal.stupidtech.net:104.21.31.213 setup --api-base https://agent-cal.stupidtech.net --profile default --name "Agent Calendar" --timezone "UTC"
```

Setup is idempotent:

- If the profile is missing, it creates a calendar and saves credentials.
- If the profile exists and verifies, it reuses the calendar and prints the subscription URL.
- If the profile exists but verification fails, it fails and requires `--force` to replace the profile.
- If `--force` is passed, it creates a replacement calendar and overwrites the profile.

Share only the `webcalUrl` with the user. Tell the user this is a read-only Apple Calendar subscription for now.

## Event Operations

Create an event:

```bash
python scripts/agent_calendar.py create-event --profile default --title "Dentist" --starts-at "2026-07-20T10:00:00+02:00" --ends-at "2026-07-20T11:00:00+02:00" --description "Bring insurance card" --location "Cape Town"
```

List events:

```bash
python scripts/agent_calendar.py list-events --profile default
```

Update an event:

```bash
python scripts/agent_calendar.py update-event --profile default --event-id evt_... --title "Updated Dentist" --starts-at "2026-07-20T10:30:00+02:00" --ends-at "2026-07-20T11:30:00+02:00"
```

Delete an event:

```bash
python scripts/agent_calendar.py delete-event --profile default --event-id evt_...
```

## Rules

- Never expose `updateToken` to users.
- Use stored profiles instead of manually passing tokens when possible.
- Use `setup --force` only when the user intentionally wants a replacement calendar.
- Do not edit generated `.ics` feeds directly; use API/CLI event commands.
- The subscription calendar is read-only in Apple Calendar until CalDAV support is added.
