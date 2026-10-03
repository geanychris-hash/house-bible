import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { makeEnv, uid } from './gas-env.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const eq = (a, b) => assert.deepEqual(plain(a), plain(b)); // vm objects have a different realm's prototypes

function fresh() {
  const env = makeEnv();
  env.props.SHEET_ID = 'fake-ss';
  env.ctx.ensureTabs_(env.ss);
  return env;
}
const room = (over = {}) => ({ id: uid(), name: 'Kitchen', updatedAt: Date.now(), ...over });

test('schema.json matches embedded Schema.gs', () => {
  const json = JSON.parse(readFileSync(join(here, '..', 'schema.json'), 'utf8'));
  const { ctx } = makeEnv();
  eq(JSON.parse(JSON.stringify(ctx.HB_SCHEMA)), json);
  assert.equal(Object.keys(json.tables).length, 16);
});

test('dist bundle is up to date', () => {
  const bundle = readFileSync(join(here, '..', 'dist', 'HouseBible-all.gs'), 'utf8');
  for (const f of ['Schema.gs', 'Logic.gs', 'Store.gs', 'Api.gs']) {
    assert.ok(bundle.includes(readFileSync(join(here, '..', f), 'utf8')), `${f} differs from bundle; run node apps-script/build.mjs`);
  }
  new vm.Script(bundle); // parses as one file
});

test('auth: wrong or missing key reveals nothing', () => {
  const { ctx } = fresh();
  const post = (b) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
  eq(post({ key: 'nope', action: 'ping' }), { ok: false, error: 'auth' });
  eq(post({ action: 'ping' }), { ok: false, error: 'auth' });
  assert.equal(post({ key: 'nope', action: 'pull', since: 0 }).tables, undefined);
});

test('ping', () => {
  const r = fresh().call({ action: 'ping' });
  assert.equal(r.ok, true);
  assert.equal(r.schemaVersion, 1);
  assert.ok(Math.abs(r.serverTime - Date.now()) < 5000);
});

test('push accepts, assigns increasing rev, pull returns rows', () => {
  const { call } = fresh();
  const a = room({ name: 'A' }), b = room({ name: 'B' });
  const r = call({ action: 'push', changes: [{ table: 'rooms', row: a }, { table: 'rooms', row: b }] });
  eq(r.results.map((x) => x.status), ['accepted', 'accepted']);
  eq(r.results.map((x) => x.row.rev), [1, 2]);
  const p = call({ action: 'pull', since: 0 });
  assert.equal(p.rev, 2);
  assert.equal(p.more, false);
  eq(p.tables.rooms.map((x) => x.name), ['A', 'B']);
  assert.equal(p.tables.tasks.length, 0);
  assert.equal(p.tables.rooms[0].deleted, 0);
});

test('rev is strictly increasing across tables and pull since filters', () => {
  const { call } = fresh();
  const room1 = room(), asset = { id: uid(), name: 'Boiler', kind: 'system', updatedAt: Date.now() };
  call({ action: 'push', changes: [{ table: 'rooms', row: room1 }] });
  call({ action: 'push', changes: [{ table: 'assets', row: asset }] });
  const p = call({ action: 'pull', since: 1 });
  assert.equal(p.tables.rooms.length, 0);
  assert.equal(p.tables.assets[0].rev, 2);
  const empty = call({ action: 'pull', since: 2 });
  assert.equal(empty.rev, 2);
  assert.equal(empty.tables.assets.length, 0);
});

test('stale: older updatedAt loses and the server row comes back', () => {
  const { call } = fresh();
  const r0 = room({ name: 'Server', updatedAt: 2000 });
  call({ action: 'push', changes: [{ table: 'rooms', row: r0 }] });
  const res = call({ action: 'push', changes: [{ table: 'rooms', row: { ...r0, name: 'Old', updatedAt: 1000 } }] }).results[0];
  assert.equal(res.status, 'stale');
  assert.equal(res.row.name, 'Server');
  assert.equal(res.row.rev, 1);
  const p = call({ action: 'pull', since: 0 });
  assert.equal(p.tables.rooms[0].name, 'Server');
  assert.equal(p.rev, 1); // stale writes do not burn revs
});

