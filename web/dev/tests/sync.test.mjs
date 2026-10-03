// Run: node --test web/dev/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/core/data.js';
import { createMemoryAdapter } from '../../js/core/store.js';
import { createApi, ApiError } from '../../js/core/api.js';
import { normalizeRow } from '../../js/core/schema.js';
import { createMockServer } from '../mock-server.mjs';

const noTimers = { setTimer: () => 0, clearTimer: () => {} };

// Engine wired to an in-process fake server (the mock's handle()).
function makeEngine({ mock, device = 'Chris-phone', clock, online } = {}) {
  let t = 1000;
  const now = clock || (() => (t += 10));
  const state = { calls: [], down: false };
  const api = async (action, extra) => {
    state.calls.push(action);
    if (state.down) throw new ApiError('network', 'down');
    const r = mock.handle({ key: 'k', action, device, ...JSON.parse(JSON.stringify(extra || {})) });
    if (r.ok === false) throw new ApiError(r.error, r.message);
    return r;
  };
  const engine = createEngine({ adapter: createMemoryAdapter(), api, device: () => device, now, online: online || (() => true), ...noTimers });
  return { engine, state, api };
}
const mockSrv = () => createMockServer({ dataFile: null, key: 'k', serveStatic: false });

test('save creates an id, sets system fields and queues an outbox entry', async () => {
  const { engine } = makeEngine({ mock: mockSrv() });
  const row = await engine.save('rooms', { name: 'Kitchen' });
  assert.match(row.id, /^[0-9a-f]{32}$/);
  assert.equal(row.deleted, 0);
  assert.equal(row.updatedBy, 'Chris-phone');
  assert.ok(row.updatedAt > 0);
  assert.equal(engine.status().pending, 1);
  assert.deepEqual((await engine.list('rooms')).map(r => r.name), ['Kitchen']);
});

test('save merges onto the existing row and coalesces the outbox', async () => {
  const { engine } = makeEngine({ mock: mockSrv() });
  const a = await engine.save('rooms', { name: 'Kitchen', floor: '1' });
  const b = await engine.save('rooms', { id: a.id, name: 'Big kitchen' });
  assert.equal(b.floor, '1');
  assert.ok(b.updatedAt > a.updatedAt);
  assert.equal(engine.status().pending, 1);
});

test('remove is a soft delete that list hides unless asked', async () => {
  const { engine } = makeEngine({ mock: mockSrv() });
  const a = await engine.save('tools', { name: 'Saw' });
  await engine.remove('tools', a.id);
  assert.equal((await engine.list('tools')).length, 0);
  const all = await engine.list('tools', { includeDeleted: true });
  assert.equal(all.length, 1);
  assert.equal(all[0].deleted, 1);
  assert.equal((await engine.get('tools', a.id)).deleted, 1);
});

test('subscribe fires on local change and stops after unsubscribe', async () => {
  const { engine } = makeEngine({ mock: mockSrv() });
  const seen = [];
  const off = engine.subscribe('tools', rows => seen.push(rows.length));
  await engine.save('tools', { name: 'Saw' });
  off();
  await engine.save('tools', { name: 'Drill' });
  assert.deepEqual(seen, [1]);
});

test('syncNow pushes, clears the outbox and stores the server rev', async () => {
  const mock = mockSrv();
  const { engine } = makeEngine({ mock });
  const a = await engine.save('rooms', { name: 'Kitchen' });
  const res = await engine.syncNow();
  assert.equal(res.pushed, 1);
  assert.deepEqual(res.errors, []);
  assert.equal(engine.status().pending, 0);
  assert.ok((await engine.get('rooms', a.id)).rev > 0);
  assert.ok(engine.status().lastSync);
});

test('two devices converge; newer updatedAt wins; stale push is overwritten locally', async () => {
  const mock = mockSrv();
  let clockA = 1000, clockB = 1000;
  const A = makeEngine({ mock, device: 'A', clock: () => (clockA += 1) });
  const B = makeEngine({ mock, device: 'B', clock: () => (clockB += 1) });
  const row = await A.engine.save('rooms', { name: 'Den' });
  await A.engine.syncNow();
  await B.engine.syncNow();
  assert.equal((await B.engine.get('rooms', row.id)).name, 'Den');

  clockB = 5000; clockA = 3000;
  await B.engine.save('rooms', { id: row.id, name: 'Den (B)' });   // newer edit
  await A.engine.save('rooms', { id: row.id, name: 'Den (A)' });   // older edit, pushed after B
  await B.engine.syncNow();
  const res = await A.engine.syncNow();                             // stale on push, then pull
  assert.equal(res.pushed, 1);
  assert.equal((await A.engine.get('rooms', row.id)).name, 'Den (B)');
  assert.equal(A.engine.status().pending, 0);
});

