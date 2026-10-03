// Pure project, materials, expense, utility and report logic (no DOM, no network).
// Owned by S5. Ported from legacy/v1/js/plan.js and rebuilt on the v2 tables.

export const PRIORITIES = ['Safety', 'Damage', 'Comfort', 'Cosmetic'];
export const STATUSES = ['idea', 'planned', 'active', 'done', 'dropped'];
export const SEASONS = ['Fall', 'Heating season', 'Winter', 'Spring', 'Summer', 'Year-round'];
export const STORES = ['Home Depot', 'Harbor Freight', 'Other'];
export const EXPENSE_CATEGORIES = ['Materials', 'Tools', 'Labor', 'Permit', 'Appliance', 'Utilities', 'Other'];
export const UTILITY_KINDS = ['gas', 'oil', 'electric', 'water', 'other'];

const PRIO = { Safety: 0, Damage: 1, Comfort: 2, Cosmetic: 3 };
const SEASON_ORDER = { Fall: 0, 'Heating season': 1, Winter: 2, Spring: 3, Summer: 4, 'Year-round': 5 };

/* ---------- value helpers (rows from the sheet may carry strings) ---------- */
export const isOn = v => v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE';
export const toNum = v => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
export const num0 = v => toNum(v) ?? 0;
export function parseJson(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { const x = JSON.parse(v); return x ?? fallback; } catch { return fallback; }
}
export const projectDeps = p => { const d = parseJson(p.deps, []); return Array.isArray(d) ? [...new Set(d.filter(x => typeof x === 'string' && x))] : []; };
export const projectSteps = p => { const s = parseJson(p.steps, []); return Array.isArray(s) ? s.filter(x => x && typeof x === 'object').map(x => ({ t: String(x.t ?? ''), d: isOn(x.d) })) : []; };
/* The contract has no "tools needed" column. Tools live in `parts` as {"tools":[...]} (cut list is cut). */
export const projectTools = p => { const x = parseJson(p.parts, null); const t = x && !Array.isArray(x) ? x.tools : null; return Array.isArray(t) ? t.map(s => String(s).trim()).filter(Boolean) : []; };
export const withTools = (p, tools) => { const x = parseJson(p.parts, null); const base = x && !Array.isArray(x) ? x : {}; return JSON.stringify({ ...base, tools }); };
export const isOpen = p => p.status !== 'done' && p.status !== 'dropped';

/* ---------- prices ---------- */
/* Lowest entered price. Returns {store, price, all} or null. */
export function bestPrice(m) {
  const opts = [['Home Depot', m.price_hd], ['Harbor Freight', m.price_hf], ['Other', m.price_other]]
    .map(([s, p]) => [s, toNum(p)]).filter(([, p]) => p != null && p > 0);
  if (!opts.length) return null;
  opts.sort((a, b) => a[1] - b[1]);
  return { store: opts[0][0], price: opts[0][1], all: opts };
}
const qtyOf = m => { const q = toNum(m.qty); return q == null || q <= 0 ? 1 : q; };
export const lineTotal = m => { const b = bestPrice(m); return b ? b.price * qtyOf(m) : 0; };
/* Estimate excludes items already owned. */
export const materialsEstimate = mats => mats.filter(m => !isOn(m.have)).reduce((s, m) => s + lineTotal(m), 0);
export const projectSpent = (projectId, expenses) => expenses.filter(e => e.project === projectId).reduce((s, e) => s + num0(e.amount), 0);

/* ---------- sequencing (Kahn) ---------- */
const byPriority = (a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9)
  || (SEASON_ORDER[a.season] ?? 9) - (SEASON_ORDER[b.season] ?? 9)
  || String(a.name || '').localeCompare(String(b.name || ''));

/* Phases of open projects by dependency. Deps on done, dropped, deleted or unknown projects are ignored.
   Returns { phases: [[project]], cycles: [[project]], blocked: [project] }
   cycles: each circular chain found. blocked: projects that wait on a cycle but are not in one. */
