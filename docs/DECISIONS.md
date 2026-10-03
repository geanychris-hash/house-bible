# Decisions log

Append one dated line per decision. Never edit other people's lines. Format: `- YYYY-MM-DD [stream] decision, reason.`

## Chris's decisions (from the questions file, 2026-10-03)
- 2026-10-03 [Chris] Backend: Google Sheet + Apps Script + Drive, chosen over Firebase. Reason: Firebase file storage may need a paid plan, still needs console setup, and the Sheet is openable and fixable by hand. Chris's condition was "free, as usable, minimal human setup"; the Sheet route meets all three.
- 2026-10-03 [Chris] Users: Chris and his wife, both editing. Devices: Windows PCs, Samsung phone, iPhone.
- 2026-10-03 [Chris] Offline: online is required, offline edits are a nice extra if easy. Treat as: read from local cache offline, queue edits, sync later.
- 2026-10-03 [Chris] Priorities: 1 maintenance scheduling, 2 documents vault, 3 room records.
- 2026-10-03 [Chris] Must-haves: documents vault, contacts, consumables, steam log, room records, weather nudges, and any user-defined recurring tasks (example: dog heartworm medicine every 30 days).
- 2026-10-03 [Chris] Nice-to-haves: expense ledger, utilities and fuel log, insurance inventory, warranty tracker, QR labels, improvement cost tally.
- 2026-10-03 [Chris] Not wanted: weekly digest email.
- 2026-10-03 [Chris] Reminders: Google Calendar events. Email only for weather alerts (the default said calendar plus weekly email, but he rejected the weekly digest; weather alerts are a Must, so email is kept for those).
- 2026-10-03 [Chris] Sensitive data: some will be stored, must be protected. Access: private link plus a shared key per device on top of Google account access.
- 2026-10-03 [Chris] Public GitHub repo for code is fine. He needs to create a GitHub account.
- 2026-10-03 [Chris] Starting data: start fresh; import the receipts file only (28 tools, 2 paint entries); all "project clues" in the Receipts note are real projects. Files, photos and manuals are not gathered yet.
- 2026-10-03 [Chris] Time: about 2 hours per day for Google steps and testing; deadline a few days; up to 4 sessions at once.
- 2026-10-03 [Chris] Ambiguity during a build: pick a sensible default, record it here, keep going.

## Interpretations Claude made (Chris can overrule)
- 2026-10-03 [Claude] Chris struck through "Decorative charts" in the cut list. The instruction was "cross out any you want to keep", so the decorative charts are KEPT (year wheel, house cutaway, flow graph) along with the steam diagram. Everything else listed (barcode/OCR, Find a tool catalog, cut-list optimizer, Tasker CSV, Obsidian zip) is CUT. Visuals are lowest priority (S6, last).
- 2026-10-03 [Claude] Sensitive data uses client-side encryption with a household passphrase (CONTRACT section 7), so the Sheet only holds ciphertext.
- 2026-10-03 [Claude] House facts (year built, size, floors) are to be read from the Zillow, Redfin and Realtor links Chris gave; not fetched yet. Boiler, systems, project list and worries were left blank: the app's setup checklist collects them.

## Contract requests

## Cross-stream requests

## S3 Maintenance decisions and requests
- 2026-10-03 [S3] Skip and snooze are stored as `task_log` rows because the schema has no kind column: note `[skipped] reason` (counts as done) and `[snoozed until YYYY-MM-DD] reason` (only defers the due date; a later completion cancels it). Helpers: `makeLogNote`, `logKind` in recur.js. Reason: no contract change needed.
- 2026-10-03 [S3] Anchored rules (yearly, monthly, weekly, days) stay on the `start` schedule when done late; `after_done` shifts. A completion also counts for the next occurrence if done up to min(45, half the period) days early. One completion clears all missed past occurrences. Reason: heartworm "every 30 days" should not pile up five overdue pills.
- 2026-10-03 [S3] Extension to CONTRACT section 5 (backward compatible): weekly, monthly and days rules accept optional `from` and `to` ("MM-DD") to limit occurrences to part of the year (e.g. weekly boiler water check only Oct 15 to Apr 30). Other code that ignores the keys just sees a normal rule.
- 2026-10-03 [S3] Feb 29 yearly tasks fall on Feb 28 in common years. Monthly dates clamp to month end without drifting (Jan 31, Feb 28, Mar 31).
- 2026-10-03 [S3] A missed seasonal window stays "overdue" for 60 days after it ends, then rolls to next year's window.
- 2026-10-03 [S3] `tasks.rule` and `task_log.photos` are saved as JSON strings (matches the Sheet's json type); readers accept string or object.
- 2026-10-03 [S3] The S3 views use their own small helpers (`maintenance-ui.js`: h, modal, toast) instead of S2's `ui.js`, so they work without S2. They use S2 CSS tokens (`--bg --surface --ink --muted --line --accent ...`) with built-in fallbacks and a dark-mode fallback. Integration can swap to HBui later if wanted.
- 2026-10-03 [S3] Seed: 43 tasks, all `source:"seed"`, no pet reminders. Gas/flue/main electrical/asbestos/lead items are `pro_only:1` with "licensed pro" text. The boiler low-water cut-off blow-down defaults to monthly in heating season (manufacturers differ: monthly or weekly); the task text tells the owner to use the interval in their own manual.
- 2026-10-03 [S3] Views register as `maintenance` (order 10), `consumables` (12), `weather-alerts` (14). Calendar is a List/Calendar toggle inside Maintenance.
- 2026-10-03 [S3] CROSS-STREAM REQUEST to S2 (`web/js/core/data.js`): export `api(action, extra)` returning the parsed JSON response of an Apps Script action using the stored URL, key and device. S3 calls it for `testAlert` and `syncCalendar` (looked up as `HB.api` or `HB.callApi`; shows "Not connected yet" if missing).
- 2026-10-03 [S3] CROSS-STREAM REQUEST to S2: `HB.deviceLabel()` (optional) returning the device label so `task_log.by` is filled; S3 falls back to localStorage `hb.device` or blank.
- 2026-10-03 [S3] CROSS-STREAM REQUEST to S2: if the router wants view CSS loaded by itself, say so; S3 views currently inject `css/maintenance.css` themselves via a relative `<link>`.
- 2026-10-03 [S3] CROSS-STREAM NOTE for S1: `testAlert` must read `settings.notify` where `value` is a JSON string `{"emails":[...]}`; `settings.alerts` value is `{"rules":[...]}`. S3 writes rows with `id` equal to the key.
