// Run: node --test web/js/core/search.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEARCH_TABLES, normalize, words, scoreRecord, searchData, subtitle } from './search.js';

const spec = t => SEARCH_TABLES.find(s => s.table === t);
const data = {
  rooms: [{ id: 'r1', name: 'Kitchen', flooring: 'Oak' }, { id: 'r2', name: 'Basement' }],
  assets: [
    { id: 'a1', name: 'Steam boiler', brand: 'Burnham', model: 'IN5', room: 'r2', notes: 'serviced in fall' },
    { id: 'a2', name: 'Dishwasher', brand: 'Bosch', room: 'r1', notes: 'boiler-safe? no' },
    { id: 'a3', name: 'Old boiler', brand: 'Weil', deleted: 1 },
  ],
  contacts: [{ id: 'c1', name: 'Dana Plumbing', trade: 'plumber', phone: '781-555-0100' }],
  documents: [{ id: 'd1', title: 'Boiler manual', tags: 'heat, manual', notes: '' }],
  sensitive: [{ id: 's1', label: 'boiler code', ciphertext: 'zzz', iv: 'x', hint: 'boiler' }],
  tools: [{ id: 't1', name: 'Café wrench', lent_to: 'Sam' }],
};

test('normalize folds case and accents', () => {
  assert.equal(normalize('Café WRENCH'), 'cafe wrench');
  assert.equal(normalize(null), '');
  assert.deepEqual(words('  Steam   Boiler '), ['steam', 'boiler']);
});

test('every word must match, in any field', () => {
  const a = spec('assets');
  assert.ok(scoreRecord(a, data.assets[0], words('burnham boiler')) > 0);
  assert.equal(scoreRecord(a, data.assets[0], words('burnham dishwasher')), 0);
  assert.equal(scoreRecord(a, data.assets[0], []), 0);
});

test('name hit outranks a notes hit', () => {
  const a = spec('assets');
  const q = words('boiler');
  assert.ok(scoreRecord(a, data.assets[0], q) > scoreRecord(a, data.assets[1], q));
});

test('soft-deleted rows never match', () => {
  assert.equal(scoreRecord(spec('assets'), data.assets[2], words('boiler')), 0);
  const groups = searchData(data, 'boiler');
  const ids = groups.flatMap(g => g.items.map(i => i.row.id));
  assert.ok(!ids.includes('a3'));
});

test('groups follow table order and the sensitive table is never indexed', () => {
  const groups = searchData(data, 'boiler');
  assert.deepEqual(groups.map(g => g.spec.table), ['assets', 'documents']);
  assert.ok(!SEARCH_TABLES.some(s => s.table === 'sensitive' || s.table === 'settings'));
  assert.deepEqual(groups[0].items.map(i => i.row.id), ['a1', 'a2']);
});

test('room name is searchable for items in that room', () => {
  const groups = searchData(data, 'basement boiler');
  assert.deepEqual(groups.flatMap(g => g.items.map(i => i.row.id)), ['a1']);
});

test('accent-insensitive and field-specific hits (phone, lent_to)', () => {
  assert.equal(searchData(data, 'cafe').length, 1);
  assert.equal(searchData(data, 'sam')[0].spec.table, 'tools');
  assert.equal(searchData(data, '555-0100')[0].spec.table, 'contacts');
});

test('empty query and no match give no groups; caps per group', () => {
  assert.deepEqual(searchData(data, '   '), []);
  assert.deepEqual(searchData(data, 'zzzzz'), []);
  const many = { assets: Array.from({ length: 20 }, (_, i) => ({ id: 'x' + i, name: 'Valve ' + i })) };
  const g = searchData(many, 'valve');
  assert.equal(g[0].items.length, 6);
  assert.equal(g[0].total, 20);
});

test('routes point at existing hash routes', () => {
  assert.equal(spec('assets').route({ id: 'a1' }), 'assets/a1');
  assert.equal(spec('rooms').route({ id: 'r1' }), 'rooms/r1');
  assert.equal(spec('materials').route({ id: 'm', project: 'p1' }), 'projects/p1');
  assert.equal(spec('contacts').route({ id: 'c1' }), 'contacts');
});

test('subtitle joins non-empty fields and the room', () => {
  assert.equal(subtitle(spec('assets'), data.assets[0], 'Basement'), 'Burnham / IN5 / Basement');
});
