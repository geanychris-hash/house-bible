// Dev harness only. Serves web/ and falls back to stubs/ for core files S2 has not built yet.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), web = path.resolve(here, '../../../web');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const cands = [path.join(web, u), path.join(here, u), path.join(here, 'stubs', path.basename(u))];
  const f = cands.find(c => c.startsWith(path.resolve(here, '../../..')) && fs.existsSync(c) && fs.statSync(c).isFile());
  if (!f) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
}).listen(8123, () => console.log('http://localhost:8123/index.html'));
