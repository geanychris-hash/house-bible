// Lifespan and value fields for assets (gaps 3 and 4). Owned by G3; F0 ships empty stubs.
// lifespanFields(): openForm field specs for expected_life_years and replace_cost.
// valueFields(): openForm field specs for purchase_price, purchase_date and replacement_value.
// valueRows(asset): [[label, text], ...] shown in the asset detail list. Empty array shows nothing.
export function lifespanFields() { return []; }
export function valueFields() { return []; }
export function valueRows(asset) { return []; }
