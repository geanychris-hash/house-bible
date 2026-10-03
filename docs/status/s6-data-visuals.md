# S6 status: data, Home, visuals, docs

Branch `s6-data`. All six items in the S6 prompt are delivered. Visuals were done last as asked.

## What works (tested)
- `tools/import-receipts.mjs` (+ `tools/import-receipts.test.mjs`, 7 tests): 28 tools, 113 expense rows, 1 placeholder room carrying the two Behr paint notes (the two paint-can expenses link to it), 6 project ideas (status `idea`) from the Receipts note. Net totals match the note (Harbor Freight 1226.69, Home Depot 810.96). Has `--dry-run`. Ran against the S2 mock server: wrote 148 rows, second run wrote 0. Inputs copied to `seed/` (also searched in Downloads and the vault folder).
- `web/js/views/home.js` + `home-logic.js` (6 tests): Today (overdue/due via S3 `recur.js`), expiring warranties and documents, low or due supplies, active projects, last steam entry, weather-alert status line (reports setup only, not whether an alert fired), setup checklist with progress and hide. Checked in the built-in browser against the mock server loaded with S3's 43 tasks, the receipts import and sample rows: renders, no horizontal scroll at 400 px.
- `web/js/views/visuals.js` + `visuals-logic.js` (6 tests): year wheel, house cutaway, steam diagram, project flow, budget chart in tabs. In the browser all five tabs render with data, no overflow at 400 px.
- `seed/house.json`, `README.md`, v2 vault notes (General, replacing the stale two; technical copy in the Claude vault), HUMAN-STEPS and DECISIONS entries.
- Run: `node --test tools/import-receipts.test.mjs web/js/views/*.test.mjs` (20 pass). `node --check` clean on all my JS.

## NOT tested
- House facts: Zillow and Redfin returned 403, Realtor.com was blocked for the fetch tool. Year built, sqft, floors, lat, lon are null in `seed/house.json`. Nothing guessed.
- Screenshots timed out (pane hidden), so none of Home or Visuals was looked at visually. Layout and dark mode were checked by DOM measurement only. Colours, SVG label overlap and the look at 1200 px are unseen.
- Playwright was not available; testing used the built-in browser. Console had earlier errors from a mismatched test harness (since fixed) that I could not clear from the log; I did not see new ones.
- Real backend, phones, iPhone, install, calendar, email.
- Home's links to `projects`, `steam`, `assets`, `documents`, `rooms`, `shutoffs`, `settings` were not followed, because S4/S5 views were not in my test build. Home hides a link whose view is not registered. Visuals item links use `#/<view>/<id>`; confirm S4/S5 accept an id in the route.
- Vault notes were written but not opened in Obsidian.

## For the next stream (S7)
- `settings` view: Home's "House facts" checklist step links to view id `settings`; no stream owns that screen (see DECISIONS cross-stream requests).
- `home.js` registers id `home` and replaces S2's placeholder; `visuals` is order 90. Regenerate `views.json` after merging (`home-logic.js` and `visuals-logic.js` are listed there too, harmless).
- Run `tools/import-receipts.mjs` once against the real backend after deploy (HUMAN-STEPS S6 step 1).
- Do not load `seed/house.json` over S1's defaults while its values are null.
