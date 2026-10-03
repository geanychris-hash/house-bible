/* Exports: ICS, Tasker CSV, Obsidian markdown bundle, JSON backup. */
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const enc = new TextEncoder(); const out = []; let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur); return out.join('\r\n');
}
function ruleToRRULE(r) {
  if (r.type === 'yearly') return 'FREQ=YEARLY';
  if (r.type === 'monthly') return `FREQ=MONTHLY;INTERVAL=${r.interval || 1}`;
  const [fm] = r.from.split('-').map(Number), [tm] = r.to.split('-').map(Number);
  const months = []; for (let m = fm; ; m = m % 12 + 1) { months.push(m); if (m === tm) break; if (months.length > 12) break; }
  return `FREQ=WEEKLY;BYMONTH=${months.join(',')}`;
}
function makeICS() {
  const hhmm = (S.settings.reminderTime || '09:00').replace(':', '');
  const endm = (() => { const [a, b] = (S.settings.reminderTime || '09:00').split(':').map(Number); const t = a * 60 + b + 30; return pad(Math.floor(t / 60) % 24) + pad(t % 60); })();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//House Bible//Maintenance//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:House Maintenance'];
  S.tasks.forEach(t => {
    let start = t.start;
    if (t.rule.type === 'weekly') { const o = occurrences(t, t.start, iso(addDays(parseISO(t.start), 800))); if (o.length) start = o[0]; }
    const d = start.replace(/-/g, '');
    let desc = `WHY: ${t.why}\nHOW: ${t.how}\nTIME: ${t.time}\nTOOLS: ${t.tools}`; if (t.safety) desc += `\nSAFETY: ${t.safety}`;
    L.push('BEGIN:VEVENT', `UID:${t.id}@house-bible`, `DTSTAMP:${stamp}`, `DTSTART:${d}T${hhmm}00`, `DTEND:${d}T${endm}00`,
      `RRULE:${ruleToRRULE(t.rule)}`, `SUMMARY:${icsEsc(t.title)}`, `DESCRIPTION:${icsEsc(desc)}`, `CATEGORIES:${icsEsc(t.season)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t.title)}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
function makeTaskerCSV() {
  const rows = [['id', 'next_date', 'time', 'repeat', 'season', 'title', 'short_body']];
  S.tasks.forEach(t => {
    const st = taskStatus(t);
    rows.push([t.id, st.date || t.start, S.settings.reminderTime, ruleText(t.rule), t.season, t.title, (t.how || '').split('. ')[0].replace(/\.$/, '') + '.']);
  });
  return toCSV(rows);
}
function makeCostCSV() {
  const rows = [['date', 'project', 'item', 'store', 'type', 'amount']];
  S.projects.forEach(p => (p.purchases || []).forEach(x => rows.push([x.date, p.name, x.item, x.store, x.type, x.amount])));
  return toCSV(rows);
}

/* ---------- markdown ---------- */
const mdTable = (head, rows) => rows.length ? ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + r.map(c => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ') + ' |')].join('\n') : '_none yet_';
const fm = (type) => `---\ntype: ${type}\nupdated: ${todayISO()}\nsource: House Bible app\n---\n`;

function mdCollection(key, intro) {
  const c = COLLECTIONS[key];
  const list = S.house[key].filter(x => !x.example);
  const cols = c.fields;
  let body = mdTable(cols.map(f => f.label), list.map(x => cols.map(f => f.type === 'photos' ? (x[f.k] || []).map(i => `![[Attachments/${i}.jpg]]`).join(' ') : f.type === 'date' ? x[f.k] : (x[f.k] ?? ''))));
  return `${fm('house-' + key)}# ${c.label}\n\nBack to [[House-Bible]].${intro ? '\n\n' + intro : ''}\n\n${body}\n`;
}
function mdLog() {
  const list = S.house.log.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const out = list.map(x => `## ${x.date || 'date unknown'} — ${x.title}\n- Status: ${x.status}\n- Area: ${x.area || ''}\n- Who: ${x.who || ''}\n- Cost: ${x.cost != null ? money(x.cost) : ''}\n- Notes: ${x.notes || ''}\n`);
  return `${fm('house-project-log')}# Project Log\n\nBack to [[House-Bible]]. Newest first.\n\n${out.join('\n')}`;
}
function mdTools() {
  const by = {};
  S.tools.filter(t => !t.example).forEach(t => (by[t.category || 'Other'] = by[t.category || 'Other'] || []).push(t));
  const sections = Object.keys(by).sort().map(k => `## ${k}\n${by[k].map(t => `- [${t.status === 'want' ? ' ' : 'x'}] ${t.name}${t.notes ? ' — ' + t.notes : ''}${(t.photos || []).map(i => ` ![[Attachments/${i}.jpg]]`).join('')}`).join('\n')}`);
  return `${fm('tool-inventory')}# Tool Inventory\n\nBack to [[House-Bible]]. Checked = owned, unchecked = want.\n\n${sections.join('\n\n') || '_none yet_'}\n`;
}
function mdSeasonal() {
  const parts = SEASONS.map(s => {
    const ts = S.tasks.filter(t => t.season === s).sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));
    if (!ts.length) return '';
    return `## ${s}\n\n` + ts.map(t => `### ${t.title}\n- Repeats: ${ruleText(t.rule)} (first ${t.start})\n- Time: ${t.time}\n- Tools: ${t.tools || 'none'}\n- Why: ${t.why}\n- How: ${t.how}\n${t.safety ? '- Safety: ' + t.safety + '\n' : ''}- Done: ${(t.done || []).join(', ') || 'never logged'}\n`).join('\n');
  });
  return `${fm('seasonal-maintenance')}# Seasonal Maintenance\n\nBack to [[House-Bible]]. General guidance for an old Massachusetts house with one-pipe steam heat. Follow equipment manuals; use licensed pros for gas, flue, and suspect asbestos.\n\n${parts.join('\n')}`;
}
function mdProject(p) {
  const cp = cutPlan(p, S.settings);
  const lines = [`${fm('project')}# ${p.name}`, '',
    `Back to [[Project-Pile]]. Status: **${p.status}** · Priority: ${p.priority} · ${p.pro} · Season: ${p.season}`,
    `Budget: ${money(p.budget) || 'n/a'} · Estimated materials: ${money(projectEstimate(p))} · Spent: ${money(projectSpent(p))}`,
    p.deps?.length ? `Depends on: ${p.deps.map(id => findProject(id)?.name).filter(Boolean).map(n => `[[${n}]]`).join(', ')}` : 'Depends on: nothing', '',
    p.notes ? p.notes + '\n' : '', '## Steps', ...(p.steps || []).map(s => `- [${s.d ? 'x' : ' '}] ${s.t}`), '',
    '## Materials', mdTable(['Item', 'Qty', 'Unit', 'Home Depot', 'Harbor Freight', 'Other', 'Best', 'Have'],
      (p.materials || []).map(m => { const b = bestPrice(m); return [m.item, m.qty, m.unit, money(m.hd), money(m.hf), money(m.other), b ? `${b.store} ${money(b.price)}` : '', m.have ? 'yes' : '']; })), '',
    '## Tools', ...(p.tools || []).map(t => `- [${ownsTool(t) ? 'x' : ' '}] ${t}${ownsTool(t) ? ' (own)' : ' (need)'}`), '',
    '## Cut list', mdTable(['Part', 'Qty', 'Thick', 'Width', 'Length', 'Material', 'Type'], (p.parts || []).map(x => [x.name, x.qty, x.t, x.w, x.l, x.material, x.kind])), ''];
  cp.forEach(g => {
    if (g.kind === 'sheet') {
      lines.push(`### ${g.material}: ${g.count} sheet(s) of ${S.settings.sheetW}" x ${S.settings.sheetL}"`);
      g.sheets.forEach((s, i) => lines.push(`- Sheet ${i + 1} (${Math.round(s.util * 100)}% used): ` + s.rows.flatMap(r => r.items).map(x => `${x.name} ${fmtIn(x.a)}x${fmtIn(x.b)}`).join(', ')));
    } else {
      lines.push(`### ${g.material}: ${g.count} board(s) of ${S.settings.boardL}"`);
      g.boards.forEach((b, i) => lines.push(`- Board ${i + 1}: ` + b.items.map(x => `${x.name} ${fmtIn(x.len)}`).join(' + ') + ` (left ${fmtIn(b.left)})`));
    }
    g.problems.forEach(pr => lines.push(`- PROBLEM: ${pr}`));
  });
  lines.push('', '## Purchases', mdTable(['Date', 'Item', 'Store', 'Type', 'Amount'], (p.purchases || []).map(x => [x.date, x.item, x.store, x.type, money(x.amount)])));
  return lines.join('\n') + '\n';
}
function mdProjectPile() {
  const rows = S.projects.filter(p => !p.example).map(p => [`[[${p.name}]]`, p.status, p.priority, p.pro, p.season, money(p.budget), (p.deps || []).map(id => findProject(id)?.name).filter(Boolean).join(', ')]);
  return `${fm('project-pile')}# Project Pile\n\nBack to [[House-Bible]].\n\n${mdTable(['Project', 'Status', 'Priority', 'DIY/Pro', 'Season', 'Budget', 'Depends on'], rows)}\n`;
}
function mdSequenced() {
  const real = S.projects.filter(p => !p.example);
  const { phases, cyclic } = sequence(real);
  let out = `${fm('sequenced-plan')}# Sequenced Plan\n\nBack to [[House-Bible]]. Order: dependencies first, then Safety, Damage, Comfort, Cosmetic, then season.\n\n`;
  phases.forEach((ps, i) => { out += `## Phase ${i + 1}\n` + ps.map(p => `- [[${p.name}]] — ${p.priority}, ${p.pro}, ${p.season}${p.deps?.length ? ', after ' + p.deps.map(d => findProject(d)?.name).filter(Boolean).join(' + ') : ''}`).join('\n') + '\n\n'; });
  if (cyclic.length) out += `## Circular dependencies (fix these)\n${cyclic.map(p => '- ' + p.name).join('\n')}\n\n`;
  const sh = shopping(real);
  out += '## Shopping list\n';
  Object.keys(sh.byStore).sort().forEach(store => {
    out += `\n### ${store}\n` + mdTable(['Item', 'Qty', 'Unit price', 'Line', 'Project'], sh.byStore[store].map(r => [r.item, r.qty, r.best ? money(r.best.price) : '', r.best ? money(r.total) : '', r.project])) + '\n';
  });
  out += `\nEstimated total: ${money(sh.total)}\n\n## Tools\n` + mdTable(['Tool', 'Status', 'Used in'], toolCheck(real).map(t => [t.name, t.own ? 'own' : 'need', t.projects.join(', ')])) + '\n';
  return out;
}
function mdHub() {
  return `${fm('house-hub')}# House Bible\n\nCanton, MA. Old house, one-pipe steam heat. Generated from the House Bible app on ${todayISO()}.\n\n- [[Shutoffs]] · [[Systems]] · [[Radiators]] · [[Appliances]] · [[Paint-Colors]] · [[Warranties]]\n- [[Project-Log]]\n- [[Tool-Inventory]]\n- [[Seasonal-Maintenance]] (calendar file: house-maintenance.ics)\n- [[Project-Pile]] · [[Sequenced-Plan]]\n- Cost data: Cost-Tracker.csv\n`;
}
function mdReadme() {
  return `${fm('readme')}# House Bible export\n\nThis folder was exported from the House Bible app. Copy it into your Obsidian vault.\n\n| File | What |\n|---|---|\n| House-Bible.md | Hub |\n| Shutoffs, Systems, Radiators, Appliances, Paint-Colors, Warranties | Reference notes |\n| Project-Log.md | Dated log of work |\n| Tool-Inventory.md | Tools owned and wanted |\n| Seasonal-Maintenance.md | Year-round tasks with why/how/time/tools |\n| house-maintenance.ics | Import into your calendar |\n| tasker-reminders.csv | Reminder list for Tasker |\n| Project-Pile.md, Sequenced-Plan.md, Projects/*.md | Projects, order, materials, cut lists, cart lists |\n| Cost-Tracker.csv | Purchases (opens in any spreadsheet) |\n| house-bible-backup.json | Full app data; import it in the app to restore |\n\nFor the agent-facing description see CLAUDE-REFERENCE.md.\n`;
}
function mdClaudeRef() {
  return `${fm('claude-reference')}# House Bible export: Claude reference\n\nAudience: Claude (Cowork or Claude Code with vault access). Chris lives in Canton, MA in an old house with one-pipe steam heat. Facts below are what he entered in the app; blank means unknown, never guess.\n\n## Files\n- House-Bible.md hub; Shutoffs/Systems/Appliances/Paint-Colors/Warranties tables.\n- Project-Log.md newest first. Entries with unknown dates are listed as 'date unknown'.\n- Tool-Inventory.md: [x] own, [ ] want. Check it before recommending tool purchases.\n- Seasonal-Maintenance.md generated from app tasks; recurrence rules: yearly, every N months, or weekly within a date window. house-maintenance.ics is the calendar form.\n- Project-Pile.md, Sequenced-Plan.md, Projects/*.md: dependency-ordered plan (dependencies, then Safety > Damage > Comfort > Cosmetic, then season), materials with Home Depot / Harbor Freight / Other prices entered by Chris, best price = lowest entered, tool own/need status, cut lists (sheet layouts on ${S.settings.sheetW}x${S.settings.sheetL} stock, boards of ${S.settings.boardL}", kerf ${S.settings.kerf}").\n- Cost-Tracker.csv: date, project, item, store, type, amount.\n- house-bible-backup.json: full state (import into the app to restore; do not hand-edit ids).\n\n## Notes\n- Prices are manual entries and may be stale; there is no live price lookup in the app.\n- The app has search links to Home Depot and Harbor Freight per material; it does not scrape prices.\n- Maintenance text is general guidance. Gas, flue, and suspect asbestos work is for licensed pros.\n- House age: ${S.settings.houseAge || 'not recorded'}.\n`;
}
/* photos live in IndexedDB; this adds them to the zip as Attachments/<id>.jpg (embedded in the notes with ![[...]]) */
async function buildBundleWithPhotos() {
  const files = buildBundle(), ids = new Set();
  Object.keys(COLLECTIONS).forEach(k => S.house[k].filter(x => !x.example).forEach(x => (x.photos || []).forEach(i => ids.add(i))));
  S.tools.filter(x => !x.example).forEach(x => (x.photos || []).forEach(i => ids.add(i)));
  (S.inbox || []).forEach(x => ids.add(x.photo));
  for (const id of ids) { const b = await photoGet(id); if (b) files.push({ name: `House-Bible/Attachments/${id}.jpg`, bytes: new Uint8Array(await b.arrayBuffer()) }); }
  return files;
}
function buildBundle() {
  const files = [
    { name: 'House-Bible/README.md', content: mdReadme() },
    { name: 'House-Bible/CLAUDE-REFERENCE.md', content: mdClaudeRef() },
    { name: 'House-Bible/House-Bible.md', content: mdHub() },
    { name: 'House-Bible/Shutoffs.md', content: mdCollection('shutoffs') },
    { name: 'House-Bible/Systems.md', content: mdCollection('systems') },
    { name: 'House-Bible/Radiators.md', content: mdCollection('radiators') },
    { name: 'House-Bible/Appliances.md', content: mdCollection('appliances') },
    { name: 'House-Bible/Paint-Colors.md', content: mdCollection('paint') },
    { name: 'House-Bible/Warranties.md', content: mdCollection('warranties') },
    { name: 'House-Bible/Project-Log.md', content: mdLog() },
    { name: 'House-Bible/Tool-Inventory.md', content: mdTools() },
    { name: 'House-Bible/Seasonal-Maintenance.md', content: mdSeasonal() },
    { name: 'House-Bible/house-maintenance.ics', content: makeICS() },
    { name: 'House-Bible/tasker-reminders.csv', content: makeTaskerCSV() },
    { name: 'House-Bible/Project-Pile.md', content: mdProjectPile() },
    { name: 'House-Bible/Sequenced-Plan.md', content: mdSequenced() },
    { name: 'House-Bible/Cost-Tracker.csv', content: makeCostCSV() },
    { name: 'House-Bible/house-bible-backup.json', content: JSON.stringify(S, null, 1) },
  ];
  S.projects.filter(p => !p.example).forEach(p => files.push({ name: `House-Bible/Projects/${p.name.replace(/[\\/:*?"<>|]/g, '-')}.md`, content: mdProject(p) }));
  return files;
}
