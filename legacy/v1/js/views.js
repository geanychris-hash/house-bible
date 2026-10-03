/* Screens. Rendering is plain DOM; state lives in S (store.js). */
const panel = (title, actions, ...kids) => h('section', { class: 'panel' },
  (title || actions) ? h('header', null, title ? h('h2', null, title) : h('span'), actions ? h('div', { class: 'row' }, actions) : null) : null, ...kids);
const btn = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, type: 'button', onclick: fn }, label);
const empty = msg => h('p', { class: 'muted' }, msg);
const chip = (t, cls = '') => h('span', { class: 'chip ' + cls }, t);
const tabBar = (items, current, onPick) => h('div', { class: 'tabs', role: 'tablist' }, items.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(k === current), onclick: () => onPick(k) }, l)));

function dueChip(st) {
  if (st.state === 'over') return chip(`Overdue ${-st.days}d`, 'bad');
  if (st.state === 'due') return chip(st.days === 0 ? 'Due today' : `Due since ${fmtDate(st.date)}`, 'warn');
  if (st.state === 'upcoming') return chip(st.days <= 30 ? `In ${st.days}d · ${fmtDate(st.date)}` : fmtDate(st.date), st.days <= 30 ? 'acc' : '');
  return chip('No date');
}

/* ================= MAINTENANCE ================= */
function taskFields() {
  return [
    { k: 'title', label: 'Task', wide: true }, { k: 'season', label: 'Season', type: 'select', options: SEASONS },
    { k: 'ruleType', label: 'Repeats', type: 'select', options: ['yearly', 'monthly', 'weekly'] },
    { k: 'interval', label: 'Every N months (monthly)', type: 'number' },
    { k: 'from', label: 'Weekly window start (MM-DD)', placeholder: '11-01' }, { k: 'to', label: 'Weekly window end (MM-DD)', placeholder: '04-30' },
    { k: 'start', label: 'First due date', type: 'date' }, { k: 'time', label: 'Time needed' }, { k: 'tools', label: 'Tools' },
    { k: 'why', label: 'Why', type: 'textarea' }, { k: 'how', label: 'How', type: 'textarea' }, { k: 'safety', label: 'Safety note', type: 'textarea' }];
}
function editTask(t) {
  const isNew = !t;
  const vals = t ? { ...t, ruleType: t.rule.type, interval: t.rule.interval, from: t.rule.from, to: t.rule.to } : { season: 'Year-round', ruleType: 'yearly', start: todayISO(), from: '11-01', to: '04-30', interval: 6 };
  openForm({ title: isNew ? 'Add task' : 'Edit task', fields: taskFields(), values: vals,
    onSave: v => {
      if (!v.title) { toast('Give the task a name'); return false; }
      const rule = v.ruleType === 'weekly' ? { type: 'weekly', from: v.from || '11-01', to: v.to || '04-30' } : v.ruleType === 'monthly' ? { type: 'monthly', interval: v.interval || 6 } : { type: 'yearly' };
      const data = { title: v.title, season: v.season, rule, start: v.start || todayISO(), time: v.time, tools: v.tools, why: v.why, how: v.how, safety: v.safety };
      if (isNew) S.tasks.push({ id: 'c-' + uid(), done: [], custom: true, ...data }); else Object.assign(t, data);
      save(); rerender();
    },
    onDelete: t ? () => { S.tasks = S.tasks.filter(x => x !== t); save(); rerender(); } : null });
}
function taskCard(t) {
  const st = taskStatus(t);
  const last = (t.done || []).slice().sort().pop();
  return h('details', { class: 'card' },
    h('summary', null, h('span', { class: 'row spread', style: 'display:inline-flex;width:calc(100% - 20px);vertical-align:top' }, h('span', null, t.title), dueChip(st))),
    h('div', { class: 'list', style: 'margin-top:10px' },
      h('dl', { class: 'kv' }, h('dt', null, 'Repeats'), h('dd', null, ruleText(t.rule)), h('dt', null, 'Time'), h('dd', null, t.time || ''), h('dt', null, 'Tools'), h('dd', null, t.tools || 'none'),
        h('dt', null, 'Why'), h('dd', null, t.why), h('dt', null, 'How'), h('dd', null, t.how), t.safety ? h('dt', null, 'Safety') : null, t.safety ? h('dd', null, t.safety) : null,
        h('dt', null, 'Last done'), h('dd', null, last ? fmtDate(last) : 'never logged')),
      h('div', { class: 'row' },
        btn('Mark done today', () => { t.done.push(todayISO()); save(); toast('Logged'); rerender(); }, 'small primary'),
        last ? btn('Undo last', () => { t.done.sort(); t.done.pop(); save(); rerender(); }, 'small') : null,
        btn('Edit', () => editTask(t), 'small'))));
}
function viewMaintain() {
  const mode = route.maintain;
  const tabs = tabBar([['year', 'Year'], ['attention', 'Needs attention'], ['season', 'By season'], ['calendar', 'Calendar']], mode, k => { route.maintain = k; render(); });
  let body;
  if (mode === 'year') {
    body = viewYear();
  } else if (mode === 'attention') {
    const all = S.tasks.map(t => ({ t, st: taskStatus(t) }));
    const now = all.filter(x => x.st.state === 'due' || x.st.state === 'over').sort((a, b) => a.st.date.localeCompare(b.st.date));
    const nxt = all.filter(x => x.st.state === 'upcoming').sort((a, b) => a.st.date.localeCompare(b.st.date)).slice(0, 10);
    body = h('div', { class: 'list' },
      panel('Due now', null, now.length ? h('div', { class: 'list' }, now.map(x => taskCard(x.t))) : empty('Nothing due right now.')),
      panel('Coming up', null, h('div', { class: 'list' }, nxt.map(x => taskCard(x.t)))));
  } else if (mode === 'season') {
    body = h('div', { class: 'list' }, SEASONS.map(s => { const ts = S.tasks.filter(t => t.season === s); return ts.length ? panel(s, null, h('div', { class: 'list' }, ts.sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5))).map(taskCard))) : null; }));
  } else {
    body = panel('Calendar and reminders', null, h('div', { class: 'list' },
      h('p', null, 'Import the calendar file into Google Calendar or any calendar app. Every task repeats on its own and shows why, how, time and tools in the notes.'),
      h('div', { class: 'row' }, btn('Download .ics', () => download('house-maintenance.ics', makeICS(), 'text/calendar'), 'primary'), btn('Copy .ics text', () => copyText(makeICS()))),
      h('p', { class: 'muted' }, 'Tasker list: first due date and repeat rule per task, one per line.'),
      h('div', { class: 'row' }, btn('Download Tasker CSV', () => download('tasker-reminders.csv', makeTaskerCSV(), 'text/csv')), btn('Copy CSV', () => copyText(makeTaskerCSV()))),
      h('p', { class: 'muted' }, 'Reminder time is set in More > Settings. The app does not send notifications itself; your calendar or Tasker does.')));
  }
  return h('div', { class: 'list' }, tabs, panel(null, null, h('div', { class: 'row spread' }, h('span', { class: 'muted' }, `${S.tasks.length} tasks · old house, one-pipe steam`), btn('Add task', () => editTask(null), 'small'))), body);
}