test('stale: tie goes to the server; newer wins and bumps rev', () => {
  const { call } = fresh();
  const r0 = room({ name: 'Server', updatedAt: 2000 });
  call({ action: 'push', changes: [{ table: 'rooms', row: r0 }] });
  assert.equal(call({ action: 'push', changes: [{ table: 'rooms', row: { ...r0, name: 'Tie' } }] }).results[0].status, 'stale');
  const win = call({ action: 'push', changes: [{ table: 'rooms', row: { ...r0, name: 'New', updatedAt: 2001 } }] }).results[0];
  assert.equal(win.status, 'accepted');
  assert.equal(win.row.rev, 2);
  assert.equal(call({ action: 'pull', since: 1 }).tables.rooms[0].name, 'New');
});

test('partial rows merge over the stored row; client rev is ignored', () => {
  const { call } = fresh();
  const r0 = room({ name: 'Den', floor: '1', updatedAt: 1000 });
  call({ action: 'push', changes: [{ table: 'rooms', row: r0 }] });
  const res = call({ action: 'push', changes: [{ table: 'rooms', row: { id: r0.id, notes: 'hi', updatedAt: 3000, rev: 999 } }] }).results[0];
  assert.equal(res.row.name, 'Den');
  assert.equal(res.row.floor, '1');
  assert.equal(res.row.notes, 'hi');
  assert.equal(res.row.rev, 2);
});

test('soft delete keeps the row and pull returns it', () => {
  const { call } = fresh();
  const r0 = room({ updatedAt: 1000 });
  call({ action: 'push', changes: [{ table: 'rooms', row: r0 }] });
  call({ action: 'push', changes: [{ table: 'rooms', row: { id: r0.id, deleted: 1, updatedAt: 2000 } }] });
  const p = call({ action: 'pull', since: 1 });
  assert.equal(p.tables.rooms.length, 1);
  assert.equal(p.tables.rooms[0].deleted, 1);
  assert.equal(p.tables.rooms[0].name, 'Kitchen');
});

test('coercion: types, unknown fields, enums, dates, json, files', () => {
  const { call } = fresh();
  const id = uid();
  const r = call({ action: 'push', changes: [
    { table: 'rooms', row: { id, name: 'X', length_in: '120.5', bogus: 'dropped', photos: ['f1', 'f2'], updatedAt: 1 } },
    { table: 'tasks', row: { id: uid(), title: 'T', rule: { type: 'yearly' }, start: '2026-10-03T08:00:00Z', calendar: 'true', active: 1, pro_only: 'no', category: 'house', updatedAt: 1 } },
    { table: 'tasks', row: { id: uid(), title: 'bad enum', category: 'nope', updatedAt: 1 } },
    { table: 'rooms', row: { id: uid(), length_in: 'abc', updatedAt: 1 } },
    { table: 'tasks', row: { id: uid(), title: 'bad date', start: '2026-13-45', updatedAt: 1 } },
    { table: 'nothing', row: { id: uid() } },
    { table: 'rooms', row: { name: 'no id' } },
  ] }).results;
  assert.equal(r[0].status, 'accepted');
  assert.equal(r[0].row.length_in, 120.5);
  assert.equal(r[0].row.bogus, undefined);
  assert.equal(r[0].row.photos, '["f1","f2"]');
  assert.equal(r[1].status, 'accepted');
  assert.equal(r[1].row.rule, '{"type":"yearly"}');
  assert.equal(r[1].row.start, '2026-10-03');
  assert.equal(r[1].row.calendar, 1);
  assert.equal(r[1].row.pro_only, 0);
  eq(r.slice(2).map((x) => x.status), ['invalid', 'invalid', 'invalid', 'invalid', 'invalid']);
  assert.match(r[2].message, /category/);
});

test('settings rows: id equals key', () => {
  const { call } = fresh();
  const ok = call({ action: 'push', changes: [{ table: 'settings', row: { key: 'house', value: { lat: 1 }, updatedAt: 5 } }] }).results[0];
  assert.equal(ok.status, 'accepted');
  assert.equal(ok.row.id, 'house');
  assert.equal(ok.row.value, '{"lat":1}');
  const bad = call({ action: 'push', changes: [{ table: 'settings', row: { id: 'a', key: 'b', value: '1' } }] }).results[0];
  assert.equal(bad.status, 'invalid');
});

