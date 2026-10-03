/* Capture helpers: barcode scan (BarcodeDetector, live camera), data-plate text reading (optional on-device OCR, or paste text), plate parsing. */
const BRANDS = ['Whirlpool', 'GE', 'General Electric', 'Samsung', 'LG', 'Bosch', 'Maytag', 'Kenmore', 'Frigidaire', 'Electrolux', 'KitchenAid', 'Amana', 'Rheem', 'A. O. Smith', 'AO Smith', 'Bradford White', 'State', 'Weil-McLain', 'Burnham', 'Peerless', 'Slant/Fin', 'Smith', 'Lochinvar', 'Navien', 'Viessmann', 'Buderus', 'Utica', 'Columbia', 'Square D', 'Siemens', 'Eaton', 'Cutler-Hammer', 'Carrier', 'Trane', 'Lennox', 'Goodman', 'Moen', 'Delta', 'Kohler', 'Zoeller', 'Wayne', 'Honeywell', 'Taco', 'Sherwin-Williams', 'Benjamin Moore', 'Behr', 'Valspar', 'Dewalt', 'Milwaukee', 'Makita', 'Ryobi'];
function parsePlate(text) {
  const t = String(text || '').replace(/[|]/g, 'I');
  const grab = re => { const m = t.match(re); return m ? m[1].replace(/[.,;:]+$/, '') : ''; };
  const model = grab(/(?:MODEL|MOD\.?|MDL)\s*(?:NO\.?|NUMBER|NUM\.?|#)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-\/.]{3,})/i);
  const serial = grab(/(?:SERIAL|SER\.?|S\/N|SN)\s*(?:NO\.?|NUMBER|NUM\.?|#)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-]{4,})/i);
  const mfg = grab(/(?:MFG\.?|MANUFACTURED|DATE OF MFG|MADE|DATE)[^0-9\n]{0,12}(\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}|(?:19|20)\d{2})/i);
  const low = t.toLowerCase();
  const brand = (BRANDS.filter(b => new RegExp('(^|[^a-z])' + b.toLowerCase().replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '([^a-z]|$)').test(low)).sort((a, b) => b.length - a.length)[0]) || '';
  const lines = [...new Set(t.split(/\n|\s{3,}/).map(x => x.trim()).filter(x => x.length > 2))].slice(0, 40);
  return { brand, model, serial, mfg, lines };
}

/* Live barcode scan. Resolves to the code, or null if closed. Always offers typing it in. */
function scanBarcode() {
  return new Promise(resolve => {
    const can = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    let stream = null, finished = false;
    const finish = v => { if (finished) return; finished = true; if (stream) stream.getTracks().forEach(t => t.stop()); resolve(v); };
    const manual = h('input', { placeholder: 'Or type the digits' });
    const status = h('p', { class: 'muted' }, can ? 'Starting camera...' : 'Live scanning is not available in this browser. Type the digits instead (Chrome on Android supports scanning).');
    const video = h('video', { playsinline: '', muted: '', class: 'scanvideo', style: can ? '' : 'display:none' });
    const close = openModal('Scan barcode', closeFn => h('div', { class: 'list' }, video, status,
      h('div', { class: 'row nowrap' }, manual, btn('Use', () => { if (manual.value.trim()) { finish(manual.value.trim()); closeFn(); } }, 'small primary'))));
    if (!can) { const iv = setInterval(() => { if (!video.isConnected) { clearInterval(iv); finish(null); } }, 300); return; }
    (async () => {
      try {
        const det = new BarcodeDetector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream; video.muted = true; await video.play(); status.textContent = 'Point at the barcode.';
        while (!finished && video.isConnected) {
          try { const r = await det.detect(video); if (r.length) { if (navigator.vibrate) navigator.vibrate(60); finish(r[0].rawValue); close(); return; } } catch (e) { }
          await new Promise(r => setTimeout(r, 250));
        }
        finish(null);
      } catch (e) { status.textContent = 'Camera unavailable (' + (e.name || 'error') + '). Type the digits instead.'; const iv = setInterval(() => { if (!video.isConnected) { clearInterval(iv); finish(null); } }, 300); }
    })();
  });
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('offline')); document.head.append(s); });
  return window.Tesseract;
}
async function ocrBlob(blob, onProgress) {
  const T = await loadTesseract();
  const r = await T.recognize(blob, 'eng', { logger: m => { if (onProgress && m.progress != null) onProgress(m.status, m.progress); } });
  return r.data.text;
}

