# Implementation Notes

## 2026-07-16

- Built the initial Cloudflare Worker API for agent-owned calendars.
- Added D1 schema for calendars and calendar objects, including per-calendar event IDs, stable UIDs, ETags, and canonical iCalendar text.
- Added authenticated JSON endpoints for calendar metadata and event create/list/update/delete.
- Added unauthenticated secret `.ics` feed endpoint for Apple Calendar subscriptions.
- Added token hashing for update tokens and feed secrets.
- Added bundled `agent-calendar` skill with a standard-library Python CLI that manages local credential profiles.
- Deployed production Worker at `https://agent-cal.stupidtech.net`.
- Verified production health, setup idempotency, event creation, ICS feed generation, deletion, and empty event list after deletion.
- Added project README, repository metadata, and agent instructions for future changes.
- Added a minimal landing page at `GET /` in the style of other `stupidtech.net` services.
- Added a statically served favicon at `/favicon.ico` from `public/favicon.ico` via the Workers assets binding.
- Added `/SKILL.md` as a static skill link in the Agent Cal footer via a symlink to the canonical skill file.
- Added `GET /stats` and a landing-page metric for total events created.
- Replaced the statically served favicon with `New Project (18).png` converted to `public/favicon.ico`.
- Removed the endpoint list and notes section from the landing page to keep it concise.
- Changed the setup section to link to `/SKILL.md` and tell users to ask their agent to use the skill.
- Removed the create-event example from the landing page.
- Added the packaged skill archive at `/agent-calendar.skill` so agents can install the bundled CLI script with the skill.
- Added complete landing-page Open Graph and Twitter metadata with a static `/og.png` preview image.
- Updated `/og.png` to a padded 1200x630 preview card for wide Open Graph renderers.
- Updated the landing-page and social metadata description to “A shared calendar for you and your agent.”
- Removed the extra landing-page explanatory line under the tagline.

## 2026-08-25

- Added native all-day events using ISO date-only `startsAt` and `endsAt` values, with optional explicit `allDay: true` input and `allDay` in event responses.
- Added iCalendar `VALUE=DATE` serialization with exclusive end-date semantics while preserving existing timed-event behavior.
- Added CLI `--all-day` support, skill guidance, API validation coverage, and iCalendar serialization tests.

## 2026-09-20

- Restyled the landing page with the shared `stupidtech.net` web styling (system-ui font, centered 46rem column, light-gray `code`/`pre` blocks).
- Moved the landing page out of `src/index.ts` into `public/index.html`, served by the static assets binding, and removed `/` from `run_worker_first` so the asset server handles the root path.
- Added `public/favicon.png` and `public/apple-touch-icon.png` generated from the calendar icon source, and linked them alongside the existing `favicon.ico` in the page head.
