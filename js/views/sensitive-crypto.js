// Client-side encryption for the `sensitive` table (CONTRACT section 7). Pure WebCrypto: no DOM, no network.
// PBKDF2-SHA-256 (250000 iterations) from a household passphrase + per-install salt -> AES-GCM 256, random 12-byte IV per item.
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const ITERATIONS = 250000;
export const CHECK_TEXT = 'house-bible-ok';

export function toB64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export const newSalt = () => toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));

// extractable=false keeps the key unreadable by page scripts and still storable in IndexedDB for "remember on this device".
export async function deriveKey(passphrase, saltB64, { extractable = false, iterations = ITERATIONS } = {}) {
  if (!passphrase) throw new Error('Passphrase is empty');
  const base = await subtle().importKey('raw', enc.encode(String(passphrase).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

export async function encryptText(key, text) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(text)));
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}

// Throws if the key is wrong or the data was changed (AES-GCM authenticates).
export async function decryptText(key, ciphertextB64, ivB64) {
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ciphertextB64));
  return dec.decode(pt);
}

// A small known value stored next to the salt so a wrong passphrase is caught before any item is read or written.
export const makeCheck = key => encryptText(key, CHECK_TEXT);
export async function verifyCheck(key, check) {
  if (!check || !check.ciphertext || !check.iv) return false;
  try { return (await decryptText(key, check.ciphertext, check.iv)) === CHECK_TEXT; } catch { return false; }
}
