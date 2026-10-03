/* App shell: navigation, header, search, emergency sheet, radiator rounds, home, house tab (map, steam, records, tools). */
const route = { tab: 'home', houseSub: 'map', house: 'shutoffs', maintain: 'year', projects: 'list', pid: null, level: null, month: null, steamOn: null };
const ICONS = {
  home: '<circle cx="12" cy="12" r="8"/><path d="M12 12l4-5M12 4v2M20 12h-2M4 12h2"/>',
  house: '<path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-5h6v5"/>',
  maintain: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  projects: '<path d="M4 6h6v5H4zM14 13h6v5h-6zM10 8.5h2a2 2 0 0 1 2 2V13"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};
const TABS = [['home', 'Home'], ['house', 'House'], ['maintain', 'Upkeep'], ['projects', 'Projects'], ['more', 'More']];
function go(tab, patch) {
  route.tab = tab; Object.assign(route, patch || {});
  try { localStorage.setItem('hb.route', JSON.stringify({ tab: route.tab })); } catch (e) { }
  render(); window.scrollTo(0, 0);
}
const rerender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

/* ---------- small shared UI ---------- */
function seg(options, value, onPick) {
  return h('div', { class: 'seg-ctl', role: 'group' }, options.map(o => h('button', { type: 'button', 'aria-pressed': String(o === value), onclick: e => { onPick(o); [...e.currentTarget.parentNode.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, o)));
}
const legendDot = (cls, label) => h('span', { class: 'lg' }, h('i', { class: 'sw ' + cls }), label);

/* ---------- records ---------- */
function editRecord(key, item, defaults, after) {
  const c = COLLECTIONS[key], list = S.house[key];
  openForm({
    title: item ? `Edit ${c.single}` : `Add ${c.single}`, fields: c.fields,
    values: item || Object.assign({ date: key === 'log' ? todayISO() : '', status: key === 'log' ? 'Done' : undefined }, defaults || {}),
    onSave: v => { if (item) Object.assign(item, v, { example: false }); else list.push({ id: uid(), ...v }); save(); if (after) after(); else rerender(); },
    onDelete: item ? () => { S.house[key] = list.filter(x => x !== item); save(); rerender(); } : null,
  });
}
function openRecord(key, item) { go('house', { houseSub: 'records', house: key }); editRecord(key, item); }
function showTask(t) {
  const st = taskStatus(t), last = (t.done || []).slice().sort().pop();
  openModal(t.title, close => h('div', { class: 'list' },
    h('div', { class: 'row' }, dueChip(st), chip(t.season), chip(ruleText(t.rule))),
    h('dl', { class: 'kv' }, h('dt', null, 'Time'), h('dd', null, t.time || ''), h('dt', null, 'Tools'), h('dd', null, t.tools || 'none'), h('dt', null, 'Why'), h('dd', null, t.why), h('dt', null, 'How'), h('dd', null, t.how),
      t.safety ? h('dt', null, 'Safety') : null, t.safety ? h('dd', null, t.safety) : null, h('dt', null, 'Last done'), h('dd', null, last ? fmtDate(last) : 'never logged')),
    h('div', { class: 'row' }, btn('Mark done today', () => { t.done.push(todayISO()); save(); toast('Logged'); close(); rerender(); }, 'primary'), btn('Edit', () => { close(); editTask(t); }), btn('Close', close))));
}
function editTool(t) {
  const cats = ['Power', 'Hand', 'Measuring', 'Plumbing', 'Electrical', 'Safety', 'Fasteners & supplies', 'Other'];
  const fields = [{ k: 'name', label: 'Tool', wide: true }, { k: 'category', label: 'Category', type: 'select', options: cats }, { k: 'status', label: 'Status', type: 'select', options: ['own', 'want'] }, { k: 'notes', label: 'Brand, size, battery platform', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }];
  openForm({ title: t ? 'Edit tool' : 'Add tool', fields, values: t || { category: 'Hand', status: 'own' },
    onSave: v => { if (!v.name) { toast('Name the tool'); return false; } if (t) Object.assign(t, v, { example: false }); else S.tools.push({ id: uid(), ...v }); save(); rerender(); },
    onDelete: t ? () => { S.tools = S.tools.filter(x => x !== t); save(); rerender(); } : null });
}

/* ---------- search ---------- */
function buildIndex() {
  const idx = [];
  Object.entries(COLLECTIONS).forEach(([k, c]) => S.house[k].forEach(it => idx.push({ kind: c.label, title: it[c.title] || '(untitled)', sub: c.sub.map(f => it[f]).filter(Boolean).join(' · '), hay: Object.values(it).join(' ').toLowerCase(), run: () => openRecord(k, it) })));
  S.tasks.forEach(t => idx.push({ kind: 'Upkeep', title: t.title, sub: t.season, hay: [t.title, t.why, t.how, t.tools, t.season].join(' ').toLowerCase(), run: () => showTask(t) }));
  S.projects.forEach(p => idx.push({ kind: 'Project', title: p.name, sub: `${p.status} · ${p.priority}`, hay: [p.name, p.notes, ...(p.steps || []).map(s => s.t), ...(p.materials || []).map(m => m.item), ...(p.tools || []), ...(p.parts || []).map(x => x.name + ' ' + x.material)].join(' ').toLowerCase(), run: () => go('projects', { projects: 'detail', pid: p.id }) }));
  S.tools.forEach(t => idx.push({ kind: 'Tool', title: t.name, sub: `${t.category || ''} · ${t.status === 'want' ? 'want' : 'own'}`, hay: [t.name, t.category, t.notes].join(' ').toLowerCase(), run: () => { go('house', { houseSub: 'tools' }); editTool(t); } }));
  return idx;
}
function openSearch() {
  const idx = buildIndex(); let sel = 0, hits = [];
  openModal('Search', close => {
    const list = h('div', { class: 'results', role: 'listbox' });
    const draw = () => {
      list.replaceChildren(...hits.map((x, i) => h('button', { type: 'button', class: 'res' + (i === sel ? ' on' : ''), role: 'option', 'aria-selected': String(i === sel), onclick: () => { close(); x.run(); } },
        h('span', { class: 'kind' }, x.kind), h('span', { class: 'rt' }, x.title), x.sub ? h('span', { class: 'muted rs' }, x.sub) : null)));
      if (!hits.length) list.append(h('p', { class: 'muted', style: 'padding:6px' }, input.value.trim() ? 'No matches.' : 'Type to search notes, tasks, projects, materials and tools.'));
    };
    const input = h('input', { id: 'q', type: 'search', placeholder: 'Search everything…', autocomplete: 'off', style: 'width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-size:16px',
      oninput: () => { const w = input.value.toLowerCase().split(/\s+/).filter(Boolean); hits = w.length ? idx.filter(x => w.every(t => x.hay.includes(t) || x.title.toLowerCase().includes(t))).slice(0, 40) : []; sel = 0; draw(); },
      onkeydown: e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); draw(); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); close(); hits[sel].run(); }
      } });
    draw();
    return h('div', { class: 'list' }, input, list, h('div', { class: 'row spread' }, h('span', { class: 'muted', style: 'font-size:12px' }, 'Shortcut: / or Ctrl+K'), btn('Close', close, 'small')));
  });
}