test('duplicate ids in one push resolve in order', () => {
  const { call } = fresh();
  const id = uid();
  const res = call({ action: 'push', changes: [
    { table: 'rooms', row: { id, name: 'one', updatedAt: 10 } },
    { table: 'rooms', row: { id, name: 'two', updatedAt: 20 } },
    { table: 'rooms', row: { id, name: 'old', updatedAt: 5 } },
  ] }).results;
  eq(res.map((x) => x.status), ['accepted', 'accepted', 'stale']);
  const p = call({ action: 'pull', since: 0 });
  assert.equal(p.tables.rooms.length, 1);
  assert.equal(p.tables.rooms[0].name, 'two');
  assert.equal(p.rev, 2);
});

test('push limit and bad requests', () => {
  const { call } = fresh();
  const many = Array.from({ length: 201 }, () => ({ table: 'rooms', row: room() }));
  assert.equal(call({ action: 'push', changes: many }).error, 'too_many');
  assert.equal(call({ action: 'push' }).error, 'bad_request');
  assert.equal(call({ action: 'pull', since: -1 }).error, 'bad_request');
  assert.equal(call({ action: 'wat' }).error, 'bad_request');
});

test('push updates many rows while writing more than the initial grid', () => {
  const { call, ss } = fresh();
  const rows = Array.from({ length: 150 }, (_, i) => ({ table: 'rooms', row: room({ name: 'r' + i }) }));
  call({ action: 'push', changes: rows.slice(0, 100) });
  call({ action: 'push', changes: rows.slice(100) });
  assert.ok(ss.getSheetByName('rooms').getMaxRows() >= 151);
  assert.equal(call({ action: 'pull', since: 0 }).tables.rooms.length, 150);
});

test('pull paging: more=true returns first 2000 by rev and repeats cleanly', () => {
  const { call, ctx } = fresh();
  const all = { rooms: [] };
  for (let i = 1; i <= 2105; i++) all.rooms.push({ id: 'r' + i, rev: i });
  const first = ctx.selectPull_(all, 0, 2000);
  assert.equal(first.more, true);
  assert.equal(first.tables.rooms.length, 2000);
  assert.equal(first.lastRev, 2000);
  const second = ctx.selectPull_(all, first.lastRev, 2000);
  assert.equal(second.more, false);
  assert.equal(second.tables.rooms.length, 105);
  void call;
});

test('changelog records every accepted write and the tab is hidden', () => {
  const { call, ss } = fresh();
  const r0 = room({ updatedAt: 1 });
  call({ action: 'push', changes: [{ table: 'rooms', row: r0 }] });
  call({ action: 'push', changes: [{ table: 'rooms', row: { ...r0, updatedAt: 1 } }] }); // stale: not logged
  const cl = ss.getSheetByName('changelog');
  assert.equal(cl.hidden, true);
  assert.equal(cl.getLastRow(), 2);
  eq(cl.getRange(2, 1, 1, 4).getValues()[0], [1, 'rooms', r0.id, 'test']);
});

test('push takes the script lock and releases it, even on error', () => {
  const { call, state } = fresh();
  call({ action: 'push', changes: [{ table: 'rooms', row: room() }] });
  assert.equal(state.lockHeld, false);
  assert.ok(state.locksTaken >= 1);
  state.lockHeld = true; // someone else holds it
  assert.equal(call({ action: 'push', changes: [{ table: 'rooms', row: room() }] }).error, 'busy');
  state.lockHeld = false;
});

test('ensureTab appends new schema columns without reordering', () => {
  const { ctx, ss } = fresh();
  const sheet = ss.getSheetByName('rooms');
  const before = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  eq(before.slice(0, 6), ['id', 'rev', 'updatedAt', 'updatedBy', 'deleted', 'name']);
  sheet.getRange(1, before.length + 1).setValue('manual_extra');
  ctx.ensureTab_(ss, 'rooms');
  const after = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  eq(after, [...before, 'manual_extra']);
});

test('setup defaults are written once and never overwrite', () => {
  const { ctx, call } = fresh();
  ctx.writeDefaultSettings_();
  const s1 = call({ action: 'pull', since: 0 }).tables.settings;
  eq(s1.map((r) => r.key).sort(), ['alerts', 'house', 'notify', 'schemaVersion']);
  const house = JSON.parse(s1.find((r) => r.key === 'house').value);
  assert.equal(house.lat, 42.158);
  assert.match(house.address, /353 Washington St/);
  const rules = JSON.parse(s1.find((r) => r.key === 'alerts').value).rules;
  eq(rules.filter((r) => r.enabled).map((r) => r.id), ['freeze']);
  ctx.writeDefaultSettings_();
  assert.equal(call({ action: 'pull', since: 0 }).rev, 4);
});

