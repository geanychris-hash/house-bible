// Runs tools/hb-cli.mjs against a local server that mimics Apps Script:
// POST /exec answers 302 to /echo/<id>, and GET /echo/<id> serves the JSON with CORS *.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEnv } from './gas-env.mjs';
import { main } from '../../tools/hb-cli.mjs';

async function withServer(fn) {
  const env = makeEnv();
  env.props.SHEET_ID = 'fake-ss';
  env.ctx.ensureTabs_(env.ss);
  const stash = new Map();
  let n = 0, lastPost = null;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/exec') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        lastPost = { contentType: req.headers['content-type'], body };
        const out = env.ctx.doPost({ postData: { contents: body } }).getContent();
        const id = ++n;
        stash.set(id, out);
        res.writeHead(302, { Location: `/echo/${id}` });
        res.end();
      });
    } else if (req.method === 'GET' && req.url.startsWith('/echo/')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(stash.get(Number(req.url.split('/')[2])));
    } else { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/exec`;
  try { await fn({ url, env, lastPost: () => lastPost }); } finally { server.close(); }
}

const run = async (argv, env) => {
  const lines = [];
  const code = await main(argv, env, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
};

test('cli: ping, push, pull through a 302 redirect, text/plain body', async () => {
  await withServer(async ({ url, env, lastPost }) => {
    const base = ['--url', url, '--key', env.KEY];
    const ping = await run(['ping', ...base], {});
    assert.equal(ping.code, 0);
    assert.equal(JSON.parse(ping.out).ok, true);
    assert.match(lastPost().contentType, /^text\/plain/);

    const push = await run(['push', '--table', 'rooms', '--json', '{"name":"CLI room"}', ...base], {});
    assert.equal(push.code, 0);
    assert.equal(JSON.parse(push.out).results[0].status, 'accepted');

    const pull = await run(['pull', '--table', 'rooms', ...base], {});
    const j = JSON.parse(pull.out);
    assert.equal(j.tables.rooms[0].name, 'CLI room');
    assert.equal(j.rev, 1);
  });
});

test('cli: wrong key exits 1, missing args exit 2, env vars work', async () => {
  await withServer(async ({ url, env }) => {
    const bad = await run(['ping', '--url', url, '--key', 'wrong'], {});
    assert.equal(bad.code, 1);
    assert.equal(JSON.parse(bad.out).error, 'auth');
    assert.equal((await run(['ping'], {})).code, 2);
    assert.equal((await run(['ping'], { HB_URL: url, HB_KEY: env.KEY })).code, 0);
  });
});

test('cli: push --file fills ids and upload reports a server error cleanly', async () => {
  await withServer(async ({ url, env }) => {
    const dir = mkdtempSync(join(tmpdir(), 'hbcli-'));
    const f = join(dir, 'changes.json');
    writeFileSync(f, JSON.stringify([{ table: 'rooms', row: { name: 'A' } }, { table: 'rooms', row: { name: 'B' } }]));
    const r = await run(['push', '--file', f, '--url', url, '--key', env.KEY], {});
    assert.deepEqual(JSON.parse(r.out).results.map((x) => x.row.rev), [1, 2]);
    const bad = join(dir, 'a.txt');
    writeFileSync(bad, 'hi');
    const up = await run(['upload', '--file', bad, '--kind', 'nope', '--url', url, '--key', env.KEY], {});
    assert.equal(up.code, 1);
    assert.equal(JSON.parse(up.out).error, 'bad_request');
  });
});
