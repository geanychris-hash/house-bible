import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDue, occurrences, taskStatus, addMonths, makeLogNote, ruleText, lastDone } from './recur.js';

const T = (rule, start, extra = {}) => ({ id: 't1', rule, start, active: 1, ...extra });
const L = (date, note = '') => ({ task: 't1', date, note });

test('yearly: no logs, anchored on start month/day', () => {
  const t = T({ type: 'yearly' }, '2026-10-15');
  assert.equal(nextDue(t, [], '2026-10-03'), '2026-10-15');
  assert.deepEqual(occurrences(t, '2026-01-01', '2029-12-31'), ['2026-10-15', '2027-10-15', '2028-10-15', '2029-10-15']);
});
test('yearly: done on time moves to next year; done early (within lead) counts', () => {
  const t = T({ type: 'yearly' }, '2026-10-15');
  assert.equal(nextDue(t, [L('2026-10-16')], '2026-10-20'), '2027-10-15');
  assert.equal(nextDue(t, [L('2026-09-20')], '2026-09-21'), '2027-10-15'); // 25 days early
  assert.equal(nextDue(t, [L('2026-06-01')], '2026-06-02'), '2026-10-15'); // far too early: does not count
});
test('yearly: overdue then done today clears all missed years', () => {
  const t = T({ type: 'yearly' }, '2023-04-01');
  assert.equal(taskStatus(t, [], '2026-10-03').state, 'overdue');
  assert.equal(nextDue(t, [L('2026-10-03')], '2026-10-03'), '2027-04-01');
});
test('year boundary: December task done in January', () => {
  const t = T({ type: 'yearly' }, '2026-12-28');
  assert.equal(nextDue(t, [L('2027-01-03')], '2027-01-03'), '2027-12-28');
  const s = taskStatus(t, [], '2027-01-02');
  assert.equal(s.state, 'overdue'); assert.equal(s.overdueDays, 5);
});
test('leap day: yearly from Feb 29 falls on Feb 28 in common years', () => {
  const t = T({ type: 'yearly' }, '2024-02-29');
  assert.deepEqual(occurrences(t, '2024-01-01', '2028-12-31'), ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');
});
test('monthly: day clamps to month end but does not drift', () => {
  const t = T({ type: 'monthly', interval: 1 }, '2026-01-31');
  assert.deepEqual(occurrences(t, '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});
test('monthly interval 6 crosses year boundary', () => {
  const t = T({ type: 'monthly', interval: 6 }, '2026-10-25');
  assert.deepEqual(occurrences(t, '2026-01-01', '2028-01-01'), ['2026-10-25', '2027-04-25', '2027-10-25']);
  assert.equal(nextDue(t, [L('2026-10-25')], '2026-11-01'), '2027-04-25');
});
test('weekly: every 2 weeks from start', () => {
  const t = T({ type: 'weekly', interval: 2 }, '2026-10-05');
  assert.deepEqual(occurrences(t, '2026-10-01', '2026-11-10'), ['2026-10-05', '2026-10-19', '2026-11-02']);
  assert.equal(nextDue(t, [L('2026-10-05')], '2026-10-06'), '2026-10-19');
});
test('days: dog heartworm every 30 days', () => {
  const t = T({ type: 'days', interval: 30 }, '2026-10-01', { category: 'pet', subject: 'Rex' });
  assert.equal(nextDue(t, [], '2026-10-01'), '2026-10-01');
  assert.equal(taskStatus(t, [], '2026-10-01').state, 'due');
  assert.equal(nextDue(t, [L('2026-10-01')], '2026-10-02'), '2026-10-31');
  assert.equal(nextDue(t, [L('2026-10-01'), L('2026-10-31')], '2026-11-01'), '2026-11-30');
  assert.equal(nextDue(t, [L('2026-10-01'), L('2026-10-31'), L('2026-11-30')], '2026-12-01'), '2026-12-30'); // crosses year next
  assert.equal(nextDue(t, [L('2026-10-01'), L('2026-10-31'), L('2026-11-30'), L('2026-12-30')], '2026-12-31'), '2027-01-29');
  // given a few days late, the schedule stays anchored on start (not on the late date)
  assert.equal(nextDue(t, [L('2026-11-04')], '2026-11-05'), '2026-11-30');
  // 3 days overdue
  const s = taskStatus(t, [L('2026-10-01')], '2026-11-03');
  assert.equal(s.state, 'overdue'); assert.equal(s.overdueDays, 3);
  // many missed doses are all cleared by one completion
  assert.equal(nextDue(t, [L('2027-02-20')], '2027-02-20'), '2027-03-30');
});
test('days: status due within 7 days, upcoming beyond', () => {
  const t = T({ type: 'days', interval: 30 }, '2026-10-01');
  const logs = [L('2026-10-01')];
  assert.equal(taskStatus(t, logs, '2026-10-20').state, 'upcoming');
  assert.equal(taskStatus(t, logs, '2026-10-24').state, 'due');
  assert.equal(taskStatus(t, logs, '2026-10-24').days, 7);
});
test('after_done: next due is last completion plus N (all units)', () => {
  const mk = (interval, unit) => T({ type: 'after_done', interval, unit }, '2026-01-01');
  assert.equal(nextDue(mk(90, 'days'), [], '2026-01-05'), '2026-01-01');
  assert.equal(nextDue(mk(90, 'days'), [L('2026-03-01')], '2026-03-02'), '2026-05-30');
  assert.equal(nextDue(mk(2, 'weeks'), [L('2026-12-25')], '2026-12-26'), '2027-01-08');
  assert.equal(nextDue(mk(3, 'months'), [L('2026-11-30')], '2026-12-01'), '2027-02-28');
  assert.equal(nextDue(mk(1, 'years'), [L('2024-02-29')], '2024-03-01'), '2025-02-28');
  assert.equal(nextDue(mk(1, 'years'), [L('2023-02-28')], '2023-03-01'), '2024-02-28');
  // late completion shifts the schedule (unlike anchored rules)
  assert.equal(nextDue(mk(90, 'days'), [L('2026-03-01'), L('2026-06-10')], '2026-06-11'), '2026-09-08');
});
test('once: due on start, done after a log', () => {
  const t = T({ type: 'once' }, '2026-11-01');
  assert.equal(taskStatus(t, [], '2026-10-03').state, 'upcoming');
  assert.equal(taskStatus(t, [L('2026-11-02')], '2026-11-03').state, 'done');
  assert.equal(nextDue(t, [L('2026-11-02')], '2026-11-03'), null);
  assert.deepEqual(occurrences(t, '2026-01-01', '2026-12-31'), ['2026-11-01']);
});
test('seasonal: inside window is due, before is upcoming, done satisfies it', () => {
  const t = T({ type: 'seasonal', from: '04-01', to: '04-30' }, '2026-01-01');
  assert.equal(taskStatus(t, [], '2026-03-10').state, 'upcoming');
  assert.equal(taskStatus(t, [], '2026-03-28').state, 'due');
  const s = taskStatus(t, [], '2026-04-15');
  assert.equal(s.state, 'due'); assert.equal(s.windowEnd, '2026-04-30');
  assert.equal(nextDue(t, [L('2026-04-10')], '2026-04-15'), '2027-04-01');
  assert.equal(taskStatus(t, [], '2026-05-10').state, 'overdue');  // window missed, still recent
  assert.equal(nextDue(t, [], '2026-08-01'), '2027-04-01');        // lapsed long ago
});
test('seasonal: window that wraps the year end', () => {
  const t = T({ type: 'seasonal', from: '11-15', to: '02-15' }, '2026-01-01');
  assert.equal(taskStatus(t, [], '2027-01-10').state, 'due');
  assert.equal(taskStatus(t, [], '2027-01-10').due, '2026-11-15');
  assert.equal(taskStatus(t, [L('2026-12-01')], '2027-01-10').state, 'upcoming');
  assert.equal(nextDue(t, [L('2026-12-01')], '2027-01-10'), '2027-11-15');
  assert.deepEqual(occurrences(t, '2026-01-01', '2028-12-31'), ['2026-11-15', '2027-11-15', '2028-11-15']);
});
test('snooze defers the due date; a later completion cancels it; skip counts as done', () => {
  const t = T({ type: 'yearly' }, '2026-10-01');
  const sn = L('2026-10-05', makeLogNote('snooze', 'away', '2026-10-20'));
  assert.equal(nextDue(t, [sn], '2026-10-06'), '2026-10-20');
  assert.equal(taskStatus(t, [sn], '2026-10-06').snoozedUntil, '2026-10-20');
  assert.equal(taskStatus(t, [sn], '2026-10-06').state, 'upcoming'); // 14 days out
});
test('snooze state: far snooze is upcoming', () => {
  const t = T({ type: 'yearly' }, '2026-10-01');
  const sn = L('2026-10-05', makeLogNote('snooze', '', '2026-11-30'));
  assert.equal(taskStatus(t, [sn], '2026-10-06').state, 'upcoming');
  const done = L('2026-10-10');
  assert.equal(nextDue(t, [sn, done], '2026-10-11'), '2027-10-01');
});
test('skip moves on like a completion, and is not mistaken for a snooze', () => {
  const t = T({ type: 'yearly' }, '2026-10-01');
  const sk = L('2026-10-05', makeLogNote('skip', 'not needed this year'));
  assert.equal(nextDue(t, [sk], '2026-10-06'), '2027-10-01');
  assert.equal(lastDone(t, [sk]), '2026-10-05');
});
test('logs for other tasks and deleted logs are ignored', () => {
  const t = T({ type: 'yearly' }, '2026-10-01');
  assert.equal(nextDue(t, [{ task: 'other', date: '2026-10-02' }, { task: 't1', date: '2026-10-02', deleted: 1 }], '2026-10-03'), '2026-10-01');
});
test('rule as JSON string and bad rule fall back safely', () => {
  assert.equal(nextDue(T('{"type":"days","interval":30}', '2026-10-01'), [], '2026-10-01'), '2026-10-01');
  assert.equal(nextDue(T('not json', '2026-10-01'), [], '2026-10-01'), '2026-10-01');
  assert.equal(nextDue({ id: 'x', rule: { type: 'yearly' } }, [], '2026-10-01'), null); // no start
});
test('inactive tasks report inactive', () => {
  assert.equal(taskStatus(T({ type: 'yearly' }, '2026-10-01', { active: 0 }), [], '2026-10-03').state, 'inactive');
});
test('ruleText is plain language', () => {
  assert.equal(ruleText({ type: 'days', interval: 30 }), 'Every 30 days');
  assert.equal(ruleText({ type: 'after_done', interval: 1, unit: 'years' }), '1 year after I do it');
  assert.equal(ruleText({ type: 'seasonal', from: '04-01', to: '04-30' }), 'Every year, Apr 1 to Apr 30');
  assert.equal(ruleText('{"type":"monthly","interval":6}'), 'Every 6 months');
});
test('season-limited weekly rule skips out-of-season dates', () => {
  const t = T({ type: 'weekly', interval: 1, from: '10-15', to: '04-30' }, '2026-10-17');
  assert.equal(nextDue(t, [], '2026-10-17'), '2026-10-17');
  assert.equal(nextDue(t, [L('2027-04-24')], '2027-04-25'), '2027-10-16');
  assert.deepEqual(occurrences(t, '2027-04-20', '2027-05-10'), ['2027-04-24']);
});
