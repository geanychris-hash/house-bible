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
- 2026-10-03 [S6] Receipt import uses content-derived ids and name checks, so reruns and manual edits are safe; returns stay as negative expense rows (net totals match the Receipts note).
- 2026-10-03 [S6] Paint with no room named goes on a placeholder room "Paint: room not yet known" and its two can purchases link to it; Chris moves the note to the real room then deletes the placeholder. Home checklist ignores that room.
- 2026-10-03 [S6] Zillow and Redfin returned 403 and Realtor.com was blocked for the fetch tool, so seed/house.json holds address and heat only; year built, sqft, floors, lat, lon are null (not guessed). Home checklist asks Chris.
- 2026-10-03 [S6] Radiators are assets whose name or kind contains "radiator", placed by room. There is no status column, so visuals colour them from keywords in notes. Heating season on the year wheel is assumed Oct 15 to May 1.
- 2026-10-03 [S6] Home links to a section only if that view is registered; recur.js and consumable status are imported dynamically so Home still loads before S3 merges.
## Cross-stream requests (S6)
- 2026-10-03 [S6] To S2: Home screen has no link to a house-facts/settings editor (checklist step "House facts" links to a view id `settings`, which does not exist yet). Please provide one or tell S7 to.
- 2026-10-03 [S6] To S1: settings.house default lat/lon (42.158, -71.145) is unverified; seed/house.json leaves them null on purpose, so do not load it over the defaults.
