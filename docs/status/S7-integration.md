# S7 status: integration

Branch `integration`, merged into `main`. All of s1 through s6 merged; doc conflicts (DECISIONS, HUMAN-STEPS) were kept from both sides, no code conflicts.

## Verified
- `node --check` on every JS file: pass. 12 test files, 139 tests, all pass (`node --test <file>` for each `*.test.mjs`).
- Mock server with seed (43 tasks, receipts import) loaded: all 19 views register and render at 400 px and 1200 px, no console errors, no horizontal scroll (headless Chrome via playwright-core).
- Save, edit, read, soft delete on 14 tables, then sync: pass. Add contact through the UI form: pass. PDF upload and thumbnail: pass. Task log entry: pass.
- Offline edit then reconnect: 3 queued edits pushed, seen from a second device. Two-device conflict (both offline, later edit wins): pass.
- Gaps found and fixed: no `settings` view (Home linked to it), `HBFiles.blob` and `HB.deviceLabel` missing. Added.

## NOT verified
- Real Apps Script backend (no URL or key available). CORS and redirect behavior against Google, calendar sync, weather email, backups, the key hash: untested live.
- Real devices: Samsung, iPhone, install to home screen, camera, wife's device. Steps are in `docs/HUMAN-STEPS.md` section S7.
- Only the data layer was driven for most tables; edit and delete through each view's own UI were not clicked through except contacts add.
- GitHub Pages deploy (`tools/deploy-pages.ps1`) not run. Dark mode not eyeballed.
- `views.json` lists helper modules (e.g. `home-logic`) as views; harmless, they register nothing.