export function sequence(projects) {
  const open = projects.filter(isOpen);
  const byId = new Map(open.map(p => [p.id, p]));
  const deps = new Map(open.map(p => [p.id, projectDeps(p).filter(d => byId.has(d))]));
  const remaining = new Set(byId.keys());
  const phases = [];
  while (remaining.size) {
    const ready = [...remaining].filter(id => deps.get(id).every(d => !remaining.has(d)));
    if (!ready.length) break;
    phases.push(ready.map(id => byId.get(id)).sort(byPriority));
    ready.forEach(id => remaining.delete(id));
  }
  // Whatever is left is in a cycle or waits on one. Find the cycles by walking dependencies.
  const cycles = [], inCycle = new Set();
  const state = new Map(); // 1 visiting, 2 done
  const stack = [];
  const visit = id => {
    state.set(id, 1); stack.push(id);
    for (const d of deps.get(id)) {
      if (!remaining.has(d)) continue;
      if (state.get(d) === 1) {
        const cyc = stack.slice(stack.indexOf(d));
        if (!cyc.some(x => inCycle.has(x))) { cycles.push(cyc.map(x => byId.get(x))); }
        cyc.forEach(x => inCycle.add(x));
      } else if (!state.has(d)) visit(d);
    }
    stack.pop(); state.set(id, 2);
  };
  [...remaining].sort().forEach(id => { if (!state.has(id)) visit(id); });
  const blocked = [...remaining].filter(id => !inCycle.has(id)).map(id => byId.get(id)).sort(byPriority);
  return { phases, cycles, blocked };
}

/* ---------- shopping ---------- */
export function shopping(projects, materials) {
  const open = new Map(projects.filter(isOpen).map(p => [p.id, p]));
  const rows = [];
  materials.filter(m => open.has(m.project) && !isOn(m.have)).forEach(m => {
    const best = bestPrice(m);
    rows.push({ project: open.get(m.project).name, projectId: m.project, item: m.item, qty: qtyOf(m), unit: m.unit, best, total: best ? best.price * qtyOf(m) : 0, m });
  });
  const byStore = {};
  rows.forEach(r => { const s = r.best ? r.best.store : 'No price yet'; (byStore[s] = byStore[s] || []).push(r); });
  return { rows, byStore, total: rows.reduce((s, r) => s + r.total, 0) };
}
export const searchURL = (store, q) => store === 'Harbor Freight'
  ? 'https://www.harborfreight.com/catalogsearch/result/?q=' + encodeURIComponent(q)
  : 'https://www.homedepot.com/s/' + encodeURIComponent(q);

/* ---------- tool check ---------- */
const cleanName = s => String(s || '').toLowerCase().replace(/\(example\)/g, '').trim();
/* Own = an inventory row with status own whose name matches (equal, or one contains the other). */
export function ownsTool(name, tools) {
  const n = cleanName(name);
  if (!n) return false;
  return tools.some(t => {
    if (t.status === 'want') return false;
    const x = cleanName(t.name);
    return x && (x === n || x.includes(n) || n.includes(x));
  });
}
export function toolCheck(projects, tools) {
  const map = new Map();
  projects.filter(isOpen).forEach(p => projectTools(p).forEach(t => {
    const k = t.toLowerCase();
    const e = map.get(k) || { name: t, projects: [] };
    e.projects.push(p.name); map.set(k, e);
  }));
  return [...map.values()].map(e => ({ ...e, own: ownsTool(e.name, tools) })).sort((a, b) => a.own - b.own || a.name.localeCompare(b.name));
}
/* Dedupe an import against the existing inventory (same name and model, case-insensitive). */
export function planToolImport(existing, rows) {
  const key = t => cleanName(t.name) + '|' + cleanName(t.model);
  const seen = new Set(existing.map(key));
  const toAdd = [], skipped = [];
  for (const r of rows) {
    if (!r || !String(r.name || '').trim()) { skipped.push({ row: r, reason: 'no name' }); continue; }
    const row = { name: String(r.name).trim(), category: r.category || '', status: r.status === 'want' ? 'want' : 'own', brand: r.brand || '', model: r.model || '', notes: r.notes || '' };
    if (seen.has(key(row))) { skipped.push({ row, reason: 'already in inventory' }); continue; }
    seen.add(key(row)); toAdd.push(row);
  }
  return { toAdd, skipped };
}