/* ================= PROJECTS ================= */
function projectCard(p) {
  const est = projectEstimate(p), spent = projectSpent(p), b = Number(p.budget) || 0;
  const done = (p.steps || []).filter(s => s.d).length, total = (p.steps || []).length;
  const pct = b ? Math.min(100, (spent / b) * 100) : 0;
  return h('div', { class: 'item', style: 'cursor:pointer', onclick: () => go('projects', { projects: 'detail', pid: p.id }), tabindex: '0', onkeydown: e => { if (e.key === 'Enter') go('projects', { projects: 'detail', pid: p.id }); } },
    h('div', { class: 'row spread' }, h('span', { class: 'title' }, p.name), chip(p.status, p.status === 'Done' ? 'good' : p.status === 'In progress' ? 'acc' : '')),
    h('div', { class: 'row' }, chip(p.priority, p.priority === 'Safety' ? 'bad' : p.priority === 'Damage' ? 'warn' : ''), chip(p.pro), chip(p.season),
      total ? chip(`${done}/${total} steps`) : null, (p.deps || []).length ? chip(`after ${(p.deps || []).length}`) : null),
    b ? h('div', null, h('div', { class: 'bar' + (spent > b ? ' over' : '') }, h('i', { style: `width:${pct}%` })),
      h('span', { class: 'muted mono' }, `${money(spent)} spent of ${money(b)} budget · est. ${money(est)} to buy`)) : null);
}
function editProjectMeta(p) {
  const isNew = !p;
  const others = S.projects.filter(x => x !== p);
  const chosen = new Set(p ? p.deps : []);
  openModal(isNew ? 'New project' : 'Edit project', close => {
    const f = {}; const mk = (k, label, el, wide) => { f[k] = el; return h('div', { class: 'field' + (wide ? ' wide' : '') }, h('label', { for: 'p_' + k }, label), el); };
    const sel = (id, opts, v) => h('select', { id: 'p_' + id, value: v }, opts.map(o => h('option', { value: o }, o)));
    const dep = h('div', { class: 'list' }, others.length ? others.map(o => h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: chosen.has(o.id) ? true : null, onchange: e => e.target.checked ? chosen.add(o.id) : chosen.delete(o.id) }), o.name)) : h('span', { class: 'muted' }, 'No other projects yet.'));
    const form = h('div', { class: 'form' },
      mk('name', 'Project name', h('input', { id: 'p_name', value: p?.name || '', placeholder: 'Re-pitch radiators' }), true),
      mk('status', 'Status', sel('status', STATUSES, p?.status || 'Idea')), mk('priority', 'Priority', sel('priority', PRIORITIES, p?.priority || 'Comfort')),
      mk('pro', 'Who does it', sel('pro', ['DIY', 'Pro', 'DIY + Pro'], p?.pro || 'DIY')), mk('season', 'Best season', sel('season', SEASONS, p?.season || 'Year-round')),
      mk('level', 'Where in the house', sel('level', [''].concat(S.settings.levels), p?.level || '')),
      mk('budget', 'Budget ($)', h('input', { id: 'p_budget', type: 'number', step: 'any', value: p?.budget ?? '' })),
      h('div', { class: 'field wide' }, h('label', null, 'Must happen first (dependencies)'), dep),
      mk('notes', 'Notes', h('textarea', { id: 'p_notes', rows: 3, value: p?.notes || '' }), true));
    const save_ = () => {
      const name = f.name.value.trim(); if (!name) { toast('Name the project'); return; }
      const v = { name, status: f.status.value, priority: f.priority.value, pro: f.pro.value, season: f.season.value, budget: f.budget.value === '' ? null : Number(f.budget.value), level: f.level.value, notes: f.notes.value, deps: [...chosen], example: false };
      if (isNew) { const np = { id: uid(), steps: [], materials: [], tools: [], parts: [], purchases: [], ...v }; S.projects.push(np); save(); close(); go('projects', { projects: 'detail', pid: np.id }); }
      else { Object.assign(p, v); save(); close(); rerender(); }
    };
    return h('div', { class: 'list' }, form, h('div', { class: 'row spread' },
      p ? confirmBtn('Delete project', () => { S.projects = S.projects.filter(x => x !== p); S.projects.forEach(x => x.deps = x.deps.filter(d => d !== p.id)); save(); close(); go('projects', { projects: 'list', pid: null }); }, 'btn danger') : h('span'),
      h('div', { class: 'row' }, btn('Cancel', close), btn('Save', save_, 'primary'))));
  });
}

