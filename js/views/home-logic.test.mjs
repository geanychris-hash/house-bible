import test from 'node:test';
import assert from 'node:assert/strict';
import { expiring, setupChecklist, progress, lastSteam, alertLine, activeProjects, daysBetween } from './home-logic.js';

test('daysBetween', () => assert.equal(daysBetween('2026-10-03', '2026-10-10'), 7));

test('expiring: past and soon included, far future and deleted excluded, sorted', () => {
  const r = expiring({
    assets: [{ id: 'a', name: 'Boiler', warranty_expires: '2026-10-20' }, { id: 'b', name: 'Old', warranty_expires: '2026-09-01' }, { id: 'c', name: 'Far', warranty_expires: '2030-01-01' }, { id: 'd', name: 'Gone', warranty_expires: '2026-10-05', deleted: 1 }],
    documents: [{ id: 'e', title: 'Policy', kind: 'insurance', expires: '2026-11-01' }],
  }, '2026-10-03');
  assert.deepEqual(r.map(x => x.id), ['b', 'a', 'e']);
  assert.equal(r[0].days < 0, true);
  assert.equal(r[2].kind, 'insurance');
});

test('checklist: empty data has nothing done; filling in ticks steps', () => {
  const empty = setupChecklist({ assets: [], shutoffs: [], rooms: [], documents: [], house: null });
  assert.equal(progress(empty).done, 0);
  const some = setupChecklist({
    assets: [{ name: 'Weil-McLain boiler', kind: 'system', warranty_expires: '2030-01-01' }],
    shutoffs: [{ type: 'water' }, { type: 'gas' }, { type: 'electric' }],
    rooms: [{ name: 'Kitchen', wall_color: 'white' }, { name: 'Hall' }, { name: 'Den' }, { name: 'Paint: room not yet known', paint_notes: 'x' }],
    documents: [], house: { year_built: 1900 },
  });
  const done = Object.fromEntries(some.map(i => [i.id, i.done]));
  assert.deepEqual([done.house, done.boiler, done.shutoffs, done.panel, done.rooms, done.paint, done.warranties, done.documents, done.waterheater], [true, true, true, true, true, true, true, false, false]);
});

test('placeholder paint room does not count as a real room or as paint done', () => {
  const c = setupChecklist({ assets: [], shutoffs: [], rooms: [{ name: 'Paint: room not yet known', paint_notes: 'x' }], documents: [], house: null });
  const d = Object.fromEntries(c.map(i => [i.id, i.done]));
  assert.equal(d.rooms, false);
  assert.equal(d.paint, false);
});

test('lastSteam picks newest', () => {
  assert.equal(lastSteam([{ id: 1, date: '2026-10-01', time: '08:00' }, { id: 2, date: '2026-10-02', time: '07:00' }, { id: 3, date: '2026-10-02', time: '09:00' }]).id, 3);
  assert.equal(lastSteam([]), null);
});

test('alertLine states', () => {
  assert.equal(alertLine(null, null).level, 'warn');
  assert.match(alertLine({ rules: [{ id: 'f', enabled: false }] }, { emails: ['a@b.c'] }).text, /off/);
  assert.match(alertLine({ rules: [{ id: 'f', enabled: true }] }, { emails: [] }).text, /no email/);
  assert.equal(alertLine({ rules: [{ id: 'f', label: 'Freeze', enabled: true }] }, { emails: ['a@b.c'] }).level, 'good');
});

test('activeProjects orders by priority', () => {
  const r = activeProjects([{ name: 'b', status: 'active', priority: 'Cosmetic' }, { name: 'a', status: 'active', priority: 'Safety' }, { name: 'c', status: 'idea', priority: 'Safety' }]);
  assert.deepEqual(r.map(p => p.name), ['a', 'b']);
});
