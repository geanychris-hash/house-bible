# F0 Foundation status (branch f0-schema)

## Done
- `apps-script/build.mjs` SPEC: appended `task_log.contact`, `expenses.contact`; `assets.expected_life_years/replace_cost/purchase_price/purchase_date/replacement_value`; `tools.location/lent_to`; `utilities.hdd`; `belonging` added to `assets.kind`. `schema.json`, `Schema.gs`, `dist/HouseBible-all.gs` rebuilt.
- API action `history {limit, table?, id?}` in `Api.gs` (newest first from the changelog tab; default 100, max 500). Mirrored in `web/dev/mock-server.mjs`.
- Stub seams (empty output, errors swallowed by callers): `assets-history.js`, `assets-values.js`, `contacts-jobs.js`, `reports-forecast.js`. Wired into `assets.js` (detail panel, edit form, kind list), `contacts.js` (card) and `reports.js` (Lifespan tab only when a node is returned; insurance section on Inventory; Reports now loads `tasks`).
- `web/js/core/schema.js` num types for new columns; `views.json` regenerated.
- CONTRACT v3 (section 12 plus table, API and ownership edits), DECISIONS, HUMAN-STEPS (clasp push and redeploy).

## Tested
- `node --check` on every JS file touched. `node --test` on all 12 test files: 130 pass, including 2 new tests (history, v3 columns).
- Mock server plus built-in browser at 400 and 1200 px: assets list, asset detail (with new-column data), add-asset form, contacts, reports, tools, utilities, home, emergency all render; no horizontal scroll; no page errors.
- Only console message: the in-app browser could not register the service worker ("unknown error fetching the script"). It is the preview environment, not this change; not retested elsewhere.

## NOT tested
- Real Apps Script deploy: `history` and the new columns are verified only against the in-repo Apps Script emulator and the mock server. Chris must run the F0 steps in HUMAN-STEPS.
- Playwright itself (not installed); the built-in browser was used instead.
- Phone, iPhone, service worker behaviour.

## For Wave 1
- Fill only the seam modules named in CONTRACT section 12. Do not edit the call sites.
- If you add a view file, run `node web/dev/gen-views.mjs`; Integration should regenerate `views.json`, not hand-merge it.
- `lifespanFields()` and `valueFields()` return openForm field arrays and are inserted after "Warranty expires" in the asset form.
