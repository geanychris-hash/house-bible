/* Photos: stored as small JPEGs in IndexedDB (not in the JSON state), referenced by id. Falls back to memory if IndexedDB is blocked. */
const PH = { dbp: null, mem: new Map() };
function phDB() {
  return PH.dbp || (PH.dbp = new Promise((res, rej) => {
    try { const r = indexedDB.open('houseBible.photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
  }));
}
async function photoPut(blob) {
  const id = uid(); PH.mem.set(id, blob);
  try { const db = await phDB(); await new Promise((res, rej) => { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) { }
  return id;
}
async function photoGet(id) {
  if (PH.mem.has(id)) return PH.mem.get(id);
  try { const db = await phDB(); return await new Promise((res, rej) => { const r = db.transaction('p').objectStore('p').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); } catch (e) { return null; }
}
async function photoDel(id) {
  PH.mem.delete(id);
  try { const db = await phDB(); await new Promise(res => { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').delete(id); tx.oncomplete = res; tx.onerror = res; }); } catch (e) { }
}
/* downscale to max 1400px JPEG so a house of photos stays small */
async function shrink(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
}
/* open the camera (or gallery when camera=false). multi=true lets you pick many at once. Resolves to an array of Files. */
function pickPhotos({ camera = true, multi = false } = {}) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    if (camera && !multi) i.setAttribute('capture', 'environment'); if (multi) i.multiple = true;
    i.onchange = () => res([...i.files]); i.addEventListener('cancel', () => res([]));
    i.click();
  });
}
async function addPhotos(opts) {
  const out = [];
  for (const f of await pickPhotos(opts)) { try { out.push(await photoPut(await shrink(f))); } catch (e) { toast('Could not read one of those photos'); } }
  return out;
}
function photoThumb(id, big) {
  const img = h('img', { class: 'thumb', alt: 'photo', loading: 'lazy' });
  photoGet(id).then(b => { if (b) img.src = URL.createObjectURL(b); });
  if (big) { img.style.cursor = 'zoom-in'; img.addEventListener('click', () => openModal('Photo', () => { const full = h('img', { class: 'fullphoto', alt: 'photo' }); photoGet(id).then(b => { if (b) full.src = URL.createObjectURL(b); }); return full; })); }
  return img;
}
/* form widget: .value is an array of photo ids */
function photosField() {
  let ids = [];
  const box = h('div', { class: 'photos' });
  const draw = () => box.replaceChildren(...ids.map(id => h('span', { class: 'ph' }, photoThumb(id, true), h('button', { type: 'button', class: 'x', 'aria-label': 'Remove photo', onclick: () => { ids = ids.filter(x => x !== id); photoDel(id); draw(); } }, '×'))),
    h('button', { type: 'button', class: 'btn small', onclick: async () => { ids = ids.concat(await addPhotos()); draw(); } }, '+ Photo'),
    h('button', { type: 'button', class: 'btn small', onclick: async () => { ids = ids.concat(await addPhotos({ camera: false, multi: true })); draw(); } }, 'From gallery'));
  Object.defineProperty(box, 'value', { get: () => ids, set: v => { ids = (v || []).slice(); draw(); } });
  draw(); return box;
}
const thumbStrip = ids => ids && ids.length ? h('div', { class: 'photos' }, ids.map(i => h('span', { class: 'ph' }, photoThumb(i, true)))) : null;
