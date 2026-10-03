import { qrMatrix } from '../../web/js/views/qr-encoder.js';
const strs = ['a', 'https://example.github.io/house-bible/#/asset/0123456789abcdef0123456789abcdef', 'x'.repeat(14), 'Hello, World! é☃', 'ab'.repeat(40), 'q7'.repeat(75), 'Z9'.repeat(100), 'M'.repeat(213), 'w'.repeat(106)];
const out = strs.map(s => { const m = qrMatrix(s); return { s, v: m.version, size: m.size, rows: m.modules.map(r => r.map(b => b ? 1 : 0).join('')) }; });
process.stdout.write(JSON.stringify(out));
