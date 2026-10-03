# S1 Backend status

Branch `s1-backend`. Owns `apps-script/`, `tools/hb-cli.mjs`, `.clasp.json.example`.

## What works (tested in Node with fakes)
- All 8 actions per CONTRACT section 4: ping, pull, push, upload, file, thumb, syncCalendar, testAlert. Router, SHA-256 key auth, LockService, global rev counter, soft deletes, hidden `changelog` tab, schema validation and coercion, partial-row merge.
- `setup()`: tabs and headers from schema, Drive folders, "House Bible" calendar, default settings, three triggers (weather 16:00, calendar sync 05:00, monthly backup keeping 12). `setKey` / `runSetKey`.
- Recurrence expansion for all seven rule types, idempotent calendar planner, weather rule evaluator (temp, wind, pro-rated rain and snow), alert de-dup.
- `tools/hb-cli.mjs`: ping, pull (follows paging), push, upload, file, thumb, sync-calendar, test-alert.

## How tested
`node --test apps-script/test/*.test.mjs` from the repo root: 30 tests, all pass. (The bare directory form fails on Node 24.) Covers push, pull, rev ordering, stale and tie resolution, partial merge, soft delete, coercion and rejection, duplicate ids in one push, paging, changelog, lock release and busy, column append, default settings, every recurrence rule, calendar idempotence end to end with a fake calendar, weather rules, email and calendar de-dup, upload validation, and the CLI against a local server that mimics the Apps Script 302 redirect. The single-file bundle `dist/HouseBible-all.gs` is checked to be current and to parse.

## NOT tested (needs Chris, see HUMAN-STEPS "S1")
- Anything against real Google: deployment, authorisation, the real browser CORS and redirect behaviour (spike page ready), Sheet text-format columns, Drive upload/download/thumbnail, Calendar tags and all-day dates, MailApp, triggers, UrlFetchApp against api.weather.gov (JSON shape coded from the API docs, not a live response), Apps Script quotas and speed (a pull reads every tab; fine at house scale).
- Lat/lon 42.158, -71.145 is unverified.
- Live deployment was not tested until Chris runs the steps.

## For the next streams
- S2: use `redirect:'follow'`, `text/plain`, no custom headers. Handle push status `invalid` (permanent, show message). `ping.serverTime` is epoch ms. Store `rev` from pull as the next `since`; if `more` is true, repeat with it. Settings values come back as JSON strings. Uploads are base64, 20 MB cap, downscale first.
- S3: the server copy of recurrence is `expandOccurrences_` in `Logic.gs`; keep it consistent with `recur.js` for what lands on the calendar.
- Adding a field: edit SPEC in `apps-script/build.mjs`, run `node apps-script/build.mjs`, redeploy.
