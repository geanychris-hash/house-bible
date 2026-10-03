import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../web/js/core/plan.js';

const proj = (id, o = {}) => ({ id, name: id, status: 'planned', priority: 'Comfort', season: 'Year-round', deps: '[]', ...o });
const names = ps => ps.map(p => p.id);

test('bestPrice picks the lowest positive price and ignores blanks', () => {
  assert.equal(P.bestPrice({ price_hd: 10, price_hf: '', price_other: 8 }).store, 'Other');
  assert.equal(P.bestPrice({ price_hd: 0, price_hf: null }), null);
  assert.equal(P.bestPrice({ price_hd: '12.5', price_hf: '9' }).price, 9);
});

test('estimate excludes owned items and multiplies qty', () => {
  const mats = [{ price_hd: 5, qty: 3 }, { price_hd: 100, qty: 1, have: 1 }, { price_hf: 2 }, { item: 'no price' }];
  assert.equal(P.materialsEstimate(mats), 17);
  assert.equal(P.lineTotal({ price_hd: 4, qty: 0 }), 4); // qty 0 counts as 1
});

test('projectSpent sums expenses for that project only', () => {
  const ex = [{ project: 'a', amount: '10.5' }, { project: 'a', amount: 4 }, { project: 'b', amount: 99 }, { project: 'a', amount: '' }];
  assert.equal(P.projectSpent('a', ex), 14.5);
});

test('sequence orders by dependency then priority, season, name', () => {
  const ps = [
    proj('paint', { priority: 'Cosmetic', deps: JSON.stringify(['wiring']) }),
    proj('wiring', { priority: 'Safety' }),
    proj('gutters', { priority: 'Damage' }),
    proj('trim', { priority: 'Damage', season: 'Fall' }),
  ];
  const s = P.sequence(ps);
  assert.deepEqual(s.phases.map(names), [['wiring', 'trim', 'gutters'], ['paint']]);
  assert.equal(s.cycles.length, 0);
});

test('sequence ignores deps on done, dropped, deleted or unknown projects', () => {
  const ps = [proj('a', { deps: JSON.stringify(['b', 'c', 'zzz']) }), proj('b', { status: 'done' }), proj('c', { status: 'dropped' })];
  assert.deepEqual(P.sequence(ps).phases.map(names), [['a']]);
});

test('sequence reports a cycle and projects blocked behind it', () => {
  const ps = [
    proj('a', { deps: JSON.stringify(['b']) }), proj('b', { deps: JSON.stringify(['a']) }),
    proj('c', { deps: JSON.stringify(['a']) }), proj('free'),
  ];
  const s = P.sequence(ps);
  assert.deepEqual(s.phases.map(names), [['free']]);
  assert.equal(s.cycles.length, 1);
  assert.deepEqual(names(s.cycles[0]).sort(), ['a', 'b']);
  assert.deepEqual(names(s.blocked), ['c']);
});

test('sequence catches a self dependency; deps accepted as array or string', () => {
  assert.equal(P.sequence([proj('x', { deps: ['x'] })]).cycles.length, 1);
  assert.deepEqual(P.projectDeps({ deps: ['a', 'a', ''] }), ['a']);
  assert.deepEqual(P.projectDeps({ deps: 'not json' }), []);
});

test('shopping groups by cheapest store, skips owned and closed projects', () => {
  const ps = [proj('p1'), proj('p2', { status: 'done' })];
  const ms = [
    { project: 'p1', item: 'screws', qty: 2, price_hd: 3, price_hf: 2 },
    { project: 'p1', item: 'paint', qty: 1, price_hd: 30 },
    { project: 'p1', item: 'owned', qty: 1, price_hd: 9, have: 1 },
    { project: 'p1', item: 'mystery' },
    { project: 'p2', item: 'old', price_hd: 5 },
  ];
  const s = P.shopping(ps, ms);
  assert.equal(s.total, 34);
  assert.deepEqual(Object.keys(s.byStore).sort(), ['Harbor Freight', 'Home Depot', 'No price yet']);
  assert.equal(s.rows.length, 3);
});

test('tools live in parts JSON and survive a round trip', () => {
  const p = { parts: '[]' };
  assert.deepEqual(P.projectTools(p), []);
  const parts = P.withTools(p, ['Pipe wrench', 'Drill']);
  assert.deepEqual(P.projectTools({ parts }), ['Pipe wrench', 'Drill']);
});

