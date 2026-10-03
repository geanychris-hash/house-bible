import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, planImport, findInput, PLACEHOLDER_ROOM } from './import-receipts.mjs';

const receipt = JSON.parse(fs.readFileSync(findInput('receipt-import.json'), 'utf8'));
const csvText = fs.readFileSync(findInput('receipts-line-items.csv'), 'utf8');
void path; void fileURLToPath;

test('parseCsv handles quotes and doubled quotes', () => {
  const r = parseCsv('a,b\n"x, y","say ""hi"""\n');
  assert.deepEqual(r, [{ a: 'x, y', b: 'say "hi"' }]);
});

test('imports 28 tools, 113 expenses, 6 project ideas, 1 placeholder room', () => {
  const { rows } = planImport({ receipt, csvRows: parseCsv(csvText) });
  assert.equal(rows.tools.length, 28);
  assert.equal(rows.expenses.length, 113);
  assert.equal(rows.projects.length, 6);
  assert.ok(rows.projects.every(p => p.status === 'idea'));
  assert.equal(rows.rooms.length, 1);
  assert.equal(rows.rooms[0].name, PLACEHOLDER_ROOM);
  assert.match(rows.rooms[0].paint_notes, /Ultra Pure White/);
});

test('expense totals match the Receipts note (HF 1226.69, HD 810.96)', () => {
  const { rows } = planImport({ receipt, csvRows: parseCsv(csvText) });
  const sum = s => Math.round(rows.expenses.filter(e => e.store === s).reduce((t, e) => t + e.amount, 0) * 100) / 100;
  assert.equal(sum('Harbor Freight'), 1226.69);
  assert.equal(sum('Home Depot'), 810.96);
});

test('the two paint cans link to the placeholder room', () => {
  const { rows } = planImport({ receipt, csvRows: parseCsv(csvText) });
  const linked = rows.expenses.filter(e => e.room === rows.rooms[0].id);
  assert.equal(linked.length, 2);
});

test('re-running against what was written adds nothing', () => {
  const first = planImport({ receipt, csvRows: parseCsv(csvText) });
  const existing = { ...first.rows };
  const second = planImport({ receipt, csvRows: parseCsv(csvText), existing });
  for (const t of Object.keys(second.rows)) assert.equal(second.rows[t].length, 0, t);
});

test('a tool Chris already typed by name is not duplicated', () => {
  const existing = { tools: [{ id: 'abc', name: '25 FT. tape measure', deleted: 0 }] };
  const { rows, skipped } = planImport({ receipt, csvRows: [], existing });
  assert.equal(rows.tools.length, 27);
  assert.equal(skipped.tools, 1);
});

test('an existing room with the same name is reused, not edited', () => {
  const existing = { rooms: [{ id: 'room1', name: PLACEHOLDER_ROOM, deleted: 0 }] };
  const { rows } = planImport({ receipt, csvRows: parseCsv(csvText), existing });
  assert.equal(rows.rooms.length, 0);
  assert.equal(rows.expenses.filter(e => e.room === 'room1').length, 2);
});
