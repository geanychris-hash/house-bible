/* Setup Sprint: guided first-time data entry in three short sessions, with packs, quick-fill, bulk paste, a photo inbox, and plate/barcode capture. */
const real = key => S.house[key].filter(x => !x.example);
const PACKS = {
  shutoffs: ['Main water', 'Gas main (meter)', 'Electric main breaker', 'Boiler emergency switch', 'Boiler water feed', 'Water heater cold supply', 'Washing machine valves', 'Outdoor hose bibs', 'Sump pump breaker', 'Oil tank valve (if oil)'].map(n => [n]),
  systems: [['Boiler', 'Heating'], ['Water heater', 'Plumbing'], ['Electrical panel', 'Electrical'], ['Sump pump', 'Plumbing'], ['Chimney / flue', 'Heating'], ['Smoke and CO detectors', 'Electrical'], ['Roof', 'Envelope'], ['Storm windows', 'Envelope'], ['Dehumidifier', 'Other']],
  appliances: ['Range / oven', 'Refrigerator', 'Dishwasher', 'Washer', 'Dryer', 'Microwave / hood', 'Garbage disposal', 'Freezer'].map(n => [n]),
};
const LEVEL_HINT = /boiler|water heater|main water|gas main|electric|panel|sump|oil tank|water feed|dehumid|hose bib/i;
const levelNamed = re => S.settings.levels.find(l => re.test(l)) || '';
const hintLevel = name => LEVEL_HINT.test(name) ? levelNamed(/basement|cellar/i) : '';

/* a field editor used by quick-fill (mirrors openForm) */
function mkField(f, v) {
  let el;
  if (f.type === 'photos') el = photosField();
  else if (f.type === 'select') el = h('select', null, (typeof f.options === 'function' ? f.options() : f.options || []).map(o => h('option', { value: o }, o || '(none)')));
  else if (f.type === 'textarea') el = h('textarea', { rows: 2 });
  else el = h('input', { type: f.type === 'number' ? 'number' : f.type || 'text', placeholder: f.placeholder || '' });
  if (v != null) el.value = v;
  const ctl = f.scan ? h('div', { class: 'row nowrap' }, el, btn('Scan', async () => { const c = await scanBarcode(); if (c) el.value = c; }, 'small')) : el;
  return { el, node: h('div', { class: 'field' + (f.type === 'photos' || f.type === 'textarea' ? ' wide' : '') }, h('label', null, f.label), ctl) };
}

/* step through records that still have blanks. Carries the last level forward so you can walk a floor. */
function quickFill(key, keys) {
  const c = COLLECTIONS[key];
  const queue = S.house[key].filter(it => !it.example && keys.some(k => k !== 'photos' && !it[k]));
  if (!queue.length) { toast('Nothing left to fill in here'); return; }
  let i = 0, carry = '';
  openModal('Quick fill', close => {
    const box = h('div', { class: 'list' });
    const draw = () => {
      if (i >= queue.length) { close(); save(); rerender(); toast('All filled in'); return; }
      const it = queue[i], fields = keys.map(k => c.fields.find(f => f.k === k)), made = {};
      const form = h('div', { class: 'form' }, fields.map(f => { const m = mkField(f, f.k === 'level' && !it.level ? carry : it[f.k]); made[f.k] = m.el; return m.node; }));
      const plate = (key === 'appliances' || key === 'systems') ? btn('Snap data plate', () => capturePlate({
        title: 'Data plate: ' + (it[c.title] || ''), onDone: (v, ids) => {
          if (key === 'appliances') { if (v.brand) made.brand.value = v.brand; if (v.model) made.model.value = v.model; if (v.serial) made.serial.value = v.serial; }
          else { made.details.value = [v.brand && 'Make ' + v.brand, v.model && 'Model ' + v.model, v.serial && 'Serial ' + v.serial, v.mfg && 'Made ' + v.mfg].filter(Boolean).join(' · ') + (made.details.value ? '\n' + made.details.value : ''); }
          if (made.photos) made.photos.value = made.photos.value.concat(ids);
        } }), 'small primary') : null;
      const next = (saveIt) => { if (saveIt) { keys.forEach(k => { const v = made[k].value; if (k === 'photos' || v !== '') it[k] = v; }); delete it.example; if (made.level && made.level.value) carry = made.level.value; save(); } i++; draw(); };
      box.replaceChildren(h('div', { class: 'row spread' }, h('strong', null, it[c.title] || '(untitled)'), h('span', { class: 'muted mono' }, `${i + 1} of ${queue.length}`)),
        plate, form, h('div', { class: 'row spread' }, btn('Skip', () => next(false), 'small'), btn(i === queue.length - 1 ? 'Save and finish' : 'Save and next', () => next(true), 'primary')));
    };
    draw(); return box;
  });
}

