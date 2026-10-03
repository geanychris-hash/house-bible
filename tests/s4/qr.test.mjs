import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from '../../web/js/views/qr-encoder.js';

// Real decoding was verified separately with OpenCV (see tests/s4/README.md). These checks guard the structure.
test('size follows version and finder patterns are present', () => {
  const m = qrMatrix('hello');
  assert.equal(m.version, 1);
  assert.equal(m.size, 21);
  for (const [ox, oy] of [[0, 0], [14, 0], [0, 14]]) {
    assert.equal(m.modules[oy][ox], true);
    assert.equal(m.modules[oy + 3][ox + 3], true);
    assert.equal(m.modules[oy + 1][ox + 1], false);
  }
  assert.equal(m.modules[13][8], true); // dark module
});
test('deterministic and version grows with length', () => {
  assert.deepEqual(qrMatrix('abc').modules, qrMatrix('abc').modules);
  assert.equal(qrMatrix('x'.repeat(100)).version, 6);
  assert.equal(qrMatrix('x'.repeat(213)).version, 10);
});
test('too long text throws', () => { assert.throws(() => qrMatrix('x'.repeat(214))); });
test('svg output', () => {
  const s = qrSvg('https://example.com/#/asset/abc');
  assert.match(s, /^<svg /);
  assert.match(s, /viewBox="0 0 \d+ \d+"/);
});
