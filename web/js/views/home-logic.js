// Pure logic for the Home screen (no DOM, no network). Tested by home-logic.test.mjs.
// Dates are 'YYYY-MM-DD' strings; `today` is always passed in.
const DAY = 86400000;
const ms = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY);
const valid = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || ''));
const live = rows => (rows || []).filter(r => !Number(r.deleted));
const has = (s, re) => re.test(String(s || ''));

/** Items whose date is past or within `withinDays` days. Sorted soonest first. */
export function expiring({ assets, documents }, today, withinDays = 60) {
  const out = [];
  for (const a of live(assets)) {
    if (valid(a.warranty_expires)) out.push({ kind: 'warranty', id: a.id, title: a.name, date: a.warranty_expires.slice(0, 10), table: 'assets' });
  }
  for (const d of live(documents)) {
    if (valid(d.expires)) out.push({ kind: d.kind === 'insurance' ? 'insurance' : 'document', id: d.id, title: d.title, date: d.expires.slice(0, 10), table: 'documents' });
  }
  return out.map(x => ({ ...x, days: daysBetween(today, x.date) })).filter(x => x.days <= withinDays).sort((a, b) => a.days - b.days);
}

/** The setup checklist: each step says whether the data already has it. */
export function setupChecklist({ assets, shutoffs, rooms, documents, house }) {
  const A = live(assets), S = live(shutoffs), R = live(rooms), D = live(documents);
  const hasShutoff = t => S.some(s => s.type === t);
  const hasAsset = re => A.some(a => has(a.name, re) || has(a.kind, re));
  return [
    { id: 'house', label: 'House facts (year built, size, floors)', hint: 'Settings. Zillow and Redfin could not be read automatically.', done: Boolean(house && (house.year_built || house.sqft)), to: 'settings' },
    { id: 'boiler', label: 'Boiler: make, model, serial', hint: 'Look at the data plate. Add it as a system.', done: hasAsset(/boiler/i), to: 'assets' },
    { id: 'waterheater', label: 'Water heater', hint: 'Add make, model and install year.', done: hasAsset(/water heater/i), to: 'assets' },
    { id: 'shutoffs', label: 'Shutoffs: water, gas, electric', hint: 'Walk the house once. Take a photo of each.', done: hasShutoff('water') && hasShutoff('gas') && hasShutoff('electric'), to: 'shutoffs' },
    { id: 'panel', label: 'Electric panel', hint: 'Photo of the panel and its labels. Panel work is a licensed pro job.', done: hasShutoff('electric') || hasAsset(/panel/i), to: 'shutoffs' },
    { id: 'rooms', label: 'Rooms (at least 3)', hint: 'Name, size, flooring, wall color.', done: R.filter(r => !has(r.name, /^paint:/i)).length >= 3, to: 'rooms' },
    { id: 'appliances', label: 'Appliances', hint: 'Brand, model, serial from the sticker.', done: A.some(a => a.kind === 'appliance'), to: 'assets' },
    { id: 'paint', label: 'Paint colors', hint: 'Brand, color name, sheen, per room.', done: R.some(r => r.wall_color || (r.paint_notes && !has(r.name, /^paint:/i))), to: 'rooms' },
    { id: 'warranties', label: 'Warranties', hint: 'Add an expiry date on each asset that has one.', done: A.some(a => valid(a.warranty_expires)), to: 'assets' },
    { id: 'documents', label: 'Documents to scan', hint: 'Closing papers, inspection report, manuals, permits.', done: D.length >= 3, to: 'documents' },
  ];
}

export function progress(items) {
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round(done / items.length * 100) : 0 };
}

/** Latest steam log entry by date+time. */
export function lastSteam(rows) {
  const r = live(rows).filter(x => valid(x.date)).sort((a, b) => (String(b.date) + (b.time || '')).localeCompare(String(a.date) + (a.time || '')));
  return r[0] || null;
}

/** One line about weather alerts from settings.alerts / settings.notify (the server sends them; this only reports setup). */
export function alertLine(alerts, notify) {
  const rules = (alerts && Array.isArray(alerts.rules)) ? alerts.rules : [];
  const on = rules.filter(r => r.enabled === true || Number(r.enabled) === 1);
  const emails = (notify && Array.isArray(notify.emails)) ? notify.emails.filter(Boolean) : [];
  if (!rules.length) return { level: 'warn', text: 'Weather alerts are not set up yet.' };
  if (!on.length) return { level: 'warn', text: 'Weather alerts: all rules are off.' };
  if (!emails.length) return { level: 'warn', text: `Weather alerts: ${on.length} rule${on.length === 1 ? '' : 's'} on, but no email address to send to.` };
  return { level: 'good', text: `Weather alerts on: ${on.map(r => r.label || r.id).join(', ')}. Checked daily at 4 pm.` };
}

export function activeProjects(projects) {
  const order = { Safety: 0, Damage: 1, Comfort: 2, Cosmetic: 3 };
  return live(projects).filter(p => p.status === 'active').sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || String(a.name).localeCompare(String(b.name)));
}

export const parseJson = (v, fallback) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch { return fallback; } };