function viewProjects() {
  const tabs = tabBar([['list', 'Projects'], ['flow', 'Flow'], ['shop', 'Shopping'], ['tools', 'Tool check']], route.projects === 'detail' ? 'list' : route.projects, k => { route.projects = k; route.pid = null; render(); });
  if (route.projects === 'detail') { const p = findProject(route.pid); if (p) return h('div', { class: 'list' }, tabs, projectDetail(p)); route.projects = 'list'; }
  if (route.projects === 'flow') return h('div', { class: 'list' }, tabs, viewFlow());
  if (route.projects === 'shop') return h('div', { class: 'list' }, tabs, viewShopping());
  if (route.projects === 'tools') return h('div', { class: 'list' }, tabs, viewToolCheck());
  const sorted = S.projects.slice().sort((a, b) => (a.status === 'Done') - (b.status === 'Done') || (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9));
  return h('div', { class: 'list' }, tabs, panel('Project pile', btn('New project', () => editProjectMeta(null), 'primary small'),
    sorted.length ? h('div', { class: 'list' }, sorted.map(projectCard)) : empty('Nothing here yet. Add every project you are thinking about, then use Order to sequence them.')));
}

function viewPlan() {
  const { phases, cyclic } = sequence(S.projects);
  const kids = [];
  if (cyclic.length) kids.push(h('div', { class: 'banner', style: 'border-color:var(--bad)' }, 'Circular dependency: ' + cyclic.map(p => p.name).join(', ') + '. Edit the projects so they do not wait on each other.'));
  if (!phases.length) kids.push(empty('No open projects to order.'));
  phases.forEach((ps, i) => kids.push(panel(`Phase ${i + 1}`, null, h('div', { class: 'list' }, ps.map(p => {
    const after = (p.deps || []).map(findProject).filter(x => x && x.status !== 'Done');
    return h('div', null, projectCard(p), after.length ? h('div', { class: 'muted', style: 'font-size:13px;padding:2px 4px' }, 'After: ' + after.map(a => a.name).join(', ')) : null);
  })))));
  return h('div', { class: 'list' }, h('div', { class: 'banner' }, 'Order rule: a project waits for everything it depends on. Within a phase the order is Safety, Damage, Comfort, Cosmetic, then best season. Finished projects drop out.'), kids);
}