/* ---------- emergency sheet ---------- */
function openEmergency() {
  openModal('Emergency shutoffs', close => {
    const order = S.settings.levels, list = S.house.shutoffs.slice().sort((a, b) => order.indexOf(a.level || '') - order.indexOf(b.level || ''));
    const nums = Object.entries({ gas: 'Gas utility emergency', electric: 'Electric utility', water: 'Water department', heating: 'Heating tech', plumber: 'Plumber', electrician: 'Electrician' }).filter(([k]) => S.settings.emergency[k]);
    return h('div', { class: 'list' },
      h('div', { class: 'banner', style: 'border-color:var(--bad)' }, 'Smell gas? Leave the house first, then call the gas utility emergency line and 911 from outside. Do not flip switches.'),
      list.length ? list.map(s => h('div', { class: 'item big' }, h('div', { class: 'row spread' }, h('span', { class: 'title' }, s.system), s.level ? chip(s.level) : null),
        h('div', null, s.location || h('span', { class: 'muted' }, 'location not recorded')), s.how ? h('div', { class: 'muted' }, s.how) : null))
        : h('p', { class: 'muted' }, 'No shutoffs recorded yet. Add the main water, gas, electric and boiler shutoffs now, while nothing is wrong.'),
      nums.length ? h('div', { class: 'item' }, h('h3', null, 'Numbers'), nums.map(([k, label]) => h('div', { class: 'row spread' }, h('span', null, label), h('a', { href: 'tel:' + S.settings.emergency[k].replace(/[^\d+]/g, ''), class: 'mono' }, S.settings.emergency[k])))) : null,
      h('div', { class: 'row spread' }, btn('Add or edit shutoffs', () => { close(); go('house', { houseSub: 'records', house: 'shutoffs' }); }, 'small'), btn('Close', close, 'small')));
  });
}

