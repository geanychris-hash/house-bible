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
- 2026-10-03 [S5] Optional: add `tools` (json array of text) to `projects` so tools needed is not hiding in `parts`. Needs S1 schema.json plus a one-time move of `parts.tools`.

## Cross-stream requests
- 2026-10-03 [S5 to S2] ui.js: S5 calls `HBui.openForm({title, fields, values, onSave, onDelete})` where onSave may be async and return false to keep the form open. Field types used: text, textarea, number, date, select (options = string array), and `{type:'ref', table, labelKey?}` (select from a table; labelKey defaults to name, documents use title). onSave receives `{k: value}`; ref value is the row id or empty string. `HBui.toast(msg)` also used.
- 2026-10-03 [S5 to S2] router.js: S5 views are registered with `registerView` and use `ctx.params?.id` to open a project directly (optional). Print: reports.css rules hide `nav, header.app-header, .app-nav, .bottom-nav, .tabbar` when printing; if the shell uses other names, add `@media print` hide rules for the shell chrome.
- 2026-10-03 [S5 to S2] css: views load `web/css/projects.css` themselves (link tag added once, relative to the module). It reads tokens --ink, --muted, --line, --surface, --surface-2, --accent, --accent-ink, --accent-soft, --bad, --warn, --good (and -bg variants), with system-colour fallbacks.
- 2026-10-03 [S5 to S6] `import { importTools } from '../views/tools.js'`; `await importTools([{name, category, status:'own'|'want', brand, model, notes}])` returns `{added, skipped, skippedRows}` and skips rows already present (same name and model).
- 2026-10-03 [S5] Project "tools needed" has no column in the contract. Stored in `projects.parts` as JSON `{"tools":[...]}` (the cut list is cut, so `parts` was free). Contract request below if S7 prefers a real column.
- 2026-10-03 [S5] JSON fields (`deps`, `steps`, `parts`, `photos`) are written as stringified JSON per CONTRACT section 3 and read tolerantly (string or already-parsed). Bools are written as 1/0 and read as 1, "1", true.
- 2026-10-03 [S5] Statuses are lowercase per the contract table (idea, planned, active, done, dropped); done and dropped projects leave sequencing, shopping and tool check. Pro or DIY is the `pro` bool (1 = Pro).
- 2026-10-03 [S5] Spend per project is the sum of `expenses` rows linked to the project (v1 had a separate purchases list; that is gone).
- 2026-10-03 [S5] Sequencing now reports real cycles and, separately, projects blocked behind a cycle (v1 lumped them together).
- 2026-10-03 [S5] Reports: capital-improvement tally counts expenses flagged capital_improvement, plus unflagged-blank expenses on projects flagged capital_improvement. Assets have no value column, so inventory cost is a best-guess match from an expense whose item text contains the asset name.
- 2026-10-03 [S5] Views register as projects (order 40), expenses (45), tools (46), utilities (47), reports (48). Materials and shopping live inside the Projects view (tabs and detail page) via `views/materials.js`.
