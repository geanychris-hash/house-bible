// Pure logic behind the visuals (no DOM). Tested by visuals-logic.test.mjs.
const live = rows => (rows || []).filter(r => !Number(r.deleted));
export const parseJson = (v, fb) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch { return fb; } };

/** Which band of the house a floor name belongs to. */
export function levelKind(name) {
  const n = String(name || '');
  if (/attic/i.test(n)) return 'roof';
  if (/basement|cellar/i.test(n)) return 'below';
  if (/exterior|yard|outside|garage|shed/i.test(n)) return 'ext';
  return 'floor';
}
/** Sort rank, top of the house first: attic, upper floors (3rd, 2nd, 1st), then basement. */
function rank(name) {
  const n = String(name || '').toLowerCase();
  if (/attic/.test(n)) return 0;
  if (/basement|cellar/.test(n)) return 100;
  const m = /(\d)/.exec(n) || (/third/.test(n) ? [0, 3] : /second/.test(n) ? [0, 2] : /first|main|ground/.test(n) ? [0, 1] : null);
  return m ? 50 - Number(m[1]) : 60;
}
export const normLevel = s => String(s || '').trim();

/** Levels for the diagrams, from rooms.floor. Always has at least a first floor and a basement so an empty house still draws. */
export function levelsFromRooms(rooms) {
  const set = new Set(live(rooms).map(r => normLevel(r.floor)).filter(Boolean));
  if (!set.size) { set.add('1st floor'); set.add('Basement'); }
  return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Map id -> level name for rooms. */
export const roomLevels = rooms => new Map(live(rooms).map(r => [r.id, normLevel(r.floor)]));

const isRadiator = a => /radiator/i.test(`${a.name} ${a.model}`) || /radiator/i.test(a.kind);
export const radiators = assets => live(assets).filter(isRadiator);

/** Radiator state from its notes. There is no status column, so this only reads obvious words. */
export function radStatus(a) {
  const n = String(a.notes || '').toLowerCase();
  if (/(cold|hammer|spit|leak|stuck|won't heat|not heating)/.test(n)) return 'bad';
  if (/(re-?pitch|slope|tilt)/.test(n)) return 'warn';
  if (/(pitched ok|checked|working|ok)\b/.test(n)) return 'good';
  return 'unk';
}

/** Items grouped per level for the cutaway badges. */
export function itemsByLevel({ rooms, assets, shutoffs, projects }) {
  const lv = roomLevels(rooms);
  const levelOf = row => lv.get(row.room) || '';
  const out = new Map();
  const slot = l => { if (!out.has(l)) out.set(l, { shutoffs: [], systems: [], radiators: [], appliances: [], projects: [], rooms: [] }); return out.get(l); };
  for (const r of live(rooms)) slot(normLevel(r.floor)).rooms.push(r);
  for (const s of live(shutoffs)) slot(levelOf(s)).shutoffs.push(s);
  for (const a of live(assets)) {
    const k = isRadiator(a) ? 'radiators' : a.kind === 'system' ? 'systems' : a.kind === 'appliance' ? 'appliances' : null;
    if (k) slot(levelOf(a))[k].push(a);
  }
  for (const p of live(projects)) if (p.status !== 'done' && p.status !== 'dropped') slot(levelOf(p)).projects.push(p);
  return out;
}

/** Project phases by dependency (Kahn), ported from legacy plan.js. deps are project ids. */
const PRIO = { Safety: 0, Damage: 1, Comfort: 2, Cosmetic: 3 };
export function sequence(projects) {
  const all = live(projects).filter(p => p.status !== 'done' && p.status !== 'dropped');
  const byId = new Map(all.map(p => [p.id, p]));
  const deps = new Map(all.map(p => [p.id, parseJson(p.deps, []).filter(d => byId.has(d))]));
  const remaining = new Set(byId.keys());
  const phases = [];
  for (let guard = 0; remaining.size && guard < 100; guard++) {
    const ready = [...remaining].filter(id => deps.get(id).every(d => !remaining.has(d)));
    if (!ready.length) break;
    phases.push(ready.map(id => byId.get(id)).sort((a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9) || String(a.name).localeCompare(String(b.name))));
    ready.forEach(id => remaining.delete(id));
  }
  return { phases, cyclic: [...remaining].map(id => byId.get(id)), deps };
}

/** Cheapest entered price per unit, or 0. */
export function unitPrice(m) {
  const ps = [m.price_hd, m.price_hf, m.price_other].map(Number).filter(n => n > 0);
  return ps.length ? Math.min(...ps) : 0;
}
/** Rows for the budget chart: budget, spent (expenses linked to the project), est (materials still to buy). */
export function budgetRows({ projects, materials, expenses }) {
  return live(projects).filter(p => p.status !== 'dropped').map(p => {
    const spent = live(expenses).filter(e => e.project === p.id).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const est = p.status === 'done' ? 0 : live(materials).filter(m => m.project === p.id && !Number(m.have)).reduce((s, m) => s + unitPrice(m) * (Number(m.qty) || 1), 0);
    return { id: p.id, name: p.name, budget: Number(p.budget) || 0, spent: Math.round(spent * 100) / 100, est: Math.round(est * 100) / 100 };
  }).filter(r => r.budget || r.spent || r.est);
}

/** Year wheel markers: [{task, date}] for tasks with at most 12 occurrences in the year (more frequent ones are listed separately). */
export function wheelMarkers(tasks, year, occurrences) {
  const dots = [], frequent = [];
  for (const t of live(tasks)) {
    if (t.active != null && !Number(t.active)) continue;
    const dates = occurrences(t, `${year}-01-01`, `${year}-12-31`);
    if (dates.length > 12) frequent.push(t); else for (const d of dates) dots.push({ task: t, date: d });
  }
  return { dots, frequent };
}
