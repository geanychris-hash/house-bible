# S3 Maintenance status

## What works
- `web/js/core/recur.js`: nextDue, occurrences, taskStatus, consumableStatus, ruleText, log helpers. Rules: yearly, monthly, weekly, days, seasonal, once, after_done, plus optional season limit (`from`/`to`) on weekly/monthly/days.
- Views (registered with `registerView`): `maintenance` (Overdue, Due now, Next 30 days, All tasks by category, filters by type/room/assignee/subject, search, one-tap Done with Undo, Done-with-details (date, note, cost, photos), Snooze, Skip with required reason, history with remove, edit, pause, delete, List/Calendar toggle), `consumables` ("Low or due" list, one-tap replaced), `weather-alerts` (rules, emails, Send test alert).
- Add/edit form with plain-language frequency picker, subject, assignee, room, licensed-pro flag, Google Calendar flag.
- `seed/tasks.json` (43 tasks) and `tools/load-seed.mjs` (idempotent by seed_key).

## How it was tested
- `node --test web/js/core/recur.test.mjs tools/load-seed.test.mjs`: 23 recur tests (every rule type, year boundary, leap day, after_done, 30-day heartworm, snooze/skip, season limits, consumables) and 3 seed/loader tests (the loader runs against a fake local API; second run adds nothing).
- Views driven by hand in the built-in browser against the localStorage stub `data.js` using `tools/s3-harness/` (run `node tools/s3-harness/server.mjs`, open http://localhost:8731/tools/s3-harness/index.html). Checked at 400 px and 1200 px, light and dark: no console errors, no horizontal scroll, Done/Undo, add task, calendar day pick, supplies "replaced", alerts save and email validation.

## NOT tested
- Real S2 router, real data layer, sync, offline queue: the harness uses a stub router and the stub data.js.
- Photo upload (files.js did not exist; code path falls back with a message).
- Google Calendar sync and the test alert email (need S1/S2: `HB.api`; without it the screen says "Not connected yet").
- Real phone, iPhone, install to home screen, Playwright (not installed here; manual browser run instead).
- Loader against the real Apps Script (tested against a fake server only).

## For the next stream
- S2: please export `api(action, extra)` from data.js and optionally `deviceLabel()` (see DECISIONS). Views inject `css/maintenance.css` themselves.
- S1: `settings` rows for `alerts` and `notify` use `id == key`, `value` is a JSON string.
- S7: seed loader usage is in HUMAN-STEPS (S3 section). Remove `tools/s3-harness/` if it is not wanted in the final repo.