function viewShopping() {
  const sh = shopping(S.projects);
  const order = STORES.concat(['No price yet']);
  const text = () => Object.keys(sh.byStore).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(st => st + '\n' + sh.byStore[st].map(r => `- ${r.item} x${r.qty}${r.best ? ' @ ' + money(r.best.price) : ''}`).join('\n')).join('\n\n') + `\n\nEstimated total: ${money(sh.total)}`;
  const kids = [h('div', { class: 'banner' }, 'Best price is the lowest you entered for each material. Prices are manual; tap Search to check the store, then type what you find into the material row.')];
  if (!sh.rows.length) kids.push(empty('No materials to buy. Add materials inside a project.'));
  Object.keys(sh.byStore).sort((a, b) => order.indexOf(a) - order.indexOf(b)).forEach(store => {
    const rows = sh.byStore[store];
    kids.push(panel(store, chip(money(rows.reduce((s, r) => s + r.total, 0)) || '$0.00', 'acc'), h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Item', 'Qty', 'Each', 'Line', 'Project', ''].map((x, i) => h('th', { class: i > 0 && i < 4 ? 'num' : '' }, x)))),
      h('tbody', null, rows.map(r => h('tr', null, h('td', null, r.item), h('td', { class: 'num' }, r.qty + (r.unit ? ' ' + r.unit : '')), h('td', { class: 'num' }, r.best ? money(r.best.price) : '—'), h('td', { class: 'num' }, r.best ? money(r.total) : '—'), h('td', { class: 'muted' }, r.project),
        h('td', null, h('a', { href: searchURL(store === 'Harbor Freight' ? 'Harbor Freight' : 'Home Depot', r.item), target: '_blank', rel: 'noopener' }, 'Search')))))))));
  });
  kids.push(panel('Estimated total', btn('Copy list', () => copyText(text()), 'small'), h('div', { class: 'stat' }, h('b', null, money(sh.total) || '$0.00'), h('span', null, 'Materials not marked as owned'))));
  return h('div', { class: 'list' }, kids);
}

function viewToolCheck() {
  const tc = toolCheck(S.projects);
  return panel('Tool check', null, tc.length ? h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Tool', 'Status', 'Needed for'].map(x => h('th', null, x)))),
    h('tbody', null, tc.map(t => h('tr', null, h('td', null, t.name), h('td', null, chip(t.own ? 'Own' : 'Need', t.own ? 'good' : 'warn')), h('td', { class: 'muted' }, t.projects.join(', '))))))) : empty('Add tools to a project and they will be checked against your inventory here.'),
    h('p', { class: 'muted', style: 'margin-top:8px' }, 'Matching is by name. "Drill" matches "Cordless drill/driver". Add what you own under Tools.'));
}