test('a pending local edit that is newer than the server row survives a pull', async () => {
  const mock = mockSrv();
  const A = makeEngine({ mock, device: 'A', clock: (() => { let t = 100; return () => (t += 1); })() });
  const B = makeEngine({ mock, device: 'B', clock: (() => { let t = 100; return () => (t += 1); })() });
  const row = await A.engine.save('rooms', { name: 'v1' });
  await A.engine.syncNow(); await B.engine.syncNow();
  await A.engine.save('rooms', { id: row.id, name: 'from A' });
  await A.engine.syncNow();
  // B edits later (larger updatedAt) but is offline when it pulls A's change
  const bEdit = await B.engine.save('rooms', { id: row.id, name: 'from B', updatedAtBump: 1 });
  B.engine._internals.outbox.get('rooms/' + row.id).row.updatedAt = 9999;
  B.engine._internals.rows.get('rooms').get(row.id).updatedAt = 9999;
  void bEdit;
  const res = await B.engine.syncNow();
  assert.deepEqual(res.errors, []);
  assert.equal((await B.engine.get('rooms', row.id)).name, 'from B');
  assert.equal(mock.db().tables.rooms[row.id].name, 'from B');
});

test('pull drops a pending edit when the server row is newer', async () => {
  const mock = mockSrv();
  const { engine, state } = makeEngine({ mock, clock: (() => { let t = 100; return () => (t += 1); })() });
  const row = await engine.save('rooms', { name: 'local' });
  // server already has a newer version of the same row
  mock.db().tables.rooms[row.id] = { ...row, name: 'server', updatedAt: 99999, rev: ++mock.db().rev };
  state.down = false;
  await engine.syncNow();
  assert.equal((await engine.get('rooms', row.id)).name, 'server');
  assert.equal(engine.status().pending, 0);
});

test('edit made while a push is in flight stays queued', async () => {
  const mock = mockSrv();
  let engine;
  let inject = true;
  const api = async (action, extra) => {
    const out = mock.handle({ key: 'k', action, ...JSON.parse(JSON.stringify(extra || {})) });
    if (action === 'push' && inject) { inject = false; await engine.save('rooms', { id: extra.changes[0].row.id, name: 'second' }); }
    return out;
  };
  let t = 100;
  engine = createEngine({ adapter: createMemoryAdapter(), api, now: () => (t += 1), ...noTimers });
  const a = await engine.save('rooms', { name: 'first' });
  const res = await engine.syncNow();               // the in-flight edit is not lost: it is pushed in the same run
  assert.equal(res.pushed, 2);
  assert.equal((await engine.get('rooms', a.id)).name, 'second');
  assert.equal(engine.status().pending, 0);
  assert.equal(mock.db().tables.rooms[a.id].name, 'second');
});

test('offline: writes queue, sync fails with backoff, then succeeds', async () => {
  const mock = mockSrv();
  const { engine, state } = makeEngine({ mock });
  state.down = true;
  await engine.save('tools', { name: 'Saw' });
  const res = await engine.syncNow();
  assert.equal(res.pushed, 0);
  assert.equal(res.errors.length, 1);
  assert.equal(engine.status().pending, 1);
  assert.equal(engine.status().failures, 1);
  assert.equal(engine.status().error.code, 'network');
  await engine.syncNow();
  assert.equal(engine.status().failures, 2);
  state.down = false;
  const ok = await engine.syncNow();
  assert.equal(ok.pushed, 1);
  assert.equal(engine.status().pending, 0);
  assert.equal(engine.status().failures, 0);
  assert.equal(engine.status().error, null);
});

test('auth failure is reported and stops automatic retries', async () => {
  const calls = [];
  const api = async action => { calls.push(action); throw new ApiError('auth', 'Wrong key'); };
  const timers = [];
  const engine = createEngine({ adapter: createMemoryAdapter(), api, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {} });
  await engine.save('tools', { name: 'Saw' });
  await engine.syncNow();
  assert.equal(engine.status().authFailed, true);
  assert.equal(engine.status().error.code, 'auth');
  const before = calls.length;
  engine.requestSync(0);
  await timers[timers.length - 1].fn();
  assert.equal(calls.length, before, 'auto sync must not retry after an auth failure');
});

