import test from 'node:test';
import assert from 'node:assert/strict';
import { levelsFromRooms, levelKind, radiators, radStatus, itemsByLevel, sequence, budgetRows, wheelMarkers } from './visuals-logic.js';

test('levels order top to bottom; empty house still has two', () => {
  assert.deepEqual(levelsFromRooms([{ floor: '1st floor' }, { floor: 'Basement' }, { floor: '2nd floor' }, { floor: 'Attic' }]), ['Attic', '2nd floor', '1st floor', 'Basement']);
  assert.deepEqual(levelsFromRooms([]), ['1st floor', 'Basement']);
  assert.equal(levelKind('Basement'), 'below');
  assert.equal(levelKind('Attic'), 'roof');
});

test('radiators come from assets; status reads notes', () => {
  const a = [{ id: 1, name: 'Radiator, living room', notes: 'spits at vent' }, { id: 2, name: 'Boiler', kind: 'system' }, { id: 3, name: 'Radiator den', notes: '' }];
  assert.deepEqual(radiators(a).map(r => r.id), [1, 3]);
  assert.equal(radStatus(a[0]), 'bad');
  assert.equal(radStatus(a[2]), 'unk');
});

test('itemsByLevel groups by room floor', () => {
  const m = itemsByLevel({
    rooms: [{ id: 'r1', floor: 'Basement' }, { id: 'r2', floor: '1st floor' }],
    assets: [{ id: 'a', name: 'Boiler', kind: 'system', room: 'r1' }, { id: 'b', name: 'Radiator', kind: 'other', room: 'r2' }],
    shutoffs: [{ id: 's', room: 'r1' }], projects: [{ id: 'p', room: 'r2', status: 'active' }, { id: 'q', room: 'r2', status: 'done' }],
  });
  assert.equal(m.get('Basement').systems.length, 1);
  assert.equal(m.get('Basement').shutoffs.length, 1);
  assert.equal(m.get('1st floor').radiators.length, 1);
  assert.equal(m.get('1st floor').projects.length, 1);
});

test('sequence: phases by dependency, cycles reported, done ignored', () => {
  const p = [{ id: 'a', name: 'A', priority: 'Cosmetic', status: 'idea' }, { id: 'b', name: 'B', priority: 'Safety', status: 'idea', deps: '["a"]' }, { id: 'c', name: 'C', status: 'done' },
    { id: 'x', name: 'X', status: 'idea', deps: ['y'] }, { id: 'y', name: 'Y', status: 'idea', deps: ['x'] }];
  const s = sequence(p);
  assert.deepEqual(s.phases.map(ph => ph.map(q => q.id)), [['a'], ['b']]);
  assert.deepEqual(s.cyclic.map(q => q.id).sort(), ['x', 'y']);
});

test('budgetRows: spent from linked expenses, estimate from unpurchased materials at cheapest price', () => {
  const r = budgetRows({
    projects: [{ id: 'p', name: 'P', budget: 500, status: 'active' }, { id: 'z', name: 'empty', status: 'idea' }],
    materials: [{ project: 'p', qty: 2, price_hd: 10, price_hf: 8, have: 0 }, { project: 'p', qty: 1, price_hd: 99, have: 1 }],
    expenses: [{ project: 'p', amount: 25.5 }, { project: 'other', amount: 100 }],
  });
  assert.deepEqual(r, [{ id: 'p', name: 'P', budget: 500, spent: 25.5, est: 16 }]);
});

test('wheelMarkers splits frequent tasks out', () => {
  const occ = t => t.n;
  const { dots, frequent } = wheelMarkers([{ id: 1, n: ['2026-03-01'] }, { id: 2, n: Array.from({ length: 30 }, (_, i) => `2026-01-${i + 1}`) }, { id: 3, n: ['2026-05-01'], active: 0 }], 2026, occ);
  assert.equal(dots.length, 1);
  assert.equal(frequent.length, 1);
});