test('toolCheck matches inventory loosely and ignores wanted tools', () => {
  const ps = [proj('a', { parts: P.withTools({}, ['Drill', 'Stud finder']) }), proj('b', { parts: P.withTools({}, ['drill']) })];
  const inv = [{ name: 'Cordless drill/driver', status: 'own' }, { name: 'Stud finder', status: 'want' }];
  const tc = P.toolCheck(ps, inv);
  assert.deepEqual(tc.map(t => [t.name, t.own, t.projects.length]), [['Stud finder', false, 1], ['Drill', true, 2]]);
});

test('planToolImport dedupes and defaults to own', () => {
  const r = P.planToolImport([{ name: 'Hammer', model: '' }], [{ name: 'hammer' }, { name: 'Saw', brand: 'X' }, { name: 'Saw', brand: 'X' }, { name: ' ' }, { name: 'Level', status: 'want' }]);
  assert.deepEqual(r.toAdd.map(t => [t.name, t.status]), [['Saw', 'own'], ['Level', 'want']]);
  assert.equal(r.skipped.length, 3);
});

test('sumBy groups by month and year', () => {
  const ex = [{ date: '2026-01-05', amount: 10 }, { date: '2026-01-20', amount: 5 }, { date: '2025-12-01', amount: 1 }, { amount: 2 }];
  assert.deepEqual(P.sumBy(ex, P.monthOf).map(x => [x.key, x.total]), [['', 2], ['2025-12', 1], ['2026-01', 15]]);
  assert.deepEqual(P.sumBy(ex, P.yearOf).map(x => [x.key, x.count]), [['', 1], ['2025', 1], ['2026', 2]]);
});

test('utilityTrend gives change and cost per unit', () => {
  const rows = [{ kind: 'gas', date: '2026-02-01', amount: 150, usage: 100 }, { kind: 'gas', date: '2026-01-01', amount: 100 }, { kind: 'water', date: '2026-01-01', amount: 9 }];
  const t = P.utilityTrend(rows, 'gas');
  assert.equal(t.length, 2);
  assert.equal(t[0].delta, null);
  assert.equal(t[1].delta, 50);
  assert.equal(t[1].pct, 0.5);
  assert.equal(t[1].perUnit, 1.5);
});

test('yearOverYear compares latest year to the year before', () => {
  const rows = [
    { kind: 'oil', date: '2026-01-10', amount: 300 }, { kind: 'oil', date: '2025-01-12', amount: 200 },
    { kind: 'oil', date: '2026-03-01', amount: 50 }, { kind: 'oil', date: '2024-05-01', amount: 1 },
  ];
  const y = P.yearOverYear(rows, 'oil');
  assert.equal(y.year, 2026);
  assert.deepEqual([y.months[0].cur, y.months[0].prev, y.months[0].delta, y.months[0].pct], [300, 200, 100, 0.5]);
  assert.equal(y.months[2].prev, null);
  assert.equal(y.months[2].delta, null);
  assert.deepEqual(P.yearOverYear([], 'gas'), { year: null, months: [] });
});

test('improvementsByYear counts flagged expenses and unflagged ones on capital projects', () => {
  const ex = [
    { date: '2025-06-01', amount: 1000, capital_improvement: 1 },
    { date: '2026-02-01', amount: 500, capital_improvement: '1' },
    { date: '2026-03-01', amount: 40, capital_improvement: 0 },
    { date: '2026-04-01', amount: 60, project: 'roof', capital_improvement: '' },
    { date: '2026-04-02', amount: 70, project: 'paint' },
  ];
  const r = P.improvementsByYear(ex, [{ id: 'roof', capital_improvement: 1 }, { id: 'paint', capital_improvement: 0 }]);
  assert.equal(r.total, 1560);
  assert.deepEqual(r.years.map(y => [y.key, y.total]), [['2025', 1000], ['2026', 560]]);
});

test('matchAssetCost and bigPurchases', () => {
  const ex = [{ item: 'Water heater install', amount: 1800 }, { item: 'caulk', amount: 6 }];
  assert.equal(P.matchAssetCost({ name: 'Water heater' }, ex).amount, 1800);
  assert.equal(P.matchAssetCost({ name: 'Furnace' }, ex), null);
  assert.deepEqual(P.bigPurchases(ex, 250).map(e => e.amount), [1800]);
});