/* ---------- project detail ---------- */
function inp(val, onchange, opts = {}) {
  return h('input', { value: val ?? '', type: opts.type || 'text', step: opts.type === 'number' ? 'any' : null, class: opts.cls || '', placeholder: opts.ph || '', inputmode: opts.type === 'number' ? 'decimal' : null, 'aria-label': opts.label || null,
    onchange: e => { onchange(opts.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value); save(); } });
}
function projectDetail(p) {
  const root = h('div', { class: 'list' });
  root.append(panel(null, null,
    h('div', { class: 'row spread' }, btn('‹ All projects', () => go('projects', { projects: 'list', pid: null }), 'small'), btn('Edit details', () => editProjectMeta(p), 'small')),
    projectCard(p), p.notes ? h('p', { class: 'muted', style: 'margin-top:8px' }, p.notes) : null));
  root.append(stepsSection(p), materialsSection(p), toolsSection(p), cutSection(p), purchasesSection(p));
  return root;
}
function stepsSection(p) {
  const box = h('div', { class: 'steps' });
  const draw = () => {
    box.replaceChildren(...p.steps.map((s, i) => {
      const span = h('span', { class: s.d ? 'done-text' : '', style: 'flex:1' }, s.t);
      return h('label', null,
        h('input', { type: 'checkbox', checked: s.d ? true : null, onchange: e => { s.d = e.target.checked; span.className = s.d ? 'done-text' : ''; save(); } }),
        span,
        h('button', { class: 'btn small', type: 'button', 'aria-label': 'Remove step', onclick: e => { e.preventDefault(); p.steps.splice(i, 1); save(); draw(); } }, '\u00d7'));
    }));
    if (!p.steps.length) box.append(empty('No steps yet. Add the outline of the job.'));
  };
  draw();
  const add = h('input', { id: 'newstep', placeholder: 'Add a step, press Enter', style: 'flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)', onkeydown: e => { if (e.key === 'Enter' && e.target.value.trim()) { p.steps.push({ t: e.target.value.trim(), d: false }); save(); e.target.value = ''; draw(); } } });
  return panel('Steps', null, box, h('div', { class: 'row', style: 'margin-top:8px' }, add));
}
function materialsSection(p) {
  const body = h('tbody'), foot = h('div', { class: 'row spread', style: 'margin-top:8px' });
  const links = m => { const q = encodeURIComponent(m.item || ''); return [h('a', { href: searchURL('Home Depot', m.item || ''), target: '_blank', rel: 'noopener' }, 'HD'), ' · ', h('a', { href: searchURL('Harbor Freight', m.item || ''), target: '_blank', rel: 'noopener' }, 'HF')]; };
  const totals = () => { foot.replaceChildren(h('span', { class: 'muted' }, 'Lowest price per item; items marked "have" are excluded.'), h('strong', { class: 'mono' }, 'Estimate ' + (money(projectEstimate(p)) || '$0.00'))); };
  const row = m => {
    const bestCell = h('td', { class: 'mono' }), linkCell = h('td');
    const upd = () => { const b = bestPrice(m); bestCell.textContent = b ? `${b.store === 'Home Depot' ? 'HD' : b.store === 'Harbor Freight' ? 'HF' : 'Other'} ${money(b.price * (Number(m.qty) || 1))}` : '—'; linkCell.replaceChildren(...links(m)); totals(); };
    upd();
    return h('tr', null,
      h('td', null, inp(m.item, v => { m.item = v; upd(); }, { label: 'Item' })), h('td', null, inp(m.qty, v => { m.qty = v; upd(); }, { type: 'number', cls: 'n', label: 'Qty' })),
      h('td', null, inp(m.unit, v => m.unit = v, { label: 'Unit', ph: 'ea' })),
      h('td', null, inp(m.hd, v => { m.hd = v; upd(); }, { type: 'number', cls: 'n', label: 'Home Depot price' })), h('td', null, inp(m.hf, v => { m.hf = v; upd(); }, { type: 'number', cls: 'n', label: 'Harbor Freight price' })), h('td', null, inp(m.other, v => { m.other = v; upd(); }, { type: 'number', cls: 'n', label: 'Other price' })),
      bestCell, h('td', null, h('input', { type: 'checkbox', 'aria-label': 'Already have', checked: m.have ? true : null, onchange: e => { m.have = e.target.checked; save(); totals(); } })), linkCell,
      h('td', null, h('button', { class: 'btn small', type: 'button', 'aria-label': 'Remove material', onclick: () => { p.materials = p.materials.filter(x => x !== m); save(); draw(); } }, '×')));
  };
  const draw = () => { body.replaceChildren(...p.materials.map(row)); totals(); };
  draw();
  return panel('Materials', btn('Add material', () => { p.materials.push({ id: uid(), item: '', qty: 1, unit: '', hd: null, hf: null, other: null, have: false }); save(); draw(); const last = body.lastChild?.querySelector('input'); last && last.focus(); }, 'small primary'),
    h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Item', 'Qty', 'Unit', 'Home Depot $', 'Harbor Fr. $', 'Other $', 'Best', 'Have', 'Search', ''].map((x, i) => h('th', { class: i >= 3 && i <= 5 ? 'num' : '' }, x)))), body)), foot);
}
function toolsSection(p) {
  const box = h('div', { class: 'row' });
  const draw = () => {
    box.replaceChildren(...(p.tools || []).map((t, i) => h('span', { class: 'chip ' + (ownsTool(t) ? 'good' : 'warn') }, `${t} · ${ownsTool(t) ? 'own' : 'need'} `, h('button', { type: 'button', 'aria-label': 'Remove ' + t, style: 'border:0;background:none;cursor:pointer;color:inherit', onclick: () => { p.tools.splice(i, 1); save(); draw(); } }, '×'))));
    if (!p.tools.length) box.append(empty('No tools listed.'));
  };
  draw();
  const add = h('input', { id: 'newtool', placeholder: 'Add a tool, press Enter', style: 'flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)', onkeydown: e => { if (e.key === 'Enter' && e.target.value.trim()) { p.tools.push(e.target.value.trim()); save(); e.target.value = ''; draw(); } } });
  return panel('Tools needed', null, box, h('div', { class: 'row', style: 'margin-top:8px' }, add));
}
function cutSection(p) {
  const tbody = h('tbody'), out = h('div', { class: 'list' });
  const plan = () => {
    const cp = cutPlan(p, S.settings); out.replaceChildren();
    if (!cp.length) { out.append(empty('Add parts to see a layout. Sizes accept 34, 34.5, 3/4 or 1 1/2.')); return; }
    cp.forEach(g => {
      const head = g.kind === 'sheet' ? `${g.material}: ${g.count} sheet${g.count === 1 ? '' : 's'} (${S.settings.sheetW}" x ${S.settings.sheetL}")` : `${g.material}: ${g.count} board${g.count === 1 ? '' : 's'} (${S.settings.boardL}" stock)`;
      const card = h('div', { class: 'list' }, h('h3', null, head));
      g.problems.forEach(pr => card.append(h('div', { class: 'banner', style: 'border-color:var(--bad)' }, pr)));
      if (g.kind === 'sheet') g.sheets.forEach((s, i) => card.append(h('div', { class: 'sheet' }, h('div', { class: 'muted mono' }, `Sheet ${i + 1} · ${Math.round(s.util * 100)}% used`), sheetSVG(s, S.settings.sheetW, S.settings.sheetL, i + 1))));
      else g.boards.forEach((b, i) => card.append(h('div', { class: 'item' }, h('span', { class: 'mono' }, `Board ${i + 1}: ` + b.items.map(x => `${x.name} ${fmtIn(x.len)}`).join(' + ') + `  (left over ${fmtIn(b.left)})`))));
      out.append(card);
    });
  };
  const row = x => h('tr', null,
    h('td', null, inp(x.name, v => { x.name = v; plan(); }, { label: 'Part' })), h('td', null, inp(x.material, v => { x.material = v; plan(); }, { label: 'Material', ph: '3/4" plywood' })),
    h('td', null, h('select', { 'aria-label': 'Type', value: x.kind, onchange: e => { x.kind = e.target.value; save(); plan(); } }, h('option', { value: 'sheet' }, 'Sheet'), h('option', { value: 'board' }, 'Board'))),
    h('td', null, inp(x.qty, v => { x.qty = v || 1; plan(); }, { type: 'number', cls: 'n', label: 'Qty' })),
    h('td', null, inp(x.t, v => x.t = v, { cls: 'n', label: 'Thickness' })), h('td', null, inp(x.w, v => { x.w = v; plan(); }, { cls: 'n', label: 'Width' })), h('td', null, inp(x.l, v => { x.l = v; plan(); }, { cls: 'n', label: 'Length' })),
    h('td', null, h('button', { class: 'btn small', type: 'button', 'aria-label': 'Remove part', onclick: () => { p.parts = p.parts.filter(y => y !== x); save(); draw(); } }, '×')));
  const draw = () => { tbody.replaceChildren(...p.parts.map(row)); plan(); };
  draw();
  return panel('Cut list and layout', btn('Add part', () => { const last = p.parts[p.parts.length - 1]; p.parts.push({ id: uid(), name: '', material: last ? last.material : '', kind: last ? last.kind : 'sheet', qty: 1, t: last ? last.t : '', w: '', l: '' }); save(); draw(); }, 'small primary'),
    h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Part', 'Material', 'Type', 'Qty', 'Thick', 'Width', 'Length', ''].map(x => h('th', null, x)))), tbody)),
    h('p', { class: 'muted', style: 'margin:8px 0' }, `Inches. Sheet size ${S.settings.sheetW}" x ${S.settings.sheetL}", board stock ${S.settings.boardL}", saw kerf ${S.settings.kerf}" (change in More). Parts may rotate; check grain direction yourself.`), out);
}
function purchasesSection(p) {
  const body = h('tbody'), foot = h('div', { class: 'row spread', style: 'margin-top:8px' });
  const totals = () => { const b = Number(p.budget) || 0, s = projectSpent(p); foot.replaceChildren(h('span', { class: 'muted' }, b ? `Budget ${money(b)} · ${s > b ? 'over by ' + money(s - b) : money(b - s) + ' left'}` : 'No budget set'), h('strong', { class: 'mono' }, 'Spent ' + (money(s) || '$0.00'))); };
  const row = x => h('tr', null, h('td', null, inp(x.date, v => x.date = v, { type: 'date', label: 'Date' })), h('td', null, inp(x.item, v => x.item = v, { label: 'Item' })),
    h('td', null, h('select', { 'aria-label': 'Store', value: x.store, onchange: e => { x.store = e.target.value; save(); } }, STORES.map(s => h('option', { value: s }, s)))),
    h('td', null, h('select', { 'aria-label': 'Type', value: x.type, onchange: e => { x.type = e.target.value; save(); } }, ['Material', 'Tool', 'Labor', 'Permit', 'Other'].map(s => h('option', { value: s }, s)))),
    h('td', null, inp(x.amount, v => { x.amount = v; totals(); }, { type: 'number', cls: 'n', label: 'Amount' })),
    h('td', null, h('button', { class: 'btn small', type: 'button', 'aria-label': 'Remove purchase', onclick: () => { p.purchases = p.purchases.filter(y => y !== x); save(); draw(); } }, '×')));
  const draw = () => { body.replaceChildren(...p.purchases.map(row)); totals(); };
  draw();
  return panel('Purchases', btn('Add purchase', () => { p.purchases.push({ id: uid(), date: todayISO(), item: '', store: 'Home Depot', type: 'Material', amount: null }); save(); draw(); }, 'small primary'),
    h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Date', 'Item', 'Store', 'Type', 'Amount', ''].map((x, i) => h('th', { class: i === 4 ? 'num' : '' }, x)))), body)), foot);
}

/* ================= MORE ================= */
function viewMore() {
  const s = S.settings;
  const setF = (id, label, k, type = 'number', w) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, type, step: 'any', value: s[k] ?? '', onchange: e => { s[k] = type === 'number' ? Number(e.target.value) || 0 : e.target.value; save(); toast('Saved'); } }));
  const theme = (() => { try { return localStorage.getItem('hb.theme') || 'auto'; } catch (e) { return 'auto'; } })();
  const setTheme = v => { try { localStorage.setItem('hb.theme', v); } catch (e) { } applyTheme(); rerender(); };
  const files = buildBundle();
  const fileRow = f => h('div', { class: 'row spread item' }, h('span', { class: 'mono', style: 'overflow-wrap:anywhere' }, f.name.replace('House-Bible/', '')), h('span', { class: 'row' },
    btn('Copy', () => copyText(f.content), 'small'), btn('Download', () => download(f.name.split('/').pop(), f.content, f.name.endsWith('.ics') ? 'text/calendar' : f.name.endsWith('.json') ? 'application/json' : f.name.endsWith('.csv') ? 'text/csv' : 'text/markdown'), 'small')));
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', id: 'importfile', style: 'display:none', onchange: e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d.house || !d.projects) throw new Error('not a House Bible backup'); S = d; migrate(); save(); toast('Backup restored'); go('home'); } catch (err) { toast('Could not read that file: ' + err.message); } };
    r.readAsText(f); } });
  return h('div', { class: 'list' },
    saveErr ? h('div', { class: 'banner', style: 'border-color:var(--bad)' }, 'This browser is not keeping data between visits. Use Download all, and restore later with Import.') : null,
    panel('Export to Obsidian', null, h('p', null, 'One zip with Markdown notes for every section, the calendar file, a Tasker list, a cost CSV, a full JSON backup, a Claude reference file, and your photos (in an Attachments folder, embedded in the notes). Unzip into your vault.'),
      h('div', { class: 'row' }, btn('Download all (.zip)', async () => download('House-Bible-export-' + todayISO() + '.zip', makeZip(await buildBundleWithPhotos()), 'application/zip'), 'primary'), btn('Copy backup JSON', () => copyText(JSON.stringify(S)))),
      h('details', { class: 'card', style: 'margin-top:10px' }, h('summary', null, `Individual files (${files.length})`), h('div', { class: 'list', style: 'margin-top:8px' }, files.map(fileRow)))),
    panel('Backup and restore', null, h('div', { class: 'row' }, btn('Import backup (.json)', () => fileInput.click()), fileInput, btn('Download backup', () => download('house-bible-backup.json', JSON.stringify(S, null, 1), 'application/json'))),
      h('p', { class: 'muted', style: 'margin-top:8px' }, 'Data stays in this browser or installed app. Photos are kept separately on this device; the .json backup does not contain them, the zip export does.')),
    panel('Settings', null, h('div', { class: 'form' }, setF('s_time', 'Reminder time', 'reminderTime', 'time'), setF('s_sw', 'Sheet width (in)', 'sheetW'), setF('s_sl', 'Sheet length (in)', 'sheetL'), setF('s_bl', 'Board stock length (in)', 'boardL'), setF('s_k', 'Saw kerf (in)', 'kerf'), setF('s_age', 'House built (year)', 'houseAge', 'text')),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'muted' }, 'Theme'), ['auto', 'light', 'dark'].map(t => btn(t[0].toUpperCase() + t.slice(1), () => setTheme(t), 'small' + (theme === t ? ' primary' : ''))))),
    panel('Setup guide', null, h('p', null, 'The three-session plan for filling in the house, plus the photo inbox.'), btn('Open Setup Sprint', () => go('setup'), 'primary')),
    houseSetupPanels(),
    panel('Install as an app', null, h('p', null, 'Android (Chrome): menu > Install app or Add to Home screen. Desktop (Chrome or Edge): install icon in the address bar. It then opens in its own window and works offline.')),
    panel('Clean up', null, h('div', { class: 'row' }, btn('Remove examples', () => { removeExamples(); toast('Examples removed'); go('home'); }), confirmBtn('Erase everything', () => { resetAll(false); toast('Erased'); go('home'); }, 'btn danger'))));
}

/* ================= shell ================= */
function applyTheme() {
  let t = 'auto'; try { t = localStorage.getItem('hb.theme') || 'auto'; } catch (e) { }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
