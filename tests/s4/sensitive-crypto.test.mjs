import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveKey, encryptText, decryptText, makeCheck, verifyCheck, newSalt, toB64, fromB64, ITERATIONS } from '../../web/js/views/sensitive-crypto.js';

const FAST = { iterations: 1000 }; // the real iteration count is checked once below

test('base64 round trip', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255, 128]);
  assert.deepEqual([...fromB64(toB64(bytes))], [...bytes]);
  const big = new Uint8Array(70000).map((_, i) => i % 256);
  assert.deepEqual(fromB64(toB64(big)).length, 70000);
});

test('salt is random 16 bytes', () => {
  const a = newSalt(), b = newSalt();
  assert.notEqual(a, b);
  assert.equal(fromB64(a).length, 16);
});

test('encrypt then decrypt returns the text, including unicode and long text', async () => {
  const salt = newSalt();
  const key = await deriveKey('correct horse battery staple', salt, FAST);
  for (const text of ['alarm code 4821', 'Zoé ☃ \u{1F512} café', 'x'.repeat(20000), '']) {
    const { ciphertext, iv } = await encryptText(key, text);
    assert.equal(await decryptText(key, ciphertext, iv), text);
  }
});

test('each encryption uses a new IV and ciphertext differs', async () => {
  const key = await deriveKey('pw', newSalt(), FAST);
  const a = await encryptText(key, 'same'), b = await encryptText(key, 'same');
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.equal(fromB64(a.iv).length, 12);
});

test('wrong passphrase or wrong salt cannot decrypt', async () => {
  const salt = newSalt();
  const key = await deriveKey('right', salt, FAST);
  const { ciphertext, iv } = await encryptText(key, 'secret');
  await assert.rejects(decryptText(await deriveKey('wrong', salt, FAST), ciphertext, iv));
  await assert.rejects(decryptText(await deriveKey('right', newSalt(), FAST), ciphertext, iv));
});

test('tampered ciphertext is rejected', async () => {
  const key = await deriveKey('pw', newSalt(), FAST);
  const { ciphertext, iv } = await encryptText(key, 'secret');
  const bytes = fromB64(ciphertext); bytes[0] ^= 1;
  await assert.rejects(decryptText(key, toB64(bytes), iv));
});

test('passphrase check', async () => {
  const salt = newSalt();
  const key = await deriveKey('right', salt, FAST);
  const check = await makeCheck(key);
  assert.equal(await verifyCheck(key, check), true);
  assert.equal(await verifyCheck(await deriveKey('wrong', salt, FAST), check), false);
  assert.equal(await verifyCheck(key, null), false);
  assert.equal(await verifyCheck(key, { ciphertext: 'x', iv: 'y' }), false);
});

test('empty passphrase is refused and the default is 250000 iterations', async () => {
  assert.equal(ITERATIONS, 250000);
  await assert.rejects(deriveKey('', newSalt()));
  const key = await deriveKey('pw', newSalt()); // real iteration count works
  assert.equal(key.extractable, false);
  assert.equal(key.algorithm.name, 'AES-GCM');
});

test('key is not extractable', async () => {
  const key = await deriveKey('pw', newSalt(), FAST);
  await assert.rejects(globalThis.crypto.subtle.exportKey('raw', key));
});
