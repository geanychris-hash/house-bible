/* Find my tool: type a brand and tool, see matching models from the built-in list, then answer a few cue questions.
   Pictures: the app has no image service, so it opens image search for you and lets you attach your own photo. */
const CATALOG_NOTE = 'Bauer models from harborfreight.com, checked 2026-10-01. Specs are partial; confirm against the label on your tool.';
const mk = (name, item, specs, slug) => ({ brand: 'Bauer', type: 'drill', name, item, specs, url: 'https://www.harborfreight.com/' + slug });
const CATALOG = [
  mk('20V Brushless Cordless, 1/2 in. Drill/Driver (tool only)', '58952', '20V · brushless · 1/2 in. chuck', '20v-brushless-cordless-12-in-drilldriver-tool-only-58952.html'),
  mk('20V Cordless, 1/2 in. Drill/Driver Kit, 2 Ah battery and charger', '73216', '20V · brushed · 1/2 in. chuck · kit', '20v-cordless-12-in-drilldriver-kit-with-2-ah-battery-and-charger-73216.html'),
  mk('20V Cordless, 1/2 in. Hammer Drill/Driver Kit, 1.5 Ah battery and charger', '64756', '20V · hammer · 1/2 in. chuck · kit', '20v-cordless-12-in-hammer-drilldriver-kit-with-15-ah-battery-and-charger-64756.html'),
  mk('20V Brushless Cordless, 1/2 in. Hammer Drill (tool only)', '59368', '20V · brushless · hammer · 1/2 in. chuck', '20v-brushless-cordless-12-in-hammer-drill-tool-only-59368.html'),
  mk('20V Cordless, 3/8 in. Right Angle Drill (tool only)', '64582', '20V · right angle · 3/8 in. chuck', '20v-cordless-38-in-right-angle-drill-tool-only-64582.html'),
  mk('20V 2-Tool Drill and Impact Driver Kit', '73238', '20V · drill plus impact driver kit', '20v-2-tool-drill-impact-driver-kit-73238.html'),
  mk('20V Cordless, 6-Tool Combo Kit', '71292', '20V · 6-tool combo · 3 Ah and 1.5 Ah batteries', '20v-cordless-6-tool-combo-kit-with-3-ah-battery-15-ah-battery-and-charger-71292.html'),
  mk('20V Brushless Cordless, 1/2 in. SDS-PLUS Rotary Hammer (tool only)', '57744', '20V · brushless · SDS-PLUS', '20v-brushless-cordless-12-in-sds-plus-type-rotary-hammer-tool-only-57744.html'),
  mk('7.5 Amp, 1/2 in. Variable-Speed Reversible Hammer Drill', '56404', 'corded · 7.5 A · hammer · 1/2 in. chuck', '75-amp-12-in-variable-speed-reversible-hammer-drill-45000-bpm-for-concrete-wood-and-steel-56404.html'),
  mk('6.3 Amp, 1/2 in. Variable-Speed Drill', '59519', 'corded · 6.3 A · 1/2 in. chuck', '63-amp-12-in-variable-speed-drill-59519.html'),
  mk('9 Amp, 1/2 in. Variable-Speed D-Handle Drill', '59716', 'corded · 9 A · D-handle · 1/2 in. chuck', '9-amp-12-in-variable-speed-d-handle-drill-59716.html'),
  mk('3.5 Amp, 3/8 in. Variable-Speed Close Quarters Drill', '57148', 'corded · 3.5 A · 3/8 in. chuck', '35-amp-38-in-variable-speed-close-quarters-drill-57148.html'),
];
const SELECT_ = (label, options) => ({ label, options });
const CUES = [
  [/drill|driver|impact/i, 'Power', [SELECT_('Power source', ['Cordless', 'Corded']), SELECT_('Battery platform', ['20V Bauer', '18V Ryobi', '20V DeWalt', 'M18 Milwaukee', 'Other', 'n/a']), SELECT_('Chuck / drive', ['1/2 in.', '3/8 in.', '1/4 in. hex', 'SDS']), SELECT_('Brushless', ['Yes', 'No', 'Not sure']), SELECT_('Hammer mode', ['Yes', 'No']), SELECT_('Batteries you have', ['0', '1', '2', '3+'])]],
  [/saw|jigsaw|circular|miter|recip/i, 'Power', [SELECT_('Power source', ['Cordless', 'Corded']), SELECT_('Blade size', ['4-1/2 in.', '6-1/2 in.', '7-1/4 in.', '10 in.', '12 in.', 'Other']), SELECT_('Battery platform', ['20V Bauer', '18V Ryobi', '20V DeWalt', 'M18 Milwaukee', 'Other', 'n/a'])]],
  [/sander|grinder|router|planer/i, 'Power', [SELECT_('Power source', ['Cordless', 'Corded']), SELECT_('Size / pad / disc', ['Small', 'Medium', 'Large']), SELECT_('Dust collection', ['Bag', 'Vacuum port', 'None'])]],
  [/level|square|tape|caliper|stud/i, 'Measuring', [SELECT_('Length / range', ['Short', 'Medium', 'Long']), SELECT_('Type', ['Standard', 'Laser', 'Digital'])]],
  [/wrench|plier|screwdriver|hammer|chisel|socket/i, 'Hand', [SELECT_('Set or single', ['Single', 'Set']), SELECT_('Sizes (SAE / metric)', ['SAE', 'Metric', 'Both'])]],
];
const GENERIC_CUES = [SELECT_('Power source', ['Cordless', 'Corded', 'Manual', 'n/a'])];
function cuesFor(q) { const c = CUES.find(x => x[0].test(q)); return c ? { cat: c[1], cues: c[2] } : { cat: 'Other', cues: GENERIC_CUES }; }
function searchCatalog(q) {
  const w = q.toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) return [];
  return CATALOG.filter(m => { const hay = (m.brand + ' ' + m.type + ' ' + m.name + ' ' + m.specs + ' ' + m.item).toLowerCase(); return w.every(x => hay.includes(x) || (x === 'drill' && m.type === 'drill')); });
}
const imageSearchURL = q => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q);