function addPack(key, keys) {
  const c = COLLECTIONS[key], have = new Set(S.house[key].map(x => (x[c.title] || '').toLowerCase()));
  const items = PACKS[key].filter(p => !have.has(p[0].toLowerCase()));
  if (!items.length) { quickFill(key, keys); return; }
  const checks = {};
  openModal(`Add common ${c.label.toLowerCase()}`, close => h('div', { class: 'list' },
    h('p', { class: 'muted' }, 'Untick what the house does not have. This only creates the rows; you fill in details next, one at a time.'),
    h('div', { class: 'list' }, items.map(p => h('label', { class: 'row nowrap' }, (checks[p[0]] = h('input', { type: 'checkbox', checked: true })), p[0]))),
    h('div', { class: 'row spread' }, btn('Cancel', close), btn('Add and fill in', () => {
      items.filter(p => checks[p[0]].checked).forEach(p => {
        const base = { id: uid(), level: hintLevel(p[0]), photos: [] };
        if (key === 'shutoffs') S.house[key].push({ ...base, system: p[0], location: '', how: '', tested: '', notes: '' });
        else if (key === 'systems') S.house[key].push({ ...base, category: p[1], name: p[0], details: '', lastService: '' });
        else S.house[key].push({ ...base, name: p[0], brand: '', model: '', serial: '', installed: '', warrantyEnd: '', notes: '' });
      });
      save(); close(); rerender(); quickFill(key, keys);
    }, 'primary'))));
}

/* paste a list. "1st floor: Living room, Kitchen" sets the level for that line; otherwise one item per line. */
function bulkAdd(kind, after) {
  const hints = { radiators: 'One line per level:\n1st floor: Living room, Kitchen, Dining room\n2nd floor: Front bedroom, Bathroom\n(or one room per line)', tools: 'One tool per line. Add a category after a comma if you like:\nCordless drill, Power\nTape measure\nLevel, Measuring', paint: 'One room per line, color after a comma if you know it:\nLiving room, Revere Pewter\nKitchen\nFront bedroom' }[kind];
  const ta = h('textarea', { rows: 8, placeholder: hints });
  openModal({ radiators: 'Add radiators by room', tools: 'Add tools by list', paint: 'Add paint by room' }[kind], close => h('div', { class: 'list' }, h('p', { class: 'muted', style: 'white-space:pre-line' }, hints), ta,
    h('div', { class: 'row spread' }, btn('Cancel', close), btn('Add', () => {
      const lines = ta.value.split('\n').map(x => x.trim()).filter(Boolean); let n = 0;
      const lvl = s => S.settings.levels.find(l => l.toLowerCase() === s.trim().toLowerCase());
      lines.forEach(line => {
        let level = '', body = line; const m = line.match(/^([^:]+):(.*)$/);
        if (m && lvl(m[1])) { level = lvl(m[1]); body = m[2]; }
        const parts = kind === 'tools' || (kind === 'paint' && !level) ? [body] : body.split(',').map(x => x.trim()).filter(Boolean);
        if (kind === 'radiators') parts.forEach(r => { S.house.radiators.push({ id: uid(), room: r, level, size: '', ventModel: '', ventInstalled: '', valve: 'Unknown', pitch: 'Unknown', issue: 'None', lastChecked: '', notes: '', photos: [] }); n++; });
        else if (kind === 'paint') { const [room, color] = (level ? body.split(',') : body.split(/,(.*)/s)).map(x => (x || '').trim()); if (room) { S.house.paint.push({ id: uid(), room, level, surface: 'Walls', brand: '', color: color || '', sheen: '', code: '', date: '', notes: '', photos: [] }); n++; } }
        else { const [name, cat] = body.split(',').map(x => x.trim()); if (name) { const cats = ['Power', 'Hand', 'Measuring', 'Plumbing', 'Electrical', 'Safety', 'Fasteners & supplies', 'Other']; S.tools.push({ id: uid(), name, category: cats.find(c => c.toLowerCase() === (cat || '').toLowerCase()) || 'Hand', status: 'own', notes: '' }); n++; } }
      });
      save(); close(); toast(`Added ${n}`); rerender(); if (after) after();
    }, 'primary'))));
}

