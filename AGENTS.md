# Agent Cal Instructions

## Project Context

Agent Cal is a Cloudflare Worker API for AI-agent-owned calendars. Agents use the JSON API and bundled skill CLI to create calendars and manage events; users subscribe to read-only iCalendar feeds in Apple Calendar or other `.ics` clients.

Production URL: https://agent-cal.stupidtech.net

## Stack

- Runtime: Cloudflare Workers
- Framework: Hono
- Database: Cloudflare D1
- Validation: Zod
- Package manager: Bun
- Formatting: Prettier
- Type checking: TypeScript

## Required Reading Before Changes

Before making changes, check:

- `README.md`
- `docs/implementation-notes.md`
- Relevant files under `src/`
- Relevant skill files under `skills/agent-calendar/` when changing agent workflows or CLI behavior

## Implementation Notes

Update `docs/implementation-notes.md` before committing any change that affects behavior, API shape, deployment, schema, skill usage, or operational procedures.

## Commands

Use Bun for project commands:

```bash
bun install
bun run lint
bun run format
bun run deploy
```

Apply D1 migrations explicitly when schema changes:

```bash
bunx wrangler d1 migrations apply agent-cal --local
bunx wrangler d1 migrations apply agent-cal --remote
```

## Code Style

- Keep changes minimal and focused.
- Validate all external input with Zod.
- Store only hashes of private update/feed tokens server-side.
- Do not expose `updateToken` in logs, README examples, or user-facing output.
- Keep `.ics` feed endpoints unauthenticated but unguessable via feed secrets.
- Preserve future CalDAV compatibility by treating each event as a calendar object with stable `uid`, `etag`, and canonical iCalendar text.

## Skill Rules

- Keep `skills/agent-calendar/SKILL.md` concise.
- Keep the bundled Python CLI standard-library only.
- The CLI should manage credentials automatically and redact secrets by default.
- Repackage the skill with `package_skill.py` after skill changes, but do not commit generated `.skill` archives unless explicitly requested.
