# S1 Backend (branch s1-backend, owns apps-script/ and tools/hb-cli.mjs)
Read 00-common.md first.

Build the Google Apps Script backend exactly as CONTRACT sections 3, 4, 6 describe.

First task, before anything else: a one-file spike proving the CORS and redirect behavior (a text/plain POST from a browser page on another origin returns JSON from an Apps Script web app). Record the result in `docs/DECISIONS.md`. If it fails, propose the fix there immediately (this affects S2). You cannot deploy without Chris, so if the spike needs a live deployment, write the steps in `docs/HUMAN-STEPS.md` and continue with the rest.

Deliver:
1. `apps-script/schema.json` generated from the CONTRACT section 3 table (tables, field names, types, refs). It is the machine-readable source of truth.
2. `apps-script/Code.gs` (split into files as needed) with: `doPost` router, auth by SHA-256 key hash in Script Properties, actions ping, pull, push, upload, file, thumb, syncCalendar, testAlert, LockService, global `rev` counter, soft deletes, `changelog` tab, schema validation and type coercion.
3. `setup()` function: creates the Spreadsheet tabs and headers from schema.json if missing, creates the Drive folders (House Bible Files/{rooms,assets,documents,general}, House Bible Backups), creates the "House Bible" calendar, installs triggers (daily weather alert at 16:00, monthly backup keeping 12, daily calendar sync at 05:00), and writes default `settings` rows (house address 353 Washington St Canton MA, lat 42.158 lon -71.145 to verify, alert defaults, schemaVersion). Also a `setKey(plain)` helper Chris runs once.
4. Calendar sync per CONTRACT section 5 rules: expand each calendar-enabled task's next 12 months of occurrences as all-day events, tag events with the task id in the description or extended properties so sync is idempotent (create, update, remove).
5. Weather alerts per section 6 using api.weather.gov (points, then hourly forecast), de-duplicated per rule per day.
6. A `apps-script/test/` Node harness that fakes SpreadsheetApp, LockService and PropertiesService minimally and tests push, pull, stale resolution and rev ordering. Keep the pure logic in separate functions Node can import.
7. `tools/hb-cli.mjs` (Node 18+, no deps): ping, pull, push, upload against a deployed URL with a key, used by other sessions and for smoke tests.
8. `docs/HUMAN-STEPS.md` section S1: exact steps for Chris to create the Apps Script project (or use clasp), put the code in, run `setup()`, authorise, run `setKey`, deploy as Web App (execute as me, access anyone), copy the exec URL, and run `hb-cli ping`. Make it the shortest path, under 15 steps; if clasp is shorter, give both.

Say clearly that live deployment was not tested until Chris runs the steps.