/* ---------- radiator rounds ---------- */
function startRounds() {
  const order = S.settings.levels;
  const list = S.house.radiators.slice().sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level) || a.room.localeCompare(b.room));
  if (!list.length) { toast('Add your radiators first'); go('house', { houseSub: 'steam' }); return; }
  let i = 0;
  openModal('Radiator rounds', close => {
    const box = h('div', { class: 'list' });
    const draw = () => {
      box.replaceChildren();
      if (i >= list.length) {
        const c = { good: 0, warn: 0, bad: 0, unk: 0 }; list.forEach(r => c[radStatus(r)]++);
        const task = S.tasks.find(t => t.id === 'fall-radiator-check');
        box.append(h('p', null, `Checked ${list.length} radiators.`), h('div', { class: 'row' }, chip(`${c.good} good`, 'good'), chip(`${c.warn} re-pitch`, 'warn'), chip(`${c.bad} issues`, 'bad'), chip(`${c.unk} unchecked`)),
          h('div', { class: 'row' }, task ? btn('Mark walk-through task done', () => { task.done.push(todayISO()); save(); toast('Logged'); close(); rerender(); }, 'primary') : null, btn('Done', () => { close(); rerender(); })));
        return;
      }
      const r = list[i];
      box.append(h('div', { class: 'row spread' }, h('span', { class: 'muted mono' }, `${i + 1} of ${list.length}`), chip(r.level || 'no level')),
        h('h3', { style: 'font-size:22px;text-transform:none;color:var(--ink)' }, r.room),
        h('p', { class: 'muted' }, [r.size, r.ventModel && 'vent ' + r.ventModel].filter(Boolean).join(' · ') || 'Size and vent not recorded'),
        h('div', { class: 'field' }, h('label', null, 'Slopes toward the valve?'), seg(['Pitched OK', 'Needs re-pitch', 'Unknown'], r.pitch || 'Unknown', v => { r.pitch = v; save(); })),
        h('div', { class: 'field' }, h('label', null, 'Supply valve'), seg(['Fully open', 'Fully closed', 'Unknown'], r.valve || 'Unknown', v => { r.valve = v; save(); })),
        h('div', { class: 'field' }, h('label', { for: 'rr_issue' }, 'Any issue'), h('select', { id: 'rr_issue', value: r.issue || 'None', onchange: e => { r.issue = e.target.value; save(); } }, ['None', 'Cold or slow', 'Water hammer', 'Spitting vent', 'Leak', 'Other'].map(o => h('option', { value: o }, o)))),
        h('div', { class: 'row spread' }, btn('Back', () => { if (i > 0) { i--; draw(); } }, 'small'), btn(i === list.length - 1 ? 'Finish' : 'Save and next', () => { r.lastChecked = todayISO(); delete r.example; save(); i++; draw(); }, 'primary')));
    };
    draw(); return box;
  });
}