/* ---------- recurrence and calendar ---------- */

const task = (rule, start, over = {}) => ({ id: 't1', title: 'Do it', rule: JSON.stringify(rule), start, calendar: 1, active: 1, deleted: 0, ...over });

test('expandOccurrences: each rule type', () => {
  const { ctx } = makeEnv();
  const ex = (rule, start, from, to, last) => ctx.expandOccurrences_(task(rule, start), from, to, last || '');
  eq(ex({ type: 'once' }, '2026-11-01', '2026-10-03', '2027-10-03'), ['2026-11-01']);
  eq(ex({ type: 'once' }, '2026-09-01', '2026-10-03', '2027-10-03'), []);
  eq(ex({ type: 'yearly' }, '2024-03-15', '2026-10-03', '2027-10-03'), ['2027-03-15']);
  eq(ex({ type: 'yearly' }, '2024-02-29', '2026-10-03', '2028-10-03'), ['2027-02-28', '2028-02-29']);
  eq(ex({ type: 'monthly', interval: 3 }, '2026-01-31', '2026-10-03', '2027-02-01'), ['2026-10-31', '2027-01-31']);
  eq(ex({ type: 'monthly', interval: 1 }, '2026-01-31', '2026-02-01', '2026-03-31'), ['2026-02-28', '2026-03-31']);
  eq(ex({ type: 'weekly', interval: 2 }, '2026-10-01', '2026-10-03', '2026-11-05'), ['2026-10-15', '2026-10-29']);
  const days = ex({ type: 'days', interval: 30 }, '2026-01-01', '2026-10-03', '2027-01-31');
  eq(days, ['2026-10-28', '2026-11-27', '2026-12-27', '2027-01-26']);
  eq(ex({ type: 'seasonal', from: '10-15', to: '11-15' }, '2025-01-01', '2026-10-03', '2027-10-03'), ['2026-10-15']);
  eq(ex({ type: 'after_done', interval: 90, unit: 'days' }, '2026-10-10', '2026-10-03', '2027-10-03', '2026-09-01'), ['2026-11-30']);
  eq(ex({ type: 'after_done', interval: 1, unit: 'years' }, '2026-10-10', '2026-10-03', '2027-10-03', ''), ['2026-10-10']);
  eq(ex({ type: 'after_done', interval: 2, unit: 'months' }, '2026-10-10', '2026-10-03', '2027-10-03', '2026-12-31'), ['2027-02-28']);
  eq(ex({ type: 'bogus' }, '2026-10-10', '2026-10-03', '2027-10-03'), []);
});

test('buildDesiredEvents: filters, after_done overdue lands today, uses logs', () => {
  const { ctx } = makeEnv();
  const tasks = [
    task({ type: 'monthly', interval: 1 }, '2026-10-05', { id: 'a' }),
    task({ type: 'monthly', interval: 1 }, '2026-10-05', { id: 'b', calendar: 0 }),
    task({ type: 'monthly', interval: 1 }, '2026-10-05', { id: 'c', active: 0 }),
    task({ type: 'monthly', interval: 1 }, '2026-10-05', { id: 'd', deleted: 1 }),
    task({ type: 'after_done', interval: 30, unit: 'days' }, '2026-01-01', { id: 'e', subject: 'Rex' }),
  ];
  const logs = [{ task: 'e', date: '2026-08-01', deleted: 0 }, { task: 'e', date: '2026-09-01', deleted: 0 }];
  const out = ctx.buildDesiredEvents_(tasks, logs, '2026-10-03', '2026-12-31');
  eq([...new Set(out.map((e) => e.taskId))], ['a', 'e']);
  const e = out.filter((x) => x.taskId === 'e');
  eq(e.map((x) => x.date), ['2026-10-03']); // due 2026-10-01, overdue, shown today
  assert.equal(e[0].title, 'Do it (Rex)');
  assert.equal(out.filter((x) => x.taskId === 'a').length, 3);
});