/* Data-plate capture: photo (camera or an existing photo id), read the text (OCR, or paste), tap-to-assign, then hand back values. */
function capturePlate({ title = 'Data plate', photoId = null, onDone }) {
  const ids = photoId ? [photoId] : [];
  const out = {};
  const mk = (k, label, ph) => { const i = h('input', { id: 'pl_' + k, placeholder: ph || '' }); out[k] = i; return h('div', { class: 'field' }, h('label', { for: 'pl_' + k }, label), i); };
  let lastFocus = null; const thumbs = h('div', { class: 'photos' }), chips = h('div', { class: 'row wrapchips' });
  const ta = h('textarea', { rows: 4, placeholder: 'Text from the plate. Use Read photo, or paste (Samsung Gallery: open the photo, tap the text icon, copy).' });
  const status = h('p', { class: 'muted' }, '');
  const drawThumbs = () => thumbs.replaceChildren(...ids.map(i => photoThumb(i, true)));
  const applyParse = () => {
    const p = parsePlate(ta.value);
    ['brand', 'model', 'serial', 'mfg'].forEach(k => { if (p[k] && !out[k].value) out[k].value = p[k]; });
    chips.replaceChildren(...p.lines.map(l => h('button', { type: 'button', class: 'chipbtn', onclick: () => { const t = lastFocus || out.model; t.value = (t.value ? t.value + ' ' : '') + l.replace(/^[A-Za-z .#\/]+[:#]\s*/, ''); } }, l.length > 34 ? l.slice(0, 33) + '…' : l)));
  };
  openModal(title, close => {
    const form = h('div', { class: 'form' }, mk('brand', 'Brand', 'Rheem'), mk('model', 'Model'), mk('serial', 'Serial'), mk('mfg', 'Made / installed', '2008 or 05/2008'));
    Object.values(out).forEach(i => i.addEventListener('focus', () => { lastFocus = i; }));
    return h('div', { class: 'list' },
      h('div', { class: 'row' }, btn('Take photo', async () => { ids.push(...await addPhotos()); drawThumbs(); }, 'small primary'), btn('From gallery', async () => { ids.push(...await addPhotos({ camera: false })); drawThumbs(); }, 'small'),
        btn('Read photo', async () => {
          if (!ids.length) { toast('Add a photo first'); return; }
          status.textContent = 'Loading the text reader (a few MB the first time, needs internet)...';
          try { ta.value = await ocrBlob(await photoGet(ids[ids.length - 1]), (s, p) => { status.textContent = `${s} ${Math.round(p * 100)}%`; }); status.textContent = 'Check the text below, fix what is off.'; applyParse(); }
          catch (e) { status.textContent = 'Could not load the text reader (offline or blocked here). Paste text from your Gallery, or type the fields.'; }
        }, 'small')),
      thumbs, ta, h('div', { class: 'row' }, btn('Pull out brand/model/serial', applyParse, 'small')), status,
      h('p', { class: 'muted', style: 'font-size:12px' }, 'Tap a line below to drop it into the field you last touched.'), chips, form,
      h('div', { class: 'row spread' }, btn('Cancel', () => { close(); }), btn('Use these', () => { const v = {}; Object.keys(out).forEach(k => v[k] = out[k].value.trim()); close(); onDone(v, ids); }, 'primary')));
  });
  drawThumbs();
}
