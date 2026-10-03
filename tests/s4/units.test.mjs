import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLength, fmtLength, sqft, daysUntil, expiryState, parseHash, splitTags, asIds } from '../../web/js/views/rooms-units.js';

test('parseLength', () => {
  assert.equal(parseLength('126'), 126);
  assert.equal(parseLength('10\' 6"'), 126);
  assert.equal(parseLength('10 ft 6 in'), 126);
  assert.equal(parseLength('10ft'), 120);
  assert.equal(parseLength("10'"), 120);
  assert.equal(parseLength('10-6'), 126);
  assert.equal(parseLength('10 ft 6 1/2 in'), 126.5);
  assert.equal(parseLength('3/4'), 0.75);
  assert.equal(parseLength('1 1/2'), 1.5);
  assert.equal(parseLength(48), 48);
  assert.ok(isNaN(parseLength('abc')));
  assert.ok(isNaN(parseLength('')));
});
test('fmtLength', () => {
  assert.equal(fmtLength(126), '10 ft 6 in');
  assert.equal(fmtLength(120), '10 ft');
  assert.equal(fmtLength(8.5), '8 1/2 in');
  assert.equal(fmtLength(0), '0 in');
  assert.equal(fmtLength(131.25), '10 ft 11 1/4 in');
  assert.equal(fmtLength(''), '');
  assert.equal(fmtLength(null), '');
});
test('sqft', () => {
  assert.equal(sqft(120, 144), 120);
  assert.equal(sqft(0, 5), null);
});
test('dates', () => {
  assert.equal(daysUntil('2026-10-10', '2026-10-03'), 7);
  assert.equal(daysUntil('2026-09-30', '2026-10-03'), -3);
  assert.equal(daysUntil('', '2026-10-03'), null);
  assert.equal(expiryState('2026-10-20', 60, '2026-10-03').state, 'soon');
  assert.equal(expiryState('2027-10-20', 60, '2026-10-03').state, 'ok');
  assert.equal(expiryState('2026-10-01', 60, '2026-10-03').state, 'expired');
  assert.equal(expiryState('', 60, '2026-10-03').state, 'none');
});
test('parseHash', () => {
  assert.deepEqual(parseHash('#/rooms/abc?x=1&y=2'), { path: ['rooms', 'abc'], query: { x: '1', y: '2' } });
  assert.deepEqual(parseHash('#/documents'), { path: ['documents'], query: {} });
  assert.deepEqual(parseHash(''), { path: [], query: {} });
});
test('misc', () => {
  assert.deepEqual(splitTags(' a, b ,,c'), ['a', 'b', 'c']);
  assert.deepEqual(asIds('["x","y"]'), ['x', 'y']);
  assert.deepEqual(asIds('nope'), []);
  assert.deepEqual(asIds(['q']), ['q']);
});