/* ---------- header and nav ---------- */
function header() {
  return h('div', { class: 'top' },
    h('div', { class: 'brand' }, 'House Bible', h('small', null, [S.settings.houseAge && 'built ' + S.settings.houseAge, 'Canton MA', 'steam heat'].filter(Boolean).join(' · '))),
    h('div', { class: 'row' }, btn('Search', openSearch, 'small'), btn('Shutoffs', openEmergency, 'small emerg')));
}
function render() {
  const app = $('#app'); app.replaceChildren();
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' }, TABS.map(([k, l]) => h('button', { 'aria-current': k === route.tab ? 'page' : null, onclick: () => go(k) },
    h('span', { html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>` }), l)));
  const views = { setup: viewSetup, home: viewHome, house: viewHouse, maintain: viewMaintain, projects: viewProjects, more: viewMore };
  app.append(header(), nav, h('main', null, (views[route.tab] || viewHome)()));
}

/* ================= HOME ================= */
function viewHome() {
  const wrap = h('div', { class: 'list' });
  const sc = setupCard(); if (sc) wrap.append(sc);
  if (S.settings.examples) wrap.append(h('div', { class: 'banner' }, 'Rows marked "(example)" show how things work. Remove them in More > Remove examples.'));
  const hi = heatInfo();
  const all = S.tasks.map(t => ({ t, st: taskStatus(t) }));
  const needs = all.filter(x => x.st.state === 'due' || x.st.state === 'over').sort((a, b) => a.st.date.localeCompare(b.st.date));
  const soon = all.filter(x => x.st.state === 'upcoming' && x.st.days <= 30).sort((a, b) => a.st.date.localeCompare(b.st.date));
  const open = S.projects.filter(p => p.status !== 'Done');
  const est = open.reduce((s, p) => s + projectEstimate(p), 0), spent = S.projects.reduce((s, p) => s + projectSpent(p), 0);
  const heatLine = hi.inSeason ? `Heating season: day ${hi.day} of ${hi.total}, ${hi.left} days left` : `Heating season starts in ${hi.until} days`;
  const nextUp = (needs.length ? needs : soon).slice(0, 3);
  const taskRow = ({ t, st }) => h('div', { class: 'item ' + (st.state === 'over' ? 'over' : st.state === 'due' ? 'due' : '') },
    h('div', { class: 'row spread' }, h('span', { class: 'title', style: 'cursor:pointer', onclick: () => showTask(t) }, t.title), dueChip(st)),
    h('div', { class: 'row' }, btn('Mark done', () => { t.done.push(todayISO()); save(); toast('Logged'); rerender(); }, 'small primary'), btn('Details', () => showTask(t), 'small')));

  wrap.append(h('section', { class: 'panel hero' },
    h('div', { class: 'wheel-wrap' }, yearWheel({ today: new Date(), selected: null, onMonth: m => go('maintain', { maintain: 'year', month: m }) })),
    h('div', { class: 'hero-info' },
      h('div', { class: 'eyebrow' }, 'TODAY · ' + fmtDate(todayISO()).toUpperCase()),
      h('h1', null, heatLine),
      h('p', { class: 'muted' }, needs.length ? `${needs.length} task${needs.length === 1 ? '' : 's'} need doing now.` : 'Nothing is overdue. Next up:'),
      h('div', { class: 'list' }, nextUp.map(x => h('div', { class: 'row spread mini-row' }, h('span', { style: 'cursor:pointer', onclick: () => showTask(x.t) }, x.t.title), dueChip(x.st)))),
      h('div', { class: 'row', style: 'margin-top:6px' }, btn('Radiator rounds', startRounds, 'primary'), btn('New project', () => editProjectMeta(null)), btn('Shutoffs', openEmergency, 'emerg')),
      h('div', { class: 'legend' }, legendDot('bad', 'overdue'), legendDot('warn', 'due'), legendDot('acc', 'next 30 days'), legendDot('idle', 'later'), legendDot('heat', 'heating season')))));

  wrap.append(panel(null, null, h('div', { class: 'grid' },
    h('div', { class: 'stat' }, h('b', null, needs.length), h('span', null, 'Tasks due now')),
    h('div', { class: 'stat' }, h('b', null, open.length), h('span', null, 'Open projects')),
    h('div', { class: 'stat' }, h('b', null, money(est) || '$0.00'), h('span', null, 'Materials to buy')),
    h('div', { class: 'stat' }, h('b', null, money(spent) || '$0.00'), h('span', null, 'Spent so far')))));

  const cols = h('div', { class: 'cols' });
  cols.append(panel('Needs doing', null, needs.length ? h('div', { class: 'list' }, needs.map(taskRow)) : empty('Nothing due.')),
    panel('Next 30 days', null, soon.length ? h('div', { class: 'list' }, soon.slice(0, 8).map(taskRow)) : empty('No tasks in the next 30 days.')));
  wrap.append(cols);

  const rc = { good: 0, warn: 0, bad: 0, unk: 0 }; S.house.radiators.forEach(r => rc[radStatus(r)]++);
  wrap.append(panel('Radiators', h('div', { class: 'row' }, btn('Rounds', startRounds, 'small primary'), btn('Steam map', () => go('house', { houseSub: 'steam' }), 'small')),
    S.house.radiators.length ? h('div', { class: 'row' }, chip(`${rc.good} good`, 'good'), chip(`${rc.warn} need re-pitch`, 'warn'), chip(`${rc.bad} with issues`, 'bad'), chip(`${rc.unk} unchecked this year`))
      : empty('No radiators recorded. Add them on the House tab, then run rounds.')));

  wrap.append(panel('Money', btn('Projects', () => go('projects', { projects: 'flow', pid: null }), 'small'), h('div', { class: 'tablewrap' }, budgetChart())));

  const ends = [];
  S.house.warranties.forEach(w => w.end && ends.push({ name: w.item, end: w.end }));
  S.house.appliances.forEach(a => a.warrantyEnd && ends.push({ name: a.name + ' warranty', end: a.warrantyEnd }));
  const soonEnds = ends.map(e => ({ ...e, d: daysBetween(todayISO(), e.end) })).filter(e => e.d <= 90).sort((a, b) => a.d - b.d);
  if (soonEnds.length) wrap.append(panel('Warranties ending soon', null, h('div', { class: 'list' }, soonEnds.map(e => h('div', { class: 'item' }, h('div', { class: 'row spread' }, h('span', { class: 'title' }, e.name), chip(e.d < 0 ? 'Expired' : `${e.d} days`, e.d < 0 ? 'bad' : 'warn')))))));
  wrap.append(panel('Open projects', btn('All projects', () => go('projects', { projects: 'list', pid: null }), 'small'),
    open.length ? h('div', { class: 'list' }, open.slice(0, 5).map(p => projectCard(p))) : empty('No open projects. Add one in Projects.')));
  return wrap;
}

/* ================= HOUSE TAB ================= */
function viewHouse() {
  const sub = route.houseSub;
  const tabs = tabBar([['map', 'Map'], ['steam', 'Steam'], ['records', 'Records'], ['tools', 'Tools']], sub, k => { route.houseSub = k; render(); });
  const body = sub === 'map' ? viewMap() : sub === 'steam' ? viewSteam() : sub === 'records' ? viewRecords() : viewToolsList();
  return h('div', { class: 'list' }, tabs, body);
}

function viewMap() {
  const levels = S.settings.levels;
  if (route.level === null) route.level = levels.find(n => levelKind(n) === 'floor') || levels[0];
  const pick = n => { route.level = n; render(); };
  const legend = h('div', { class: 'legend' }, TYPES.map(([k, l, c]) => legendDot(c, l)));
  const cut = h('div', { class: 'diagram-wrap' }, houseCutaway({ selected: route.level, onPick: pick }));
  const lvl = route.level, items = itemsAtLevel(lvl);
  const total = TYPES.reduce((s, [k]) => s + items[k].length, 0);
  const unplaced = TYPES.reduce((s, [k]) => s + itemsAtLevel('')[k].length, 0);
  const addKinds = [['shutoffs', 'Shutoff'], ['systems', 'System'], ['radiators', 'Radiator'], ['appliances', 'Appliance'], ['paint', 'Paint']];
  const row = (k, it) => {
    const c = COLLECTIONS[k];
    return h('button', { type: 'button', class: 'res', onclick: () => editRecord(k, it) }, h('span', { class: 'kind' }, c.single), h('span', { class: 'rt' }, it[c.title] || '(untitled)'), h('span', { class: 'muted rs' }, c.sub.filter(f => f !== 'level').map(f => it[f]).filter(Boolean).join(' · ')));
  };
  const side = panel(lvl === '' ? 'No level set' : lvl, lvl === '' ? null : h('span', { class: 'muted mono' }, `${total} item${total === 1 ? '' : 's'}`),
    total ? h('div', { class: 'list' }, TYPES.map(([k, l]) => items[k].length ? h('div', { class: 'list' }, h('h3', null, l),
      k === 'projects' ? items[k].map(p => h('button', { type: 'button', class: 'res', onclick: () => go('projects', { projects: 'detail', pid: p.id }) }, h('span', { class: 'kind' }, 'project'), h('span', { class: 'rt' }, p.name), h('span', { class: 'muted rs' }, p.status))) : items[k].map(it => row(k, it))) : null))
      : empty('Nothing recorded here yet.'),
    lvl !== '' ? h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'muted' }, 'Add here:'), addKinds.map(([k, l]) => btn(l, () => editRecord(k, null, { level: lvl }), 'small'))) : null);
  return h('div', { class: 'list' },
    h('div', { class: 'split' }, panel('Cutaway', unplaced ? btn(`${unplaced} without a level`, () => pick(''), 'small') : null, legend, cut, h('p', { class: 'muted', style: 'font-size:12px;margin-top:8px' }, 'Tap a floor. Dots show how many shutoffs, systems, radiators, appliances, paint entries and open projects are on it. Rename levels in More.')), side));
}

function viewSteam() {
  if (route.steamOn === null) route.steamOn = heatInfo().inSeason;
  const rads = S.house.radiators;
  const rc = { good: 0, warn: 0, bad: 0, unk: 0 }; rads.forEach(r => rc[radStatus(r)]++);
  const dia = steamDiagram({ animate: route.steamOn, onPick: r => editRecord('radiators', r) });
  const heatTasks = S.tasks.filter(t => /radiator|boiler|vent|water level|pressure|cutoff|water hammer/i.test(t.title)).map(t => ({ t, st: taskStatus(t) })).sort((a, b) => (a.st.date || '').localeCompare(b.st.date || '')).slice(0, 6);
  const table = rads.length ? h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Radiator', 'Level', 'Vent', 'Pitch', 'Checked', 'Status'].map(x => h('th', null, x)))),
    h('tbody', null, rads.slice().sort((a, b) => S.settings.levels.indexOf(a.level) - S.settings.levels.indexOf(b.level) || a.room.localeCompare(b.room)).map(r => {
      const st = radStatus(r), age = r.ventInstalled ? Math.floor(daysBetween(r.ventInstalled, todayISO()) / 365) : null;
      return h('tr', { class: 'click', onclick: () => editRecord('radiators', r) }, h('td', null, r.room), h('td', null, r.level || '—'), h('td', null, [r.ventModel, age != null && `${age}y old`].filter(Boolean).join(', ') || '—'),
        h('td', null, r.pitch || 'Unknown'), h('td', null, r.lastChecked ? fmtDate(r.lastChecked) : 'never'), h('td', null, chip(statusShort(r), st === 'good' ? 'good' : st === 'bad' ? 'bad' : st === 'warn' ? 'warn' : '')));
    })))) : empty('No radiators yet. Tap Add radiator and give it a room and level.');
  return h('div', { class: 'list' },
    panel('One-pipe steam', h('div', { class: 'row' }, btn(route.steamOn ? 'Steam on' : 'Steam off', () => { route.steamOn = !route.steamOn; render(); }, 'small' + (route.steamOn ? ' primary' : '')), btn('Rounds', startRounds, 'small primary'), btn('Add radiator', () => editRecord('radiators', null, { level: S.settings.levels.find(n => levelKind(n) === 'floor') || '' }), 'small')),
      h('div', { class: 'legend' }, legendDot('good', 'pitched and checked'), legendDot('warn', 'needs re-pitch'), legendDot('bad', 'issue reported'), legendDot('unk', 'not checked this year')),
      h('div', { class: 'diagram-wrap' }, dia),
      h('p', { class: 'muted', style: 'font-size:12px;margin-top:8px' }, 'Schematic only. Pipes are drawn from the boiler up through each level; radiators connect to the nearest riser. Tap a radiator to edit it. "Steam on" just animates the pipes.'),
      dia.unplaced && dia.unplaced.length ? h('div', { class: 'banner' }, `${dia.unplaced.length} radiator${dia.unplaced.length === 1 ? ' has' : 's have'} no matching level: ${dia.unplaced.map(r => r.room).join(', ')}. Set a level to place ${dia.unplaced.length === 1 ? 'it' : 'them'} on the diagram.`) : null),
    h('div', { class: 'cols' },
      panel('Status', null, h('div', { class: 'row' }, chip(`${rc.good} good`, 'good'), chip(`${rc.warn} re-pitch`, 'warn'), chip(`${rc.bad} issues`, 'bad'), chip(`${rc.unk} unchecked`)), table),
      panel('Heating tasks', null, h('div', { class: 'list' }, heatTasks.map(({ t, st }) => h('div', { class: 'item' }, h('div', { class: 'row spread' }, h('span', { class: 'title', style: 'cursor:pointer', onclick: () => showTask(t) }, t.title), dueChip(st))))))));
}

function viewRecords() {
  const key = route.house, c = COLLECTIONS[key];
  const tabs = tabBar(Object.entries(COLLECTIONS).map(([k, v]) => [k, v.label]), key, k => { route.house = k; render(); });
  const list = S.house[key];
  const sorted = key === 'log' ? list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')) : list;
  const card = item => {
    const kv = h('dl', { class: 'kv' });
    c.fields.filter(f => f.k !== c.title && f.type !== 'photos' && item[f.k] != null && item[f.k] !== '').forEach(f => kv.append(h('dt', null, f.label), h('dd', null, f.type === 'date' ? fmtDate(item[f.k]) : f.type === 'number' ? money(item[f.k]) : item[f.k])));
    let extra = null;
    const end = item.end || item.warrantyEnd;
    if (end) { const d = daysBetween(todayISO(), end); extra = chip(d < 0 ? 'Expired' : d <= 90 ? `Ends in ${d}d` : 'Active', d < 0 ? 'bad' : d <= 90 ? 'warn' : 'good'); }
    if (key === 'log' && item.status) extra = chip(item.status, item.status === 'Done' ? 'good' : item.status === 'Unknown' ? '' : 'acc');
    if (key === 'radiators') { const s = radStatus(item); extra = chip(statusWord(s), s === 'good' ? 'good' : s === 'bad' ? 'bad' : s === 'warn' ? 'warn' : ''); }
    return h('div', { class: 'item' }, h('div', { class: 'row spread' }, h('span', { class: 'title' }, (item[c.title] || '(untitled)')), extra), thumbStrip(item.photos), kv, h('div', { class: 'row' }, btn('Edit', () => editRecord(key, item), 'small')));
  };
  return h('div', { class: 'list' }, tabs, panel(c.label, btn('Add', () => editRecord(key, null), 'primary small'),
    sorted.length ? h('div', { class: 'list' }, sorted.map(card)) : empty(`No ${c.label.toLowerCase()} yet. Tap Add.`)));
}

function viewToolsList() {
  const by = {}; S.tools.forEach(t => (by[t.category || 'Other'] = by[t.category || 'Other'] || []).push(t));
  const toolCard = t => h('div', { class: 'item' },
    h('div', { class: 'row spread' }, h('span', { class: 'title' }, t.name), chip(t.status === 'want' ? 'Want' : 'Own', t.status === 'want' ? 'warn' : 'good')),
    t.notes ? h('span', { class: 'muted' }, t.notes) : null, t.pic ? h('img', { src: t.pic, class: 'thumb', alt: '', referrerpolicy: 'no-referrer' }) : null, thumbStrip(t.photos), h('div', null, btn('Edit', () => editTool(t), 'small')));
  return panel('Tool inventory', h('span', { class: 'row' }, btn('Find a tool', () => findTool(), 'primary small'), btn('Add tool', () => editTool(null), 'small'), btn('Import list', importList, 'small')),
    h('p', { class: 'muted' }, 'Projects check their tool lists against this. Mark a tool "want" to keep it on a wish list without counting it as owned.'),
    S.tools.length ? h('div', { class: 'list' }, Object.keys(by).sort().map(c => h('div', { class: 'list' }, h('h3', null, c), by[c].map(toolCard)))) : empty('No tools yet.'));
}

/* ================= UPKEEP: year view ================= */
function viewYear() {
  const m = route.month == null ? new Date().getMonth() : route.month;
  const ts = tasksInMonth(m).map(t => ({ t, st: taskStatus(t) })).sort((a, b) => a.t.start.slice(8).localeCompare(b.t.start.slice(8)));
  return h('div', { class: 'list' },
    h('section', { class: 'panel hero' }, h('div', { class: 'wheel-wrap' }, yearWheel({ today: new Date(), selected: m, onMonth: k => { route.month = k; render(); } })),
      h('div', { class: 'hero-info' }, h('div', { class: 'eyebrow' }, 'YEAR AT A GLANCE'), h('h1', null, MONTH_FULL[m]),
        h('p', { class: 'muted' }, 'Tap a month or a dot. The copper arc is heating season; the needle is today.'),
        h('div', { class: 'legend' }, legendDot('bad', 'overdue'), legendDot('warn', 'due'), legendDot('acc', 'next 30 days'), legendDot('idle', 'later'), legendDot('heat', 'heating season')))),
    panel(`${MONTH_FULL[m]}: ${ts.length} task${ts.length === 1 ? '' : 's'}`, null, ts.length ? h('div', { class: 'list' }, ts.map(x => taskCard(x.t))) : empty('Nothing scheduled this month.')));
}

/* ================= PROJECTS: flow tab ================= */
function viewFlow() {
  return h('div', { class: 'list' },
    panel('Dependency flow', null, h('p', { class: 'muted' }, 'Left to right is the order to work in. An arrow means "has to happen before". Tap a project to open it.'),
      h('div', { class: 'diagram-wrap' }, flowGraph({ onOpen: p => go('projects', { projects: 'detail', pid: p.id }) })),
      h('div', { class: 'legend' }, legendDot('pr-Safety', 'safety'), legendDot('pr-Damage', 'damage'), legendDot('pr-Comfort', 'comfort'), legendDot('pr-Cosmetic', 'cosmetic'))),
    panel('Budget', null, h('div', { class: 'diagram-wrap' }, budgetChart())),
    viewPlan());
}

/* ================= MORE: extra settings ================= */
function houseSetupPanels() {
  const s = S.settings;
  const txt = (id, label, get, set, ph) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, value: get(), placeholder: ph || '', onchange: e => { set(e.target.value.trim()); save(); toast('Saved'); } }));
  return [
    panel('House setup', null, h('div', { class: 'form' },
      txt('s_levels', 'Levels, top to bottom (comma separated)', () => s.levels.join(', '), v => { const a = v.split(',').map(x => x.trim()).filter(Boolean); if (a.length) s.levels = a; }, 'Attic, 2nd floor, 1st floor, Basement, Exterior'),
      txt('s_hf', 'Heating season starts (MM-DD)', () => s.heatFrom, v => { if (/^\d\d-\d\d$/.test(v)) s.heatFrom = v; }, '11-01'),
      txt('s_ht', 'Heating season ends (MM-DD)', () => s.heatTo, v => { if (/^\d\d-\d\d$/.test(v)) s.heatTo = v; }, '04-30')),
      h('p', { class: 'muted', style: 'margin-top:8px;font-size:12px' }, 'Names containing "attic", "basement" or "cellar", and "exterior" or "yard", get special shapes in the cutaway.')),
    panel('Emergency numbers', null, h('div', { class: 'form' }, [['gas', 'Gas utility emergency'], ['electric', 'Electric utility'], ['water', 'Water department'], ['heating', 'Heating tech'], ['plumber', 'Plumber'], ['electrician', 'Electrician']].map(([k, l]) => txt('s_em_' + k, l, () => s.emergency[k] || '', v => { s.emergency[k] = v; }, '617-555-0100'))),
      h('p', { class: 'muted', style: 'margin-top:8px;font-size:12px' }, 'Shown on the Shutoffs sheet. Stored only on this device.')),
  ];
}
