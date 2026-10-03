/* Project Sequencer, pricing, shopping list, tool check. */
const PRIO = { Safety: 0, Damage: 1, Comfort: 2, Cosmetic: 3 };
const SEASON_ORDER = { Fall: 0, 'Heating season': 1, Winter: 2, Spring: 3, Summer: 4, 'Year-round': 5 };

/* best price for a material: lowest entered price. returns {store, price} or null */
function bestPrice(m) {
  const opts = [['Home Depot', m.hd], ['Harbor Freight', m.hf], ['Other', m.other]].filter(([, p]) => p != null && p !== '' && Number(p) > 0);
  if (!opts.length) return null;
  opts.sort((a, b) => a[1] - b[1]);
  return { store: opts[0][0], price: Number(opts[0][1]), all: opts };
}
const lineTotal = m => { const b = bestPrice(m); return b ? b.price * (Number(m.qty) || 1) : 0; };
const projectEstimate = p => (p.materials || []).filter(m => !m.have).reduce((s, m) => s + lineTotal(m), 0);
const projectSpent = p => (p.purchases || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);

/* Sequence: levels by dependency (Kahn). Ignores deps on finished projects. */
function sequence(projects) {
  const active = projects.filter(p => p.status !== 'Done');
  const ids = new Set(active.map(p => p.id));
  const deps = new Map(active.map(p => [p.id, (p.deps || []).filter(d => ids.has(d))]));
  const level = new Map(), remaining = new Set(ids);
  const phases = [];
  let guard = 0;
  while (remaining.size && guard++ < 100) {
    const ready = [...remaining].filter(id => deps.get(id).every(d => !remaining.has(d)));
    if (!ready.length) break;
    const ps = ready.map(findProject).sort((a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9) || (SEASON_ORDER[a.season] ?? 9) - (SEASON_ORDER[b.season] ?? 9) || a.name.localeCompare(b.name));
    phases.push(ps); ready.forEach(id => remaining.delete(id));
  }
  const cyclic = [...remaining].map(findProject);
  return { phases, cyclic };
}

/* Shopping list across non-done projects (or one project). */
function shopping(projects) {
  const rows = [];
  projects.filter(p => p.status !== 'Done').forEach(p => (p.materials || []).filter(m => !m.have).forEach(m => {
    const b = bestPrice(m);
    rows.push({ project: p.name, item: m.item, qty: Number(m.qty) || 1, unit: m.unit, best: b, total: b ? b.price * (Number(m.qty) || 1) : 0, m });
  }));
  const byStore = {};
  rows.forEach(r => { const s = r.best ? r.best.store : 'No price yet'; (byStore[s] = byStore[s] || []).push(r); });
  const total = rows.reduce((s, r) => s + r.total, 0);
  return { rows, byStore, total };
}

/* Tool check: match project tool names against inventory names (case-insensitive, substring either way). */
function ownsTool(name) {
  const n = name.toLowerCase().replace(/\(example\)/g, '').trim();
  if (!n) return false;
  return S.tools.some(t => {
    if (t.status === 'want') return false;
    const x = t.name.toLowerCase().replace(/\(example\)/g, '').trim();
    return x && (x === n || x.includes(n) || n.includes(x));
  });
}
function toolCheck(projects) {
  const map = new Map();
  projects.filter(p => p.status !== 'Done').forEach(p => (p.tools || []).forEach(t => {
    const k = t.trim().toLowerCase(); if (!k) return;
    const e = map.get(k) || { name: t.trim(), projects: [] }; e.projects.push(p.name); map.set(k, e);
  }));
  return [...map.values()].map(e => ({ ...e, own: ownsTool(e.name) })).sort((a, b) => a.own - b.own || a.name.localeCompare(b.name));
}
const searchURL = (store, q) => store === 'Harbor Freight'
  ? 'https://www.harborfreight.com/catalogsearch/result/?q=' + encodeURIComponent(q)
  : 'https://www.homedepot.com/s/' + encodeURIComponent(q);