/* ---------- expenses ---------- */
/* Sum rows by a key function. Returns [{key, total, count}] sorted by key. */
export function sumBy(rows, keyFn) {
  const m = new Map();
  rows.forEach(r => { const k = keyFn(r) || ''; const e = m.get(k) || { key: k, total: 0, count: 0 }; e.total += num0(r.amount); e.count++; m.set(k, e); });
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export const monthOf = r => String(r.date || '').slice(0, 7);
export const yearOf = r => String(r.date || '').slice(0, 4);

/* ---------- utilities ---------- */
/* Bills of one kind, oldest first, each with change versus the bill before and cost per unit. */
export function utilityTrend(rows, kind) {
  const list = rows.filter(r => r.kind === kind && r.date && toNum(r.amount) != null).sort((a, b) => a.date.localeCompare(b.date));
  return list.map((r, i) => {
    const prev = i ? num0(list[i - 1].amount) : null;
    const amount = num0(r.amount), usage = toNum(r.usage);
    return { ...r, amount, delta: prev == null ? null : amount - prev, pct: prev ? (amount - prev) / prev : null, perUnit: usage && usage > 0 ? amount / usage : null };
  });
}
/* Month by month: latest year with data versus the year before. */
export function yearOverYear(rows, kind) {
  const list = rows.filter(r => r.kind === kind && r.date && toNum(r.amount) != null);
  if (!list.length) return { year: null, months: [] };
  const year = Math.max(...list.map(r => Number(r.date.slice(0, 4))));
  const sumFor = (y, m) => { const hit = list.filter(r => Number(r.date.slice(0, 4)) === y && Number(r.date.slice(5, 7)) === m); return hit.length ? hit.reduce((s, r) => s + num0(r.amount), 0) : null; };
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const cur = sumFor(year, m), prev = sumFor(year - 1, m);
    months.push({ month: m, cur, prev, delta: cur != null && prev != null ? cur - prev : null, pct: cur != null && prev ? (cur - prev) / prev : null });
  }
  return { year, months };
}

/* ---------- reports ---------- */
export function improvementsByYear(expenses, projects = []) {
  const capProj = new Set(projects.filter(p => isOn(p.capital_improvement)).map(p => p.id));
  const rows = expenses.filter(e => isOn(e.capital_improvement) || (e.project && capProj.has(e.project) && (e.capital_improvement == null || e.capital_improvement === '')));
  const years = sumBy(rows, yearOf).map(y => ({ ...y, rows: rows.filter(r => yearOf(r) === y.key).sort((a, b) => String(a.date).localeCompare(String(b.date))) }));
  return { years, total: rows.reduce((s, r) => s + num0(r.amount), 0), count: rows.length };
}
export const bigPurchases = (expenses, threshold = 250) => expenses.filter(e => num0(e.amount) >= threshold).sort((a, b) => num0(b.amount) - num0(a.amount));
/* Best guess at what an asset cost: an expense whose item text contains the asset name or the reverse. */
export function matchAssetCost(asset, expenses) {
  const n = cleanName(asset.name);
  if (n.length < 3) return null;
  const hits = expenses.filter(e => { const i = cleanName(e.item); return i && (i.includes(n) || n.includes(i)); }).sort((a, b) => num0(b.amount) - num0(a.amount));
  return hits[0] || null;
}