/* link -> name and item number from the URL itself (the page cannot be fetched from inside an app) */
function parseLink(raw) {
  let u; try { u = new URL(raw.trim()); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\./, ''), segs = u.pathname.split('/').filter(Boolean);
  const words = s => decodeURIComponent(s).replace(/\.html?$/, '').replace(/[-_]+/g, ' ').trim();
  let name = '', item = '', store = host;
  if (/harborfreight/.test(host)) { store = 'Harbor Freight'; const slug = segs[segs.length - 1] || ''; const m = slug.match(/-(\d{4,6})\.html$/); item = m ? m[1] : ''; name = words(slug.replace(/-\d{4,6}\.html$/, '')); }
  else if (/homedepot/.test(host)) { store = 'Home Depot'; const i = segs.indexOf('p'); name = i >= 0 ? words(segs[i + 1] || '') : ''; item = segs[segs.length - 1].match(/^\d{6,}$/) ? segs[segs.length - 1] : ''; }
  else { name = words(segs.filter(x => !/^\d+$/.test(x)).sort((a, b) => b.length - a.length)[0] || ''); const m = u.pathname.match(/(\d{5,})/); item = m ? m[1] : ''; }
  name = name.replace(/\b\w/g, c => c.toUpperCase()).replace(/\b(\d+)v\b/gi, '$1V').replace(/\bIn\b/g, 'in.').replace(/\b(\d) (\d) in\./g, '$1/$2 in.');
  return name ? { name, item, store, url: u.href } : null;
}
/* barcode -> product name and picture via free public services; any failure just returns null */
async function lookupUPC(code) {
  const tryFetch = async (url, pick) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 7000); const r = await fetch(url, { signal: c.signal }); clearTimeout(t); if (!r.ok) return null; return pick(await r.json()); } catch (e) { return null; } };
  return await tryFetch('https://api.upcitemdb.com/prod/trial/lookup?upc=' + encodeURIComponent(code), j => { const it = j.items && j.items[0]; return it ? { name: it.title, brand: it.brand, model: it.model, pic: (it.images || [])[0] || '' } : null; })
    || await tryFetch('https://world.openproductsfacts.org/api/v0/product/' + encodeURIComponent(code) + '.json', j => j.status === 1 && j.product ? { name: j.product.product_name, brand: j.product.brands, model: '', pic: j.product.image_front_url || '' } : null);
}
async function fromBarcode(close) {
  const code = await scanBarcode(); if (!code) return;
  toast('Looking it up...'); const r = await lookupUPC(code);
  if (close) close();
  if (r && r.name) toolCue({ name: [r.brand, r.name].filter(Boolean).join(' ').replace(new RegExp('^(' + (r.brand || 'x') + ' )\\1', 'i'), '$1'), model: r.model || '', specs: '', query: r.name, code, pic: r.pic });
  else { toast('No match online. Code saved; add the name.'); toolCue({ name: '', model: '', specs: '', query: '', code }); }
}
function findTool(startQuery = '') {
  const link = h('input', { type: 'url', placeholder: 'Paste a product link', 'aria-label': 'Product link' });
  const q = h('input', { type: 'search', placeholder: 'Bauer drill', value: startQuery, 'aria-label': 'Brand and tool' });
  const out = h('div', { class: 'list' });
  openModal('Find my tool', close => {
    const draw = () => {
      const text = q.value.trim();
      const hits = searchCatalog(text);
      out.replaceChildren(
        text ? h('div', { class: 'row wrapchips' }, h('a', { class: 'btn small primary', href: imageSearchURL(text + ' model'), target: '_blank', rel: 'noopener' }, 'See pictures'),
          h('a', { class: 'btn small', href: searchURL('Harbor Freight', text), target: '_blank', rel: 'noopener' }, 'Harbor Freight'), h('a', { class: 'btn small', href: searchURL('Home Depot', text), target: '_blank', rel: 'noopener' }, 'Home Depot')) : null,
        text ? h('p', { class: 'muted', style: 'font-size:12px' }, 'Pictures open in your browser. Long-press one and save it, or take a photo of your own tool next, and attach it on the next step.') : null,
        hits.length ? h('div', { class: 'list' }, hits.map(m => h('div', { class: 'item' }, h('div', { class: 'row spread' }, h('span', { class: 'title' }, `${m.brand} ${m.name}`), chip('#' + m.item)), h('span', { class: 'muted' }, m.specs),
          h('div', { class: 'row' }, btn('This is mine', () => { close(); toolCue({ name: `${m.brand} ${m.name}`, model: m.item, specs: m.specs, query: text }); }, 'small primary'), h('a', { class: 'btn small', href: m.url, target: '_blank', rel: 'noopener' }, 'Product page')))), h('p', { class: 'muted', style: 'font-size:11px' }, CATALOG_NOTE))
          : (text ? h('p', { class: 'muted' }, 'No model in the built-in list for that. Not a problem: continue and enter what is on the label.') : h('p', { class: 'muted' }, 'Type a brand and a tool. Bauer drills are built in; anything else uses the questions and your own photo.')),
        text ? btn('Not listed, enter it myself', () => { close(); toolCue({ name: text, model: '', specs: '', query: text }); }, 'small') : null);
    };
    q.addEventListener('input', draw); draw();
    const goLink = () => { const r = parseLink(link.value); if (!r) { toast('That does not look like a product link'); return; } close(); toolCue({ name: r.name, model: r.item, specs: '', query: r.name, link: r.url, store: r.store }); };
    return h('div', { class: 'list' }, q, h('div', { class: 'row nowrap' }, link, btn('Use link', goLink, 'small')), h('div', { class: 'row' }, btn('Scan barcode', () => fromBarcode(close), 'small primary'), h('span', { class: 'muted', style: 'font-size:12px' }, 'or search below')), out);
  });
}

