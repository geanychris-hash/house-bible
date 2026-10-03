import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { planSeed, loadSeed, run } from './load-seed.mjs';
import { parseRule, taskStatus } from '../web/js/core/recur.js';

const seed = loadSeed();

test('seed file is well formed', () => {
  const keys = new Set();
  for (const t of seed) {
    assert.ok(t.seed_key && !keys.has(t.seed_key), 'unique seed_key ' + t.seed_key); keys.add(t.seed_key);
    assert.equal(t.source, 'seed');
    assert.ok(['house', 'steam', 'yard', 'safety'].includes(t.category), t.seed_key);
    assert.match(t.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(parseRule(t.rule).type, t.seed_key);
    assert.notEqual(taskStatus({ ...t, id: 'x' }, [], '2026-10-03').state, 'inactive');
    assert.ok(!/\b(pet|heartworm|dog)\b/i.test(t.title), 'no seeded pet reminders');
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(t)), 'no emoji');
  }
  // anything touching gas, flue, main electrical, asbestos or lead must be pro_only or carry licensed-pro language
  for (const t of seed.filter(t => /asbestos|flue|chimney|gas leak|electrical panel/i.test(t.title))) {
    assert.equal(t.pro_only, 1, t.seed_key);
    assert.match(t.safety, /licensed/i, t.seed_key);
  }
});

test('planSeed skips existing seed_keys (including deleted rows) and never touches user rows', () => {
  const existing = [{ seed_key: seed[0].seed_key, deleted: 1 }, { seed_key: seed[1].seed_key }, { title: 'Heartworm', seed_key: '' }];
  const fresh = planSeed(existing, seed);
  assert.equal(fresh.length, seed.length - 2);
  assert.ok(fresh.every(r => /^[0-9a-f]{32}$/.test(r.id) && typeof r.rule === 'string' && r.deleted === 0));
  assert.equal(planSeed([...existing, ...fresh], seed).length, 0);
});

test('run(): loads once through the API, second run adds nothing', async () => {
  const store = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const m = JSON.parse(b); let out;
      if (m.key !== 'k') out = { ok: false, error: 'auth' };
      else if (m.action === 'ping') out = { ok: true };
      else if (m.action === 'pull') out = { ok: true, rev: 1, tables: { tasks: store }, more: false };
      else if (m.action === 'push') { out = { ok: true, results: m.changes.map(c => { store.push(c.row); return { status: 'accepted' }; }) }; }
      res.end(JSON.stringify(out));
    });
  });
  await new Promise(r => srv.listen(0, r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const quiet = () => {};
  try {
    const a = await run({ url, key: 'k', log: quiet });
    assert.equal(a.added, seed.length);
    assert.equal(store.length, seed.length);
    const b = await run({ url, key: 'k', log: quiet });
    assert.equal(b.added, 0);
    assert.equal(store.length, seed.length);
    await assert.rejects(run({ url, key: 'bad', log: quiet }), /auth/);
  } finally { srv.close(); }
});