function editEmergency() {
  const L = [['gas', 'Gas utility emergency'], ['electric', 'Electric utility'], ['water', 'Water department'], ['heating', 'Heating tech'], ['plumber', 'Plumber'], ['electrician', 'Electrician']];
  openForm({ title: 'Emergency numbers', fields: L.map(([k, l]) => ({ k, label: l, placeholder: '617-555-0100' })), values: S.settings.emergency, onSave: v => { Object.assign(S.settings.emergency, v); save(); rerender(); } });
}

/* ---------- photo inbox: snap now, label later ---------- */
async function snapToInbox(opts) {
  const ids = await addPhotos(opts);
  ids.forEach(photo => S.inbox.push({ id: uid(), photo, at: todayISO() }));
  if (ids.length) { save(); toast(`${ids.length} in the inbox (${S.inbox.length} total)`); rerender(); }
}
function sortInbox(item) {
  const done = () => { S.inbox = S.inbox.filter(x => x !== item); save(); rerender(); };
  const plate = (key, title) => capturePlate({ title, photoId: item.photo, onDone: (v, ids) => {
    const vals = key === 'appliances' ? { brand: v.brand, model: v.model, serial: v.serial, installed: '', photos: ids } : { details: [v.brand && 'Make ' + v.brand, v.model && 'Model ' + v.model, v.serial && 'Serial ' + v.serial, v.mfg && 'Made ' + v.mfg].filter(Boolean).join(' · '), photos: ids };
    editRecord(key, null, vals, done);
  } });
  openModal('What is this a photo of?', close => h('div', { class: 'list' }, photoThumb(item.photo, true),
    h('div', { class: 'row wrapchips' },
      btn('Appliance plate', () => { close(); plate('appliances', 'Appliance plate'); }, 'small primary'), btn('System plate (boiler, heater, panel)', () => { close(); plate('systems', 'System plate'); }, 'small primary'),
      btn('Paint can', () => { close(); editRecord('paint', null, { photos: [item.photo] }, done); }, 'small'), btn('Shutoff', () => { close(); editRecord('shutoffs', null, { photos: [item.photo] }, done); }, 'small'),
      btn('Warranty / paperwork', () => { close(); editRecord('warranties', null, { photos: [item.photo] }, done); }, 'small'), btn('Radiator', () => { close(); editRecord('radiators', null, { photos: [item.photo] }, done); }, 'small'),
      btn('Project record', () => { close(); editRecord('log', null, { photos: [item.photo], date: todayISO() }, done); }, 'small')),
    h('div', { class: 'row' }, btn('Delete photo', () => { photoDel(item.photo); close(); done(); }, 'small danger'))));
}