test('pull pages through more:true and normalizes text json/bool/num', async () => {
  const pages = [
    { ok: true, rev: 5, more: true, tables: { rooms: [{ id: 'a', rev: 1, updatedAt: 1, deleted: 0, name: 'A', length_in: '120', photos: '["f1"]' }] } },
    { ok: true, rev: 5, more: false, tables: { tasks: [{ id: 'b', rev: 5, updatedAt: 2, deleted: 'TRUE', title: 'T', rule: '{"type":"yearly"}', active: true }] } },
  ];
  const sinces = [];
  const api = async (action, extra) => { sinces.push(extra.since); return pages.shift(); };
  const engine = createEngine({ adapter: createMemoryAdapter(), api, ...noTimers });
  const res = await engine.syncNow();
  assert.equal(res.pulled, 2);
  assert.deepEqual(sinces, [0, 1]);
  const room = await engine.get('rooms', 'a');
  assert.equal(room.length_in, 120);
  assert.deepEqual(room.photos, ['f1']);
  const task = await engine.get('tasks', 'b');
  assert.deepEqual(task.rule, { type: 'yearly' });
  assert.equal(task.deleted, 1);
  assert.equal(task.active, 1);
  assert.equal(engine._internals.meta.rev, 5);
});

test('pull fires subscribers (remote change)', async () => {
  const mock = mockSrv();
  const A = makeEngine({ mock, device: 'A' });
  const B = makeEngine({ mock, device: 'B' });
  await A.engine.save('contacts', { name: 'Plumber Pete' });
  await A.engine.syncNow();
  const seen = [];
  B.engine.subscribe('contacts', rows => seen.push(rows.map(r => r.name)));
  await B.engine.syncNow();
  assert.deepEqual(seen, [['Plumber Pete']]);
});

test('state survives a restart (same adapter, new engine)', async () => {
  const mock = mockSrv();
  const adapter = createMemoryAdapter();
  const api = async () => { throw new ApiError('network', 'down'); };
  const e1 = createEngine({ adapter, api, ...noTimers });
  await e1.save('tools', { name: 'Saw' });
  const e2 = createEngine({ adapter, api, ...noTimers });
  assert.equal((await e2.list('tools')).length, 1);
  assert.equal((await e2.init(), e2.status().pending), 1);
  void mock;
});

test('api never puts the key in the URL and maps errors', async () => {
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return { json: async () => ({ ok: false, error: 'auth', message: 'Wrong key' }) }; };
  const api = createApi({ getConfig: () => ({ url: 'https://example.test/exec', key: 'SECRET', device: 'd' }), fetchImpl });
  await assert.rejects(() => api('ping'), e => e.code === 'auth');
  assert.equal(seen.url, 'https://example.test/exec');
  assert.ok(!seen.url.includes('SECRET'));
  assert.equal(seen.opts.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(JSON.parse(seen.opts.body).key, 'SECRET');
  const down = createApi({ getConfig: () => ({ url: 'https://x', key: 'k' }), fetchImpl: async () => { throw new TypeError('fail'); } });
  await assert.rejects(() => down('ping'), e => e.code === 'network');
  const none = createApi({ getConfig: () => null });
  await assert.rejects(() => none('ping'), e => e.code === 'not_configured');
});

test('normalizeRow coerces types', () => {
  const r = normalizeRow('projects', { id: 'x', rev: '3', updatedAt: '9', deleted: '1', budget: '12.5', pro: 'TRUE', steps: '[{"t":"a","d":0}]', deps: '' });
  assert.equal(r.rev, 3); assert.equal(r.deleted, 1); assert.equal(r.budget, 12.5); assert.equal(r.pro, 1);
  assert.deepEqual(r.steps, [{ t: 'a', d: 0 }]); assert.equal(r.deps, null);
});

test('end to end over HTTP against the mock server', async () => {
  const { server } = createMockServer({ dataFile: null, key: 'k', serveStatic: false });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/exec`;
  const mk = device => {
    const api = createApi({ getConfig: () => ({ url, key: 'k', device }) });
    return createEngine({ adapter: createMemoryAdapter(), api, device: () => device, ...noTimers });
  };
  const A = mk('A'), B = mk('B');
  const r = await A.save('rooms', { name: 'Hall' });
  assert.equal((await A.syncNow()).errors.length, 0);
  await B.syncNow();
  assert.equal((await B.get('rooms', r.id)).name, 'Hall');
  await B.remove('rooms', r.id);
  await B.syncNow(); await A.syncNow();
  assert.equal((await A.list('rooms')).length, 0);
  const bad = createEngine({ adapter: createMemoryAdapter(), api: createApi({ getConfig: () => ({ url, key: 'nope', device: 'x' }) }), ...noTimers });
  assert.equal((await bad.syncNow()).errors[0], 'Wrong key');
  server.close();
});