/* the cue step: asks only what matters for this kind of tool, takes a photo, saves to the tool inventory */
function toolCue({ name, model, specs, query, code: code0, pic, link: link0, store }) {
  const { cat, cues } = cuesFor(query + ' ' + name);
  const inputs = [];
  const photos = photosField(), code = h('input', { placeholder: 'Barcode, optional', value: code0 || '' });
  const nameI = h('input', { value: name }), modelI = h('input', { value: model, placeholder: 'On the label: Item or Model no.' });
  const status = h('select', null, h('option', { value: 'own' }, 'I own it'), h('option', { value: 'want' }, 'I want it'));
  openModal('About this tool', close => h('div', { class: 'list' },
    specs ? h('p', { class: 'muted' }, 'Listed as: ' + specs) : null,
    pic ? h('img', { src: pic, class: 'thumb', style: 'width:96px;height:96px', alt: 'product', referrerpolicy: 'no-referrer' }) : null,
    link0 ? h('p', { class: 'muted', style: 'font-size:12px' }, 'From ' + (store || 'link') + '. Check the name and model against your tool.') : null,
    h('div', { class: 'form' }, h('div', { class: 'field wide' }, h('label', null, 'Name'), nameI), h('div', { class: 'field' }, h('label', null, 'Model / item no.'), modelI), h('div', { class: 'field' }, h('label', null, 'Status'), status),
      cues.map(c => { const s = h('select', null, h('option', { value: '' }, '(skip)'), c.options.map(o => h('option', { value: o }, o))); const sp = (specs || '').toLowerCase(), nm = (name || '').toLowerCase();
        const guess = { 'Power source': /corded/.test(sp) && !/cordless/.test(sp) && !/\bv\b|\d+v/.test(sp) ? 'Corded' : (/\d+v/.test(sp) ? 'Cordless' : ''), 'Battery platform': /20v/.test(sp) && /^bauer/.test(nm) ? '20V Bauer' : '', 'Brushless': /brushless/.test(sp) ? 'Yes' : /brushed/.test(sp) ? 'No' : '', 'Hammer mode': /hammer/.test(sp) ? 'Yes' : '', 'Chuck / drive': /sds/.test(sp) ? 'SDS' : (c.options.find(o => sp.includes(o.toLowerCase())) || '') }[c.label];
        if (guess && c.options.includes(guess)) s.value = guess;
        inputs.push([c.label, s]); return h('div', { class: 'field' }, h('label', null, c.label), s); }),
      h('div', { class: 'field' }, h('label', null, 'Barcode'), h('div', { class: 'row nowrap' }, code, btn('Scan', async () => { const c = await scanBarcode(); if (c) code.value = c; }, 'small'))),
      h('div', { class: 'field wide' }, h('label', null, 'Your photos (tool, label, or a picture you saved)'), photos)),
    h('div', { class: 'row spread' }, btn('Cancel', close), btn('Add to my tools', () => {
      if (!nameI.value.trim()) { toast('Name it'); return; }
      const notes = [modelI.value && 'Model ' + modelI.value, code.value && 'Code ' + code.value, link0 && 'Link ' + link0, ...inputs.filter(([, s]) => s.value).map(([l, s]) => `${l}: ${s.value}`)].filter(Boolean).join(' · ');
      S.tools.push({ id: uid(), name: nameI.value.trim(), category: cat, status: status.value, notes, photos: photos.value, pic: pic || '' }); save(); close(); toast('Added'); rerender();
    }, 'primary'))));
}

/* import a list file ({tools:[], paint:[]}), e.g. one made from receipts. Skips names already present. */
function importList() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => {
    try {
      const d = JSON.parse(r.result); let nt = 0, np = 0;
      const have = new Set(S.tools.map(x => x.name.toLowerCase()));
      (d.tools || []).forEach(x => { if (x.name && !have.has(x.name.toLowerCase())) { S.tools.push({ id: uid(), name: x.name, category: x.category || 'Other', status: x.status || 'own', notes: x.notes || '', photos: [] }); nt++; } });
      (d.paint || []).forEach(x => { S.house.paint.push({ id: uid(), room: x.room || '', level: '', surface: x.surface || 'Walls', brand: x.brand || '', color: x.color || '', sheen: x.sheen || '', code: x.code || '', date: x.date || '', notes: x.notes || '', photos: [] }); np++; });
      save(); toast(`Added ${nt} tools, ${np} paint entries`); rerender();
    } catch (e) { toast('Could not read that file'); }
  }; r.readAsText(f); };
  inp.click();
}