test('planCalendarSync is idempotent: create, update, remove, dedupe', () => {
  const { ctx } = makeEnv();
  const d = (taskId, date, title = 'T', description = 'D') => ({ taskId, date, title, description });
  const ex = (ref, taskId, date, title = 'T', description = 'D') => ({ ref, taskId, date, title, description });
  const plan = ctx.planCalendarSync_(
    [d('a', '2026-11-01'), d('a', '2026-12-01', 'New'), d('b', '2026-11-05')],
    [ex('r1', 'a', '2026-11-01'), ex('r2', 'a', '2026-12-01', 'Old'), ex('r3', 'gone', '2026-11-09'), ex('r4', 'a', '2026-11-01')],
  );
  eq(plan.create.map((x) => x.taskId + x.date), ['b2026-11-05']);
  eq(plan.update.map((x) => x.ref), ['r2']);
  eq(plan.remove.sort(), ['r3', 'r4']);
  const again = ctx.planCalendarSync_([d('a', '2026-11-01')], [ex('r1', 'a', '2026-11-01')]);
  eq(again, { create: [], update: [], remove: [] });
});

test('syncCalendar end to end with a fake calendar: second run changes nothing', () => {
  const { ctx, call, calendars } = fresh();
  ctx.writeDefaultSettings_();
  const today = ctx.todayIso_();
  const t = { id: uid(), title: 'Heartworm pill', subject: 'Rex', rule: { type: 'days', interval: 30 }, start: today, calendar: 1, active: 1, updatedAt: 1 };
  call({ action: 'push', changes: [{ table: 'tasks', row: t }, { table: 'tasks', row: { id: uid(), title: 'No cal', rule: { type: 'yearly' }, start: today, calendar: 0, active: 1, updatedAt: 1 } }] });
  const r1 = call({ action: 'syncCalendar' });
  assert.equal(r1.ok, true);
  assert.ok(r1.created >= 12 && r1.created <= 13, 'about a year of 30-day events: ' + r1.created);
  assert.equal(calendars.length, 1);
  eq(call({ action: 'syncCalendar' }), { ok: true, created: 0, updated: 0, removed: 0 });
  // edit the title: update, not recreate
  call({ action: 'push', changes: [{ table: 'tasks', row: { id: t.id, title: 'Heartworm', updatedAt: 99 } }] });
  const r3 = call({ action: 'syncCalendar' });
  assert.equal(r3.created, 0);
  assert.equal(r3.updated, r1.created);
  // turn calendar off: events removed
  call({ action: 'push', changes: [{ table: 'tasks', row: { id: t.id, calendar: 0, updatedAt: 100 } }] });
  const r4 = call({ action: 'syncCalendar' });
  assert.equal(r4.removed, r1.created);
  assert.equal(calendars[0].events.length, 0);
});

/* ---------- weather ---------- */

const hours = (temps, startMs) => temps.map((t, i) => ({
  startTime: new Date(startMs + i * 3600000).toISOString(), endTime: new Date(startMs + (i + 1) * 3600000).toISOString(),
  temperature: t, temperatureUnit: 'F', windSpeed: i === 3 ? '10 to 25 mph' : '5 mph',
}));

test('evalAlertRules: temperature, wind, windows, disabled rules, grid precipitation', () => {
  const { ctx } = makeEnv();
  const now = Date.parse('2026-12-01T12:00:00Z');
  const hourly = hours([40, 35, 30, 27, 33], now);
  const rules = ctx.defaultAlertRules_();
  const fired = ctx.evalAlertRules_(rules, hourly, null, now);
  eq(fired.map((f) => f.rule.id), ['freeze']);
  assert.equal(fired[0].value, 27);
  const on = rules.map((r) => ({ ...r, enabled: true }));
  eq(ctx.evalAlertRules_(on, hourly, null, now).map((f) => f.rule.id), ['freeze']); // wind 25 < 40, no grid
  const windy = [{ id: 'w', label: 'W', metric: 'windMph', op: '>=', value: 25, hoursAhead: 24, enabled: true }];
  assert.equal(ctx.evalAlertRules_(windy, hourly, null, now).length, 1);
  // freeze later than the window does not fire
  const short = [{ ...rules[0], hoursAhead: 3 }];
  assert.equal(ctx.evalAlertRules_(short, hourly, null, now).length, 0);
  // grid: 50.8 mm over PT6H starting now = 2 in
  const grid = { quantitativePrecipitation: { values: [{ validTime: '2026-12-01T12:00:00+00:00/PT6H', value: 50.8 }] }, snowfallAmount: { values: [] } };
  const rain = ctx.evalAlertRules_(on.filter((r) => r.id === 'rain'), hourly, grid, now);
  assert.equal(rain.length, 1);
  assert.equal(rain[0].value, 2);
  const half = ctx.evalAlertRules_([{ ...on.find((r) => r.id === 'rain'), hoursAhead: 3, value: 1 }], hourly, grid, now);
  assert.equal(half[0].value, 1); // pro-rated: 3 of 6 hours
});

