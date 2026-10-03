# I1 Integration status (branch i1-integrate)

## Done
- Merged g2-service, g3-values, g1-search, g4-wall. One conflict (`web/sw.js` cache list), resolved by keeping both file sets. Cache version bumped to `hb2-4`. `views.json` regenerated (37 views).
- Gap 12: tools get "Stored where" and "Lent to" fields, shown on the card and searchable.
- Gap 7 (manual only): utilities get an optional `hdd` field; the bill list shows usage per degree day. No fetching.
- Gap 10: Settings has a "Change history" panel (last 50 changes via the `history` action; loads on tap, fails softly offline).
- Inventory CSV now uses `insuranceValue` (replacement, then purchase, then matching expense) with a `value_source` column.

## Tested
- `node --check` on all web JS; `node --test` on every `*.test.mjs`: 151 pass, 0 fail.
- Mock server plus built-in browser with seeded data: asset detail (lifespan, costs, service history with contractor), contacts (jobs and total), tools (location, lent to), utilities (per-HDD), `#/wall`, Reports Lifespan and Inventory tabs, Settings history list. No page errors. Only console message: service worker registration fails in the preview pane.

## NOT tested
- Real Apps Script backend (F0 columns and `history` need Chris's deploy, see HUMAN-STEPS).
- Phone, iPhone, service worker updates, real print preview, wall wake lock on a real screen.
- Search palette, 400 px layouts and the Done-dialog contractor select were not re-checked after merge (covered in G1 and G2 notes only).
- The Inventory explainer text still says cost is a guess from matching expenses.
