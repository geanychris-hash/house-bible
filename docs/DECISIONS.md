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
- 2026-10-03 [S4] Views do not depend on `HBui.openForm` or `HBui.h`: `web/js/views/rooms-shared.js` has its own small `h`, modal and form builder (types text, textarea, num, date, time, select, ref, bool, files, length). Reason: core/ui.js did not exist yet and its form spec was not fixed. Easy to swap later.
- 2026-10-03 [S4] Shared S4 helpers live in `rooms-shared.js` and `rooms-units.js` (pure, unit tested) so they match the `rooms*` ownership glob. All S4 CSS classes are prefixed `rec-`, with fallbacks for token names, in `web/css/{rooms,documents,sensitive,qr}.css`.
- 2026-10-03 [S4] Views route themselves from `location.hash`: `#/rooms`, `#/rooms/<id>`, `#/assets/<id>`, `#/documents/<id>`, plus aliases `#/room/<id>`, `#/asset/<id>`, `#/document/<id>`. Filters via query: `#/documents?room=<id>`, `#/assets?room=<id>`.
- 2026-10-03 [S4] `files` fields are saved as a JSON string of ids (`["id1","id2"]`); reading accepts an array, a JSON string or a bare id. The single `documents.file` is a plain id string.
- 2026-10-03 [S4] Local file fallback: if `core/files.js` is missing, files are stored in IndexedDB (`hb.s4.localfiles`) with ids starting `local`, images downscaled to 1600 px JPEG. They stay on that device only. With the real HBFiles present the fallback is not used.
- 2026-10-03 [S4] Sensitive notes: `settings` row `crypto` holds `{salt, check}`. `check` is an extra field (a known string encrypted with the key) so a wrong passphrase is rejected before any item is read or written. Contract only listed `salt`; extra field is harmless. "Remember on this device" stores a non-extractable CryptoKey in IndexedDB (not the passphrase). Note label and hint are plain text and the UI says so.
- 2026-10-03 [S4] Setup of the passphrase calls `HB.syncNow()` first and refuses if another device already created one, to avoid two salts. Not a lock; two devices set up in the same minute could still collide.
- 2026-10-03 [S4] QR encoder is our own (byte mode, level M, versions 1-10, 213 bytes max); no vendored library, so no licence file. Decoded back correctly with OpenCV for versions 1, 2, 5, 6, 8, 10. Shutoff labels link to the Emergency screen (`#/emergency`); asset labels to `#/asset/<id>`. Label base address is typed once and remembered per device.
- 2026-10-03 [S4] Emergency screen is registered by `shutoffs.js` as view id `emergency`, order 5. It only reads the local cache. It hard-codes safety advice (leave and call 911 for gas, licensed pro for gas/boiler/main electrical) and lists contacts whose trade matches plumb/electric/gas/heat/hvac/boiler/oil/emergency/utility/water/steam.
- 2026-10-03 [S4] Warranty tracker window is 90 days; document expiry window is 60 days.
- 2026-10-03 [S4] View ids and nav order: emergency 5, documents 20, rooms 30, assets 40, shutoffs 50, contacts 60, steam 70, sensitive 80 (title "Secret notes"), qr 90. Icon names used: alert, file, home, box, power, phone, flame, lock, qr.

## Contract requests

## Cross-stream requests
- 2026-10-03 [S4 -> S2] router: please route `#/<viewId>/<rest>` to the view with that id (the view reads `location.hash` itself), and treat `#/room/<id>`, `#/asset/<id>`, `#/document/<id>` as aliases for `rooms`, `assets`, `documents`. Also do not re-render a view on a hash change that stays inside the same view id; S4 views handle that themselves. Needed for QR labels (`#/asset/<id>`).
- 2026-10-03 [S4 -> S2] files.js: please add `HBFiles.blob(fileId) -> Promise<Blob>` so Documents can offer a real Download button. Until then Download falls back to `HBFiles.open`.
- 2026-10-03 [S4 -> S2] files.js: shutoff photos and the Emergency screen need `thumbUrl` results cached in IndexedDB so they show with no network. Please keep that cache across sessions.
- 2026-10-03 [S4 -> S2] sw.js: precache `web/js/views/*` and `web/css/*` for S4 so the Emergency screen opens offline. Views also load `../core/ui.js` and `../core/files.js` through dynamic import and tolerate them missing.
- 2026-10-03 [S4 -> S2] ui.js: S4 uses its own `toast`/modal CSS; if ui.js exports `toast`, S4 calls it (`HBui.toast(msg)`).
- 2026-10-03 [S4 -> S1] schema: `settings` row `crypto` stores `{salt, check}` inside `value`; nothing to change if `value` is a free json string.
- 2026-10-03 [S4 -> S6] seed: pass `HB.save('rooms', ...)` with `floor` values from `1st floor, 2nd floor, 3rd floor, Basement, Attic, Outside` so the room list sorts right.