test('runWeatherAlerts: emails and calendar once per rule per day; testAlert sends a sample', () => {
  const now = Date.now();
  const env = makeEnv({ fetchRoutes: {
    '/points/': { properties: { forecastHourly: 'https://api.weather.gov/gridpoints/BOX/1,1/forecast/hourly', forecastGridData: 'https://api.weather.gov/gridpoints/BOX/1,1' } },
    '/forecast/hourly': { properties: { periods: hours([30, 25, 31], now - 60000) } },
  } });
  env.props.SHEET_ID = 'fake-ss';
  env.ctx.ensureTabs_(env.ss);
  env.ctx.writeDefaultSettings_();
  env.ctx.ensureCalendar_();
  const r1 = env.ctx.runWeatherAlerts_();
  eq(r1.fired.map((f) => f.id), ['freeze']);
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].to, 'owner@example.com');
  assert.match(env.mails[0].body, /Freeze coming/);
  assert.equal(env.calendars[0].events.length, 1);
  eq(env.ctx.runWeatherAlerts_().fired, []); // same day: deduped
  assert.equal(env.mails.length, 1);
  assert.equal(env.call({ action: 'testAlert' }).ok, true);
  assert.equal(env.mails.length, 2);
});

test('upload validation (no Drive in Node): bad kind and oversize are rejected', () => {
  const { call } = fresh();
  assert.equal(call({ action: 'upload', name: 'a.jpg', mime: 'image/jpeg', dataBase64: 'AAAA', parentKind: 'nope' }).error, 'bad_request');
  assert.equal(call({ action: 'upload', name: 'a.jpg', parentKind: 'rooms' }).error, 'bad_request');
  assert.equal(call({ action: 'upload', name: 'a.jpg', mime: 'x', parentKind: 'rooms', dataBase64: 'A'.repeat(28 * 1024 * 1024) }).error, 'too_large');
});

test('history returns changelog newest first, filters by table and id, honours limit', () => {
  const { call } = fresh();
  const a = room({ updatedAt: 1 }), b = room({ updatedAt: 1 });
  call({ action: 'push', changes: [{ table: 'rooms', row: a }, { table: 'rooms', row: b }] });
  call({ action: 'push', changes: [{ table: 'rooms', row: { ...a, name: 'X', updatedAt: 5 } }] });
  const all = call({ action: 'history' });
  assert.equal(all.ok, true);
  eq(all.entries.map((e) => e.rev), [3, 2, 1]);
  eq(all.entries[0], { rev: 3, table: 'rooms', id: a.id, updatedBy: 'test', at: all.entries[0].at });
  assert.equal(call({ action: 'history', limit: 1 }).entries.length, 1);
  eq(call({ action: 'history', id: a.id }).entries.map((e) => e.rev), [3, 1]);
  assert.equal(call({ action: 'history', table: 'tasks' }).entries.length, 0);
  assert.equal(call({ action: 'history', table: 'nope' }).error, 'bad_request');
});

test('v3 columns exist', () => {
  const json = JSON.parse(readFileSync(join(here, '..', 'schema.json'), 'utf8'));
  const names = (t) => json.tables[t].fields.map((f) => f.name);
  assert.ok(names('task_log').includes('contact') && names('expenses').includes('contact'));
  for (const c of ['expected_life_years', 'replace_cost', 'purchase_price', 'purchase_date', 'replacement_value']) assert.ok(names('assets').includes(c), c);
  assert.ok(names('tools').includes('lent_to') && names('tools').includes('location') && names('utilities').includes('hdd'));
  assert.ok(json.tables.assets.fields.find((f) => f.name === 'kind').enum.includes('belonging'));
});
