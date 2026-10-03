# Human steps

Each stream appends its own section here. Numbered, click-by-click.

## S6: Data, house facts, docs

1. (2 min) Load the receipts, after the backend is deployed. In a terminal in the repo folder run `node tools/import-receipts.mjs --url "PASTE_EXEC_URL" --key "YOUR KEY" --dry-run`, check the counts (28 tools, 113 expenses, 6 projects, 1 room), then run it again without `--dry-run`. Safe to repeat.
2. (2 min) Fill in house facts: open https://www.zillow.com/homedetails/353-Washington-St-Canton-MA-02021/184093596_zpid/ in your browser (automated reads were blocked), note year built, square feet, floors and lot size, and enter them in the app once a settings screen exists, or type them in the `settings` tab of the Sheet (row `house`).
3. (1 min) Confirm the house location: in Google Maps right-click your house, click the numbers at the top of the menu to copy latitude and longitude, and check they match the Sheet's `settings` row `house` (default lat 42.158, lon -71.145). Weather alerts use this.
4. (1 min) In the vault folder `Areas/Home Projects/House Bible/`, decide what to do with the stray `Radiators.md.gdoc`. Nothing was deleted.