/* ---------- the plan ---------- */
const sd = () => S.settings.setupDone;
const STEPS = [
  { id: 'emerg', session: 1, title: 'Emergency numbers', mins: 3, why: 'The sheet you want at 2 a.m. Gas, electric, water, heating tech, plumber.', done: () => Object.values(S.settings.emergency).filter(Boolean).length >= 3, prog: () => `${Object.values(S.settings.emergency).filter(Boolean).length} of 6 numbers`,
    acts: () => [btn('Enter numbers', editEmergency, 'small primary')] },
  { id: 'shut', session: 1, title: 'Shutoffs', mins: 10, why: 'Walk to each one, tell the app where it is and how it works, snap a photo. Starts with the usual ten; untick what you do not have.', done: () => real('shutoffs').filter(x => x.location).length >= 4, prog: () => `${real('shutoffs').filter(x => x.location).length} located`,
    acts: () => [btn('Add common shutoffs', () => addPack('shutoffs', ['level', 'location', 'how', 'photos']), 'small primary'), btn('Fill in blanks', () => quickFill('shutoffs', ['level', 'location', 'how', 'photos']), 'small')] },
  { id: 'rads', session: 1, title: 'Radiators', mins: 10, why: 'Paste every room in one go, then walk the house once: level, size, vent model, pitch. The radiator walk-through task is due before first heat.', done: () => real('radiators').length >= 3 && real('radiators').every(r => r.lastChecked), prog: () => `${real('radiators').length} listed, ${real('radiators').filter(r => r.lastChecked).length} checked`,
    acts: () => [btn('Paste rooms', () => bulkAdd('radiators'), 'small primary'), btn('Walk and fill in', () => quickFill('radiators', ['level', 'size', 'ventModel', 'pitch', 'valve', 'photos']), 'small'), btn('Rounds', startRounds, 'small')] },
  { id: 'sys', session: 2, title: 'Systems', mins: 10, why: 'Boiler, water heater, panel, sump. One photo of each plate; the text reader or a paste does the typing.', done: () => real('systems').filter(x => x.details).length >= 3, prog: () => `${real('systems').filter(x => x.details).length} with details`,
    acts: () => [btn('Add common systems', () => addPack('systems', ['level', 'details', 'photos']), 'small primary'), btn('Fill in blanks', () => quickFill('systems', ['level', 'details', 'photos']), 'small')] },
  { id: 'app', session: 2, title: 'Appliances', mins: 20, why: 'Snap the plate, confirm brand, model and serial. Warranty dates can wait.', done: () => real('appliances').filter(x => x.model).length >= 4, prog: () => `${real('appliances').filter(x => x.model).length} with a model`,
    acts: () => [btn('Add common appliances', () => addPack('appliances', ['level', 'brand', 'model', 'serial', 'photos']), 'small primary'), btn('Fill in blanks', () => quickFill('appliances', ['level', 'brand', 'model', 'serial', 'photos']), 'small')] },
  { id: 'paint', session: 3, title: 'Paint and finishes', mins: 10, why: 'List rooms, then photo the can lid or scan its barcode. Leftover cans in the basement are the best source.', done: () => real('paint').filter(x => x.color).length >= 3, prog: () => `${real('paint').filter(x => x.color).length} with a color`,
    acts: () => [btn('Paste rooms', () => bulkAdd('paint'), 'small primary'), btn('Fill in blanks', () => quickFill('paint', ['color', 'brand', 'sheen', 'code', 'photos']), 'small')] },
  { id: 'warr', session: 3, title: 'Warranties and paperwork', mins: 8, why: 'Photograph the paperwork, fill in the end date later. Home inspection report, appliance receipts, roof and window papers.', done: () => real('warranties').length >= 1, prog: () => `${real('warranties').length} filed`,
    acts: () => [btn('Snap paperwork', () => snapToInbox(), 'small primary'), btn('Add warranty', () => editRecord('warranties', null), 'small')] },
  { id: 'hist', session: 3, title: 'History and tools', mins: 10, why: 'Dates and costs for the three jobs already listed, then paste your tool list.', done: () => S.house.log.some(x => x.date || x.cost != null) && S.tools.filter(x => !x.example).length >= 8, prog: () => `${S.house.log.filter(x => x.date || x.cost != null).length} dated jobs, ${S.tools.filter(x => !x.example).length} tools`,
    acts: () => [btn('Find a tool', () => findTool(), 'small primary'), btn('Paste tools', () => bulkAdd('tools'), 'small'), btn('Add past project', () => editRecord('log', null), 'small')] },
  { id: 'cal', session: 3, title: 'Put reminders on your phone', mins: 2, why: 'Download the calendar file and open it on the phone to import. Tasker CSV is there too.', done: () => !!sd().cal, prog: () => sd().cal ? 'done' : '',
    acts: () => [btn('Calendar (.ics)', () => { download('house-maintenance.ics', makeICS(), 'text/calendar'); sd().cal = true; save(); rerender(); }, 'small primary'), btn('Tasker CSV', () => download('tasker-reminders.csv', makeTaskerCSV(), 'text/csv'), 'small')] },
];
const SESSIONS = { 1: ['Session 1 · Before first heat', 'About 25 min. Do this first: the radiator check is due Oct 3.'], 2: ['Session 2 · Basement and kitchen walk', 'About 30 min. One plate photo per item.'], 3: ['Session 3 · Couch session', 'About 30 min. Nothing here needs you to walk the house.'] };
function setupProgress() {
  const done = STEPS.filter(s => s.done() || sd()['x_' + s.id]);
  return { n: done.length, total: STEPS.length, mins: STEPS.filter(s => !done.includes(s)).reduce((a, s) => a + s.mins, 0), done };
}
function setupCard() {
  const p = setupProgress(); if (p.n >= p.total || sd().hide) return null;
  return h('section', { class: 'panel setup-card' }, h('div', { class: 'row spread' }, h('div', null, h('div', { class: 'eyebrow' }, 'SETUP SPRINT'), h('strong', null, `${p.n} of ${p.total} steps done · about ${p.mins} min left`)),
    h('div', { class: 'row' }, btn('Continue', () => go('setup'), 'primary small'), btn('Hide', () => { sd().hide = true; save(); rerender(); }, 'small'))),
    h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(p.n / p.total * 100)}%` })));
}
function viewSetup() {
  const p = setupProgress();
  const row = s => { const isDone = p.done.includes(s); return h('div', { class: 'item step' + (isDone ? ' ok' : '') },
    h('div', { class: 'row spread' }, h('span', { class: 'title' }, (isDone ? '✓ ' : '') + s.title), h('span', { class: 'row' }, chip(s.mins + ' min'), s.prog() ? chip(s.prog(), isDone ? 'good' : '') : null)),
    h('span', { class: 'muted' }, s.why), h('div', { class: 'row wrapchips' }, s.acts(), btn(sd()['x_' + s.id] ? 'Un-skip' : 'Mark done', () => { sd()['x_' + s.id] = !sd()['x_' + s.id]; save(); rerender(); }, 'small ghost'))); };
  const inbox = S.inbox;
  return h('div', { class: 'list' },
    h('section', { class: 'panel' }, h('div', { class: 'eyebrow' }, 'SETUP SPRINT'), h('h1', null, `${p.n} of ${p.total} steps done`), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(p.n / p.total * 100)}%` })),
      h('p', { class: 'muted' }, `About ${p.mins} minutes left, in three short sessions. Steps tick themselves off as you add data. Skipping is fine; the app is useful at 30% filled.`)),
    panel('Fast lane: photo inbox', h('span', { class: 'row' }, btn('Snap', () => snapToInbox(), 'primary small'), btn('Add many from gallery', () => snapToInbox({ camera: false, multi: true }), 'small')),
      h('p', { class: 'muted' }, 'Fastest way to capture a whole house: walk it once taking photos (plates, paint lids, valves, paperwork) with Snap, or with your normal camera and then Add many. Sort them on the couch, one tap each; the text reader fills in model and serial.'),
      inbox.length ? h('div', { class: 'list' }, inbox.map(it => h('div', { class: 'item row spread nowrap' }, photoThumb(it.photo), h('span', { class: 'row' }, btn('Sort', () => sortInbox(it), 'small primary'), btn('Delete', () => { photoDel(it.photo); S.inbox = S.inbox.filter(x => x !== it); save(); rerender(); }, 'small'))))) : empty('Inbox is empty.')),
    [1, 2, 3].map(n => panel(SESSIONS[n][0], null, h('p', { class: 'muted' }, SESSIONS[n][1]), h('div', { class: 'list' }, STEPS.filter(s => s.session === n).map(row)))),
    panel('Time savers', null, h('ul', { class: 'tips' },
      h('li', null, 'Do one floor at a time. Quick fill remembers the level you chose, so you only retype it when you change floors.'),
      h('li', null, 'Do not type what you can photograph. A clear photo of a plate is a complete record even if you never transcribe it.'),
      h('li', null, 'Text reader needs internet the first time and works best on flat, well-lit plates. If it misreads, copy the text from your Gallery (tap the text icon on the photo) and paste it in; the app pulls out brand, model and serial.'),
      h('li', null, 'Barcode scan fills paint cans and tool boxes with the code. It does not look up prices or product names; there is no AI or price lookup, as you asked.'),
      h('li', null, 'Leave unknowns blank. Blank means unknown, and the Claude reference file says so.'))));
}
