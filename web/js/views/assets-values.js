// Lifespan and value fields for assets (gaps 3 and 4). Owned by G3.
// lifespanFields(): openForm field specs for expected_life_years and replace_cost.
// valueFields(): openForm field specs for purchase_price, purchase_date and replacement_value.
// valueRows(asset): [[label, text], ...] shown in the asset detail list. Empty array shows nothing.
import { installYear, toNum } from '../core/plan.js';

const usd = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; };
const pos = v => { const n = toNum(v); return n != null && n > 0 ? n : null; };

export function lifespanFields() {
  return [
    { key: 'expected_life_years', label: 'Expected life (years)', type: 'num', placeholder: 'typical, check yours',
      help: 'Used for the replacement forecast in Reports. Needs a 4-digit year in "Install date" to work.' },
    { key: 'replace_cost', label: 'Estimated replacement cost ($)', type: 'num', placeholder: 'typical, check yours' },
  ];
}
export function valueFields() {
  return [
    { key: 'purchase_price', label: 'Purchase price ($)', type: 'num' },
    { key: 'purchase_date', label: 'Purchase date', type: 'date' },
    { key: 'replacement_value', label: 'Replacement value for insurance ($)', type: 'num', help: 'What it would cost to buy again today. Reports use this first.' },
  ];
}
export function valueRows(asset) {
  const rows = [], life = pos(asset.expected_life_years), year = installYear(asset.install_date);
  if (life) rows.push(['Expected life', `${life} years` + (year ? `, replace around ${year + life}` : '')]);
  if (pos(asset.replace_cost)) rows.push(['Replace cost', usd(asset.replace_cost)]);
  if (pos(asset.purchase_price)) rows.push(['Purchase price', usd(asset.purchase_price)]);
  if (asset.purchase_date) rows.push(['Purchased', day(asset.purchase_date)]);
  if (pos(asset.replacement_value)) rows.push(['Replacement value', usd(asset.replacement_value)]);
  return rows;
}
