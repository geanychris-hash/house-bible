import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceHistory, jobsFor } from './service-logic.js';

const tasks = [{ id: 't1', title: 'Flush boiler', asset: 'a1' }, { id: 't2', title: 'Other', asset: 'a2' }];
const logs = [
  { id: 'l1', task: 't1', date: '2026-01-05', cost: '120', contact: 'c1', note: 'ok' },
  { id: 'l2', task: 't1', date: '2026-06-01', cost: null, contact: '', note: '' },
  { id: 'l3', task: 't2', date: '2026-07-01', cost: 5, contact: 'c1' },
  { id: 'l4', task: 't1', date: '2026-08-01', deleted: 1 },
];
test('serviceHistory filters by asset, drops deleted, newest first', () => {
  const r = serviceHistory('a1', tasks, logs);
  assert.deepEqual(r.map(x => x.id), ['l2', 'l1']);
  assert.equal(r[1].cost, 120); assert.equal(r[0].cost, null);
});
test('serviceHistory empty when no tasks match', () => assert.deepEqual(serviceHistory('zz', tasks, logs), []));
test('jobsFor merges task_log and expenses with total', () => {
  const ex = [{ id: 'e1', item: 'Pipe', amount: 30.5, date: '2026-07-15', contact: 'c1' }, { id: 'e2', item: 'x', amount: 9, date: '2026-07-16', contact: 'c2' }];
  const j = jobsFor('c1', tasks, logs, ex);
  assert.deepEqual(j.rows.map(x => x.id), ['e1', 'l3', 'l1']);
  assert.equal(j.total, 155.5);
});
test('jobsFor with nothing', () => assert.deepEqual(jobsFor('c9', [], [], []), { rows: [], total: 0 }));
test('skips and snoozes are not jobs', () => {
  const l = [{ id: 's', task: 't1', date: '2026-01-01', contact: 'c1', note: '[skip] busy' }];
  assert.equal(jobsFor('c1', tasks, l, []).rows.length, 0);
});
