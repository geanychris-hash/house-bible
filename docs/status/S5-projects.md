# S5 Projects and money: status

Branch `s5-projects`. All six deliverables built.

## What works
- `web/js/core/plan.js`: pure logic. Priority and season ordering, Kahn sequencing with cycle reporting (cycles and blocked-behind-cycle listed separately), best price across Home Depot, Harbor Freight and other, estimate that excludes owned items, shopping list grouped by cheapest store, tool matching, tool-import dedupe, expense, utility (trend, year over year) and report math.
- `views/projects.js`: pile, Order (phases), Shopping, Tool check, and a detail page (steps checklist, dependencies with circular warning, materials, tools needed, spending vs budget, mark done, pro or DIY, room link).
- `views/materials.js`: per-project material cards (phone friendly) and the shopping list.
- `views/expenses.js`: ledger, totals by project, room, month, year, year filter, CSV, receipt link opens the document's file, capital-improvement flag. `editExpense` is exported and used from project detail.
- `views/tools.js`: own and wishlist tabs, search, brand and model, "Got it" moves want to own. `importTools(rows)` exported for S6.
- `views/utilities.js`: bills by kind, bar trend, latest-year versus previous-year by month, change percent, cost per unit.
- `views/reports.js`: improvement tally by year (print, CSV) and printable inventory (assets with photos, big purchases over an adjustable amount, CSV).
- `css/projects.css` with print rules. Cut-list, scan and finder were not ported.

## How I tested
- `node --test tests/s5/plan.test.mjs`: 16 tests pass.
- `node --check` on every JS file: pass.
- Browser harness (`tests/s5/harness`, run `node tests/s5/harness/server.mjs`, open http://localhost:8123/index.html): S2's ui.js, router.js and files.js did not exist yet, so the harness supplies throwaway stubs for them and uses the real `data.js` stub. In Chromium at 400 px and 1200 px: every view rendered, no horizontal scroll, no console or page errors, and I exercised new project, add step, add material and price edit, cycle warning, add expense from a project, import tools, inventory with photo thumbnails.

## Not tested
- The real S2 `ui.js`, `router.js`, `files.js`, and the real sync layer. I coded to the CONTRACT section 8 interface; assumptions about `openForm` (ref fields, async onSave returning false) are in DECISIONS under Cross-stream requests. If S2's `openForm` differs, `editProject`, `editExpense`, `editTool`, `editBill` are the only places to adjust.
- Playwright (not installed here); I used the built-in browser instead. No phone, iPhone, print preview, real photos or Drive.
- Print layout was not inspected; the CSS hides common shell chrome names that may not match S2's.
- Dark mode not visually checked (colours come from tokens with system fallbacks).

## For the next stream
- Tools needed per project are stored in `projects.parts` as `{"tools":[...]}` (contract request logged).
- Nav ids and order: projects 40, expenses 45, tools 46, utilities 47, reports 48.
- S6: use `importTools` from `views/tools.js`.
