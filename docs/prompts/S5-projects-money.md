# S5 Projects and money (branch s5-projects, WAVE 2; owns web/js/views/{projects,materials,expenses,tools,utilities,reports}*.js, web/js/core/plan.js and matching css)
Read 00-common.md first.

Deliver:
1. `projects.js`: port the v1 project and planning logic (`legacy/v1/js/plan.js`, `views.js`) to the new tables: priority Safety, Damage, Comfort, Cosmetic; dependencies; Kahn sequencing with cycle reporting; season; budget versus spend; room link; steps checklist; pro or DIY flag. Put the pure logic in `js/core/plan.js` with `node --test` tests.
2. Materials per project with the best of Home Depot, Harbor Freight and other prices, a "have" flag, an estimate excluding items owned, and a tool check against `tools`.
3. `expenses.js` (nice to have): ledger with category, project, room, store, receipt link to a document, capital-improvement flag. Totals by project, room, month and year.
4. `tools.js`: own and want inventory, search, brand and model. The wishlist is just status `want`. Expose an `importTools(rows)` function for S6's receipts import.
5. `utilities.js` (nice to have): gas, oil, electric and water bills with a simple trend and a year-over-year compare.
6. `reports.js` (nice to have): improvement-cost tally for tax basis and resale (capital_improvement rows by year), and a printable insurance and resale inventory (assets and big purchases with photos and values), print stylesheet, no external services.

The cut-list optimizer is CUT. Do not port `cutlist.js`, `scan.js` or `finder.js`.
