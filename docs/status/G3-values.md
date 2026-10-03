# G3 Lifespan forecast and insurance values (branch g3-values)

## Done
- `web/js/core/plan.js` (appended only): `installYear`, `lifespanInfo`, `lifespanForecast`, `insuranceValue`, `insuranceInventory`.
- `web/js/views/assets-values.js`: form fields for expected_life_years, replace_cost, purchase_price, purchase_date, replacement_value; detail rows (life with "replace around <year>", costs, dates). Life and cost placeholders read "typical, check yours"; no lifespan numbers are shipped. `belonging` kind was already in the asset form list from F0.
- `web/js/views/reports-forecast.js`: Lifespan tab (counts due in 3 years or less, past due, yearly set-aside; list sorted by time left with past-due and soon chips; "needs an install year" list) and an Insured values section on the Inventory tab (total, per-item value with source, serial, up to 4 photo thumbnails, print button).

## Rules as built
- Year = first 4-digit year (1600-2099) in install_date text. remaining = year + life - current year. Flag at 3 or less; past due when below 0.
- Life blank or 0 is ignored. Life set but no year goes to "needs an install year".
- Reserve = sum of replace_cost / max(remaining, 1) over forecast rows with a replace cost.
- Insured value: replacement_value, else purchase_price, else matchAssetCost; items with none are counted as "without a value". Soft-deleted assets skipped.

## Tested
- `node --check` on the three files; `tests/s5/g3-values.test.mjs` (6 tests: missing year, past due, zero life, sort, reserve, value fallback, totals) pass; all other test files still pass.
- Mock server plus built-in browser with 6 seeded assets (one with photo and serial, one belonging, a zero-life and a no-year case) at 400 and 1200 px: Lifespan tab, Inventory insured values, asset detail rows and edit form render; no horizontal scroll; forecast figures checked by hand. Only console error is the service worker fetch failure of the preview browser (same as F0).
- Print: confirmed by selector check that the nav, tab bar and buttons are hidden by existing print rules.

## NOT tested
- A real print preview or PDF. The house-name header still shows in print.
- Photos with real Drive thumbnails (mock server only), phone, real Apps Script.
- The existing Inventory CSV does not yet include the new value columns (reports.js is not mine).

## Note for integration
- Existing Inventory panel's per-asset cost still uses matchAssetCost only; the new Insured values section is the one that honours replacement/purchase value. I1 may want to point the CSV and that list at `insuranceValue`.
