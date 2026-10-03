import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../web/js/core/plan.js';

test('installYear reads a 4-digit year from free text', () => {
  assert.equal(P.installYear('circa 1998'), 1998);
  assert.equal(P.installYear('2004-06-01'), 2004);
  assert.equal(P.installYear('built 1920s'), 1920);
  assert.equal(P.installYear(''), null);
  assert.equal(P.installYear(null), null);
  assert.equal(P.installYear('model 123456'), null);
  assert.equal(P.installYear('unknown'), null);
});

test('missing year goes to missing, not rows', () => {
  const f = P.lifespanForecast([{ id: 'a', name: 'Boiler', install_date: 'unknown', expected_life_years: 20 }], 2026);
  assert.equal(f.rows.length, 0);
  assert.equal(f.missing.length, 1);
});

test('zero or blank life is ignored entirely', () => {
  const f = P.lifespanForecast([{ id: 'a', install_date: '2000', expected_life_years: 0 }, { id: 'b', install_date: '2000', expected_life_years: '' }], 2026);
  assert.equal(f.rows.length + f.missing.length, 0);
  assert.equal(f.reserve, 0);
});

test('past due sorts first, flags at 3 years or less, reserve divides by max(remaining,1)', () => {
  const f = P.lifespanForecast([
    { id: 'a', name: 'Far', install_date: '2020', expected_life_years: 20, replace_cost: 1000 },
    { id: 'b', name: 'Old', install_date: '1990', expected_life_years: 20, replace_cost: 600 },
    { id: 'c', name: 'Soon', install_date: '2010', expected_life_years: 19, replace_cost: 900 },
    { id: 'd', name: 'Gone', install_date: '2000', expected_life_years: 10, deleted: 1, replace_cost: 5 },
  ], 2026);
  assert.deepEqual(f.rows.map(r => r.asset.id), ['b', 'c', 'a']);
  assert.equal(f.rows[0].remaining, -16); assert.equal(f.rows[0].past, true);
  assert.equal(f.rows[1].remaining, 3); assert.equal(f.rows[1].flag, true); assert.equal(f.rows[1].past, false);
  assert.equal(f.rows[2].flag, false);
  assert.equal(f.flagged, 2); assert.equal(f.pastDue, 1);
  assert.equal(f.reserve, 600 + 300 + 1000 / 14);
});

test('insurance value prefers replacement, then purchase, then matching expense', () => {
  const ex = [{ item: 'Dishwasher', amount: 700 }];
  assert.deepEqual(P.insuranceValue({ name: 'x', replacement_value: 900, purchase_price: 500 }, ex), { value: 900, source: 'replacement' });
  assert.deepEqual(P.insuranceValue({ name: 'x', purchase_price: '500' }, ex), { value: 500, source: 'purchase' });
  assert.deepEqual(P.insuranceValue({ name: 'Dishwasher' }, ex), { value: 700, source: 'expense' });
  assert.deepEqual(P.insuranceValue({ name: 'Couch' }, ex), { value: null, source: null });
});

test('insurance inventory totals and counts unvalued', () => {
  const r = P.insuranceInventory([{ name: 'B', replacement_value: 100 }, { name: 'A', purchase_price: 50 }, { name: 'C' }, { name: 'D', replacement_value: 9, deleted: 1 }], []);
  assert.equal(r.total, 150); assert.equal(r.unvalued, 1);
  assert.deepEqual(r.rows.map(x => x.asset.name), ['A', 'B', 'C']);
});
