// Visuals: year wheel, house cutaway, steam diagram, project flow, budget chart. Ported from legacy/v1/js/charts.js,
// now reading real data through HB.list. Decorative and lowest priority; nothing here writes data.
import { registerView } from '../core/router.js';
import { h, money } from '../core/ui.js';
import * as HB from '../core/data.js';
import { levelsFromRooms, levelKind, radiators, radStatus, itemsByLevel, sequence, budgetRows, wheelMarkers, parseJson, normLevel } from './visuals-logic.js';

const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const polar = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
const f1 = n => Math.round(n * 10) / 10;
function annulus(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  const large = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
  return `M${f1(x0)} ${f1(y0)}A${r1} ${r1} 0 ${large} 1 ${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}A${r0} ${r0} 0 ${large} 0 ${f1(x3)} ${f1(y3)}Z`;
}
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = n => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const angM = (y, m, d) => (m + (d - 1) / daysIn(y, m)) * 30 - 90;
const trunc = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');
const todayISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const kb = fn => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

// One-pipe steam heating season. Not stored anywhere yet, so these are the usual New England dates.
const HEAT_FROM = '10-15', HEAT_TO = '05-01';
function heatInfo(today) {
  const md = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const inSeason = md >= HEAT_FROM || md <= HEAT_TO;
  const mk = (s, yr) => { const [m, d] = s.split('-').map(Number); return new Date(yr, m - 1, d); };
  const y = today.getFullYear();
  if (inSeason) {
    const start = md >= HEAT_FROM ? mk(HEAT_FROM, y) : mk(HEAT_FROM, y - 1);
    const end = md >= HEAT_FROM ? mk(HEAT_TO, y + 1) : mk(HEAT_TO, y);
    return { inSeason, day: Math.round((today - start) / 864e5) + 1, left: Math.round((end - today) / 864e5) };
  }
  return { inSeason, until: Math.round((mk(HEAT_FROM, y) - today) / 864e5) };
}
const angMD = (md, y) => { const [m, d] = md.split('-').map(Number); return angM(y, m - 1, d); };

/* ---------- year wheel ---------- */
function yearWheel({ today, selected, onMonth, dots, status }) {
  const y = today.getFullYear(), cx = 180, cy = 180;
  const svg = sv('svg', { viewBox: '0 0 360 360', role: 'img', class: 'wheel', 'aria-label': 'Year wheel of maintenance tasks' });
  for (let m = 0; m < 12; m++) {
    const a0 = m * 30 - 90 + .6, a1 = m * 30 - 90 + 29.4;
    const g = sv('g', { class: 'seg' + (selected === m ? ' sel' : ''), role: 'button', tabindex: '0', 'aria-label': MONTH_FULL[m], onclick: () => onMonth(m), onkeydown: kb(() => onMonth(m)) }, sv('path', { d: annulus(cx, cy, 138, 164, a0, a1) }));
    const [tx, ty] = polar(cx, cy, 151, m * 30 - 75);
    g.append(sv('text', { x: f1(tx), y: f1(ty + 4), 'text-anchor': 'middle' }, MONTH_FULL[m].slice(0, 3).toUpperCase()));
    svg.append(g);
  }
  let a0 = angMD(HEAT_FROM, y), a1 = angMD(HEAT_TO, y);
  if (a1 <= a0) a1 += 360;
  svg.append(sv('path', { class: 'heat-arc', d: annulus(cx, cy, 126, 133, a0, Math.min(a1, a0 + 359.9)) }));
  const pts = dots.map(d => { const [yy, mm, dd] = d.date.split('-').map(Number); return { ...d, a: angM(yy, mm - 1, dd) }; }).sort((p, q) => p.a - q.a);
  const lanes = [114, 102, 90, 78], lastA = lanes.map(() => -999);
  for (const d of pts) {
    let lane = lastA.findIndex(a => d.a - a > 9);
    if (lane < 0) lane = 0;
    lastA[lane] = d.a;
    const [x, yy] = polar(cx, cy, lanes[lane], d.a);
    const st = status(d.task, d.date);
    svg.append(sv('circle', { class: 'dot ' + st, cx: f1(x), cy: f1(yy), r: 4.6, tabindex: '0', role: 'button', 'aria-label': `${d.task.title}, ${d.date}`, onclick: () => onMonth(Number(d.date.slice(5, 7)) - 1), onkeydown: kb(() => onMonth(Number(d.date.slice(5, 7)) - 1)) }, sv('title', null, `${d.task.title} (${d.date})`)));
  }
  const na = angM(y, today.getMonth(), today.getDate());
  const [nx, ny] = polar(cx, cy, 160, na), [bx, by] = polar(cx, cy, 52, na);
  svg.append(sv('line', { class: 'needle', x1: f1(bx), y1: f1(by), x2: f1(nx), y2: f1(ny) }), sv('circle', { class: 'needle-tip', cx: f1(nx), cy: f1(ny), r: 4 }));
  const hi = heatInfo(today);
  svg.append(sv('text', { class: 'c-big', x: cx, y: cy - 2, 'text-anchor': 'middle' }, hi.inSeason ? `DAY ${hi.day}` : `${hi.until}d`),
    sv('text', { class: 'c-small', x: cx, y: cy + 18, 'text-anchor': 'middle' }, hi.inSeason ? `HEATING · ${hi.left} LEFT` : 'UNTIL HEATING'),
    sv('text', { class: 'c-small', x: cx, y: cy + 36, 'text-anchor': 'middle' }, `${MONTH_FULL[today.getMonth()].toUpperCase()} ${today.getDate()}`));
  return svg;
}

/* ---------- levels ---------- */
const BAND_H = 66;
function layoutLevels(levels) {
  const bands = levels.filter(n => levelKind(n) !== 'ext').map(n => ({ name: n, kind: levelKind(n) }));
  const top = 10;
  bands.forEach((b, i) => { b.y = top + i * BAND_H; b.h = BAND_H; });
  const fb = bands.findIndex(b => b.kind === 'below');
  return { bands, top, ground: fb >= 0 ? bands[fb].y : top + bands.length * BAND_H, bottom: top + bands.length * BAND_H, extName: levels.find(n => levelKind(n) === 'ext') || null };
}
const TYPES = [['shutoffs', 'Shutoffs', 'k-shut'], ['systems', 'Systems', 'k-sys'], ['radiators', 'Radiators', 'k-rad'], ['appliances', 'Appliances', 'k-app'], ['projects', 'Projects', 'k-proj']];
const emptySlot = () => ({ shutoffs: [], systems: [], radiators: [], appliances: [], projects: [], rooms: [] });

function houseCutaway({ levels, byLevel, selected, onPick }) {
  const L = layoutLevels(levels), X0 = 98, BW = 204, W = 360, H = L.bottom + 18;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram house', role: 'group', 'aria-label': 'House cutaway by level' });
  svg.append(sv('defs', null, sv('pattern', { id: 'earth', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, sv('path', { class: 'earth-line', d: 'M0 8L8 0' }))));
  for (const b of L.bands) {
    const items = byLevel.get(b.name) || emptySlot(), sel = selected === b.name;
    const g = sv('g', { class: 'band ' + b.kind + (sel ? ' sel' : ''), tabindex: '0', role: 'button', 'aria-label': `${b.name}, tap to list items`, onclick: () => onPick(b.name), onkeydown: kb(() => onPick(b.name)) });
    if (b.kind === 'roof') g.append(sv('polygon', { class: 'shape', points: `${X0 - 8},${b.y + b.h} ${X0 + BW / 2},${b.y + 4} ${X0 + BW + 8},${b.y + b.h}` }));
    else g.append(sv('rect', { class: 'shape', x: X0, y: b.y, width: BW, height: b.h }));
    if (b.kind === 'below') g.append(sv('rect', { class: 'earth', x: X0, y: b.y, width: BW, height: b.h }));
    g.append(sv('text', { class: 'lvl', x: 8, y: b.y + 24 }, trunc(b.name.toUpperCase(), 12)));
    let x = X0 + 14;
    const yy = b.y + (b.kind === 'roof' ? 44 : 24);
    for (const [k, label, cls] of TYPES) {
      const n = items[k].length; if (!n) continue;
      g.append(sv('circle', { class: 'badge ' + cls, cx: x, cy: yy, r: 9 }, sv('title', null, `${label}: ${n}`)), sv('text', { class: 'badge-n', x, y: yy + 3.5, 'text-anchor': 'middle' }, n));
      x += 24;
    }
    items.radiators.slice(0, 9).forEach((r, i) => g.append(sv('rect', { class: 'mini-rad ' + radStatus(r), x: X0 + 14 + i * 14, y: b.y + b.h - 22, width: 10, height: 12, rx: 1.5 }, sv('title', null, r.name))));
    svg.append(g);
  }
  svg.append(sv('line', { class: 'ground', x1: 0, y1: L.ground, x2: W - 56, y2: L.ground }));
  if (L.extName) {
    const items = byLevel.get(L.extName) || emptySlot(), n = TYPES.reduce((s, [k]) => s + items[k].length, 0), sel = selected === L.extName;
    const g = sv('g', { class: 'band ext' + (sel ? ' sel' : ''), tabindex: '0', role: 'button', 'aria-label': `${L.extName}, tap to list items`, onclick: () => onPick(L.extName), onkeydown: kb(() => onPick(L.extName)) },
      sv('rect', { class: 'shape', x: 312, y: L.top, width: 40, height: L.bottom - L.top, rx: 8 }),
      sv('text', { class: 'lvl', transform: `translate(337 ${L.top + (L.bottom - L.top) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, trunc(L.extName.toUpperCase(), 12)));
    if (n) g.append(sv('circle', { class: 'badge k-app', cx: 332, cy: L.top + 18, r: 9 }), sv('text', { class: 'badge-n', x: 332, y: L.top + 21.5, 'text-anchor': 'middle' }, n));
    svg.append(g);
  }
  return svg;
}

/* ---------- steam diagram ---------- */
const statusWord = s => ({ good: 'looks fine', warn: 'needs re-pitch', bad: 'has an issue', unk: 'not checked' }[s]);
function steamDiagram({ levels, rads, roomLevel, animate, onPick }) {
  const L = layoutLevels(levels);
  const sorted = rads.slice().sort((a, b) => String(a.name).localeCompare(b.name));
  const lvOf = r => roomLevel.get(r.room) || '';
  const byLevel = {};
  L.bands.forEach(b => { byLevel[b.name] = sorted.filter(r => lvOf(r) === b.name); });
  const unplaced = sorted.filter(r => !byLevel[lvOf(r)]);
  const maxPer = Math.max(3, ...Object.values(byLevel).map(a => a.length));
  const SP = 56, X0 = 98, BW = Math.max(204, maxPer * SP + 24), W = X0 + BW + 24, H = L.bottom + 18;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram steam', role: 'group', 'aria-label': 'One-pipe steam system diagram' });
  for (const b of L.bands) {
    const g = sv('g', { class: 'band ' + b.kind + ' flat' });
    if (b.kind === 'roof') g.append(sv('polygon', { class: 'shape', points: `${X0 - 8},${b.y + b.h} ${X0 + BW / 2},${b.y + 4} ${X0 + BW + 8},${b.y + b.h}` }));
    else g.append(sv('rect', { class: 'shape', x: X0, y: b.y, width: BW, height: b.h }));
    g.append(sv('text', { class: 'lvl', x: 8, y: b.y + 24 }, trunc(b.name.toUpperCase(), 12)));
    svg.append(g);
  }
  svg.append(sv('line', { class: 'ground', x1: 0, y1: L.ground, x2: W, y2: L.ground }));
  const base = L.bands.find(b => b.kind === 'below') || L.bands[L.bands.length - 1];
  if (!base) return { svg, unplaced };
  const mainY = base.y + 40, K = Math.min(3, Math.max(1, Math.ceil(maxPer / 2)));
  const xs = K === 1 ? [X0 + BW * .6] : Array.from({ length: K }, (_, i) => X0 + 70 + i * ((BW - 90) / (K - 1)));
  const topRad = L.bands.find(b => byLevel[b.name].length);
  const topY = topRad ? topRad.y + 50 : mainY, cls = 'pipe' + (animate ? ' flow' : '');
  svg.append(sv('line', { class: cls, x1: X0 + 52, y1: mainY, x2: xs[xs.length - 1], y2: mainY }));
  xs.forEach(x => svg.append(sv('line', { class: cls, x1: x, y1: mainY, x2: x, y2: topY })));
  svg.append(sv('g', { class: 'boiler', role: 'img', 'aria-label': 'Boiler' },
    sv('rect', { x: X0 + 8, y: base.y + 14, width: 44, height: 40, rx: 6 }), sv('circle', { class: 'gauge', cx: X0 + 30, cy: base.y + 28, r: 8 }),
    sv('path', { class: 'flame', d: `M${X0 + 30} ${base.y + 52}c-6-4-6-9-2-13c1 3 3 3 4 1c3 3 5 8-2 12z` }), sv('text', { class: 'tiny', x: X0 + 30, y: base.y + 11, 'text-anchor': 'middle' }, 'BOILER')));
  const nearest = cx => xs.reduce((a, b) => Math.abs(b - cx) < Math.abs(a - cx) ? b : a);
  for (const b of L.bands) {
    const list = byLevel[b.name], n = list.length; if (!n) continue;
    const gap = Math.min(SP, (BW - 20) / n), startX = X0 + 10 + (BW - 20 - gap * n) / 2 + gap / 2;
    list.forEach((r, i) => {
      const cx = startX + i * gap, st = radStatus(r), py = b.y + b.h - 18;
      svg.append(sv('line', { class: cls, x1: nearest(cx), y1: py, x2: cx, y2: py }), sv('line', { class: cls, x1: cx, y1: py, x2: cx, y2: py - 4 }));
      const g = sv('g', { class: 'rad ' + st, tabindex: '0', role: 'button', 'aria-label': `${r.name}, ${statusWord(st)}`, onclick: () => onPick(r), onkeydown: kb(() => onPick(r)) }, sv('title', null, `${r.name}: ${statusWord(st)}`));
      g.append(sv('rect', { class: 'rad-base', x: cx - 16, y: py - 6, width: 32, height: 3, rx: 1 }));
      for (let k = 0; k < 5; k++) g.append(sv('rect', { class: 'rad-fin', x: cx - 15 + k * 6.6, y: py - 26, width: 4.4, height: 20, rx: 2 }));
      g.append(sv('text', { class: 'tiny', x: cx, y: py + 13, 'text-anchor': 'middle' }, trunc(String(r.name).replace(/^radiator,?\s*/i, ''), 8)));
      svg.append(g);
    });
  }
  return { svg, unplaced };
}

/* ---------- project flow ---------- */
function flowGraph({ projects, onOpen }) {
  const { phases, cyclic } = sequence(projects);
  const cols = phases.map(p => p.slice());
  if (cyclic.length) cols.push(cyclic.slice());
  const NW = 172, NH = 54, GX = 52, GY = 14, PAD = 10;
  const maxRows = Math.max(1, ...cols.map(c => c.length));
  const W = PAD * 2 + Math.max(1, cols.length) * NW + Math.max(0, cols.length - 1) * GX, H = PAD * 2 + 16 + maxRows * (NH + GY) - GY;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram flow', role: 'group', 'aria-label': 'Project dependency flow', style: `width:${W}px;max-width:100%;min-width:${Math.min(W, 520)}px` });
  svg.append(sv('defs', null, sv('marker', { id: 'arr', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, sv('path', { class: 'arrow', d: 'M0 0L8 4L0 8z' }))));
  const pos = new Map();
  cols.forEach((c, ci) => {
    const x = PAD + ci * (NW + GX);
    svg.append(sv('text', { class: 'col-h', x, y: PAD + 8 }, ci < phases.length ? `PHASE ${ci + 1}` : 'CIRCULAR'));
    c.forEach((p, ri) => pos.set(p.id, { x, y: PAD + 16 + ri * (NH + GY), p }));
  });
  for (const [id, b] of pos) for (const d of parseJson(b.p.deps, [])) {
    const a = pos.get(d); if (!a) continue;
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
    svg.append(sv('path', { class: 'edge', d: `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2 - 1} ${y2}`, 'marker-end': 'url(#arr)' }));
    void id;
  }
  for (const [, b] of pos) {
    const p = b.p, cyc = cyclic.includes(p);
    svg.append(sv('g', { class: 'node pr-' + p.priority + (cyc ? ' cyc' : ''), tabindex: '0', role: 'button', 'aria-label': `${p.name}, ${p.priority || 'no priority'}, ${p.status}`, onclick: () => onOpen(p), onkeydown: kb(() => onOpen(p)) },
      sv('rect', { class: 'box', x: b.x, y: b.y, width: NW, height: NH, rx: 6 }), sv('rect', { class: 'stripe', x: b.x, y: b.y, width: 5, height: NH, rx: 2 }),
      sv('text', { class: 'n1', x: b.x + 13, y: b.y + 21 }, trunc(p.name, 24)),
      sv('text', { class: 'n2', x: b.x + 13, y: b.y + 40 }, [p.priority, Number(p.pro) ? 'pro' : 'DIY', p.budget ? money(p.budget).replace('.00', '') : ''].filter(Boolean).join(' · ')),
      sv('title', null, p.name)));
  }
  if (!pos.size) svg.append(sv('text', { class: 'n2', x: PAD, y: H / 2 }, 'No open projects'));
  return svg;
}

/* ---------- budget bars ---------- */
function budgetChart(rows) {
  const RH = 30, LW = 150, W = 600, H = Math.max(40, rows.length * RH + 34);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram budget', role: 'img', 'aria-label': 'Budget, spent and materials still to buy, by project' });
  if (!rows.length) { svg.append(sv('text', { class: 'n2', x: 4, y: 24 }, 'Add budgets, materials or expenses linked to a project to see this chart.')); return svg; }
  const max = Math.max(...rows.map(r => Math.max(r.budget, r.est + r.spent))) || 1, BW = W - LW - 70;
  const sx = v => v / max * BW;
  rows.forEach((r, i) => {
    const y = 6 + i * RH;
    svg.append(sv('text', { class: 'n2', x: 0, y: y + 14 }, trunc(r.name, 22)));
    if (r.budget) svg.append(sv('rect', { class: 'b-budget', x: LW, y, width: sx(r.budget), height: 20, rx: 3 }));
    svg.append(sv('rect', { class: 'b-spent' + (r.budget && r.spent > r.budget ? ' over' : ''), x: LW, y: y + 4, width: sx(r.spent), height: 12, rx: 2 }),
      sv('rect', { class: 'b-est', x: LW + sx(r.spent), y: y + 4, width: sx(r.est), height: 12, rx: 2 }),
      sv('text', { class: 'n3', x: LW + Math.max(sx(r.budget), sx(r.spent + r.est)) + 6, y: y + 14 }, money(r.spent + r.est).replace('.00', '')));
  });
  const ly = H - 8;
  svg.append(sv('rect', { class: 'b-budget', x: LW, y: ly - 8, width: 14, height: 9, rx: 2 }), sv('text', { class: 'n3', x: LW + 20, y: ly }, 'budget'),
    sv('rect', { class: 'b-spent', x: LW + 80, y: ly - 8, width: 14, height: 9, rx: 2 }), sv('text', { class: 'n3', x: LW + 100, y: ly }, 'spent'),
    sv('rect', { class: 'b-est', x: LW + 150, y: ly - 8, width: 14, height: 9, rx: 2 }), sv('text', { class: 'n3', x: LW + 170, y: ly }, 'materials still to buy'));
  return svg;
}

/* ---------- the view ---------- */
const TABS = [['wheel', 'Year wheel'], ['house', 'House'], ['steam', 'Steam'], ['flow', 'Project flow'], ['budget', 'Budget']];
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function render(container) {
  let alive = true, timer = null;
  const S = { tab: TABS.some(t => t[0] === lsGet('hb.vis.tab')) ? lsGet('hb.vis.tab') : 'wheel', month: new Date().getMonth(), level: null, animate: true };
  const tables = ['tasks', 'task_log', 'rooms', 'assets', 'shutoffs', 'projects', 'materials', 'expenses'];
  let D = Object.fromEntries(tables.map(t => [t, []]));
  let recur = null;
  const root = h('div', { class: 'list vis-root' });
  container.replaceChildren(root);
  if (!document.getElementById('visuals-css')) document.head.append(h('link', { rel: 'stylesheet', id: 'visuals-css', href: new URL('../../css/visuals.css', import.meta.url).href }));

  const open = (table, id, view) => { location.hash = `#/${view}/${id}`; void table; };
  const listBox = (title, rows) => h('section', { class: 'panel' }, h('header', null, h('h3', null, title)), rows.length ? h('div', { class: 'list' }, rows) : h('p', { class: 'muted' }, 'Nothing here.'));

  function body() {
    const today = new Date(), iso = todayISO(today);
    if (S.tab === 'wheel') {
      if (!recur) return h('p', { class: 'banner warn' }, 'The year wheel needs the maintenance schedule, which is not installed yet.');
      const { dots, frequent } = wheelMarkers(D.tasks, today.getFullYear(), recur.occurrences);
      const status = (task, date) => {
        const s = recur.taskStatus(task, D.task_log.filter(l => l.task === task.id), iso);
        if (s.state === 'overdue') return date <= iso ? 'bad' : 'idle';
        if (s.state === 'due') return 'warn';
        return s.state === 'upcoming' && s.days != null && s.days <= 30 ? 'acc' : 'idle';
      };
      const inMonth = dots.filter(d => Number(d.date.slice(5, 7)) - 1 === S.month).sort((a, b) => a.date.localeCompare(b.date));
      return h('div', { class: 'vis-cols' },
        h('div', { class: 'wheel-wrap' }, yearWheel({ today, selected: S.month, onMonth: m => { S.month = m; draw(); }, dots, status })),
        h('div', { class: 'list' },
          listBox(MONTH_FULL[S.month], inMonth.map(d => h('a', { class: 'item', href: '#/maintenance' }, h('span', { class: 'title' }, d.task.title), h('span', { class: 'muted' }, d.date.slice(5))))),
          frequent.length ? h('p', { class: 'muted' }, `${frequent.length} task${frequent.length === 1 ? ' repeats' : 's repeat'} too often to show on the wheel: ${frequent.slice(0, 4).map(t => t.title).join(', ')}${frequent.length > 4 ? '...' : ''}.`) : null,
          h('p', { class: 'muted' }, 'Red is overdue, amber is due now, teal is due within 30 days. The copper arc is the heating season, assumed Oct 15 to May 1.')));
    }
    const levels = levelsFromRooms(D.rooms);
    if (S.tab === 'house') {
      const byLevel = itemsByLevel(D);
      const sel = S.level && (byLevel.get(S.level) || emptySlot());
      return h('div', { class: 'vis-cols' },
        h('div', { class: 'diagram-wrap' }, houseCutaway({ levels, byLevel, selected: S.level, onPick: l => { S.level = S.level === l ? null : l; draw(); } })),
        h('div', { class: 'list' },
          h('div', { class: 'vis-legend' }, TYPES.map(([, label, cls]) => h('span', null, h('i', { class: 'sw ' + cls }), label))),
          sel ? [
            sel.rooms.length ? listBox(`${S.level}: rooms`, sel.rooms.map(r => h('a', { class: 'item', href: `#/rooms/${r.id}` }, h('span', { class: 'title' }, r.name)))) : null,
            ...TYPES.filter(([k]) => sel[k].length).map(([k, label]) => listBox(`${S.level}: ${label.toLowerCase()}`, sel[k].map(x => h('a', { class: 'item', href: `#/${k === 'projects' ? 'projects' : k === 'shutoffs' ? 'shutoffs' : 'assets'}/${x.id}` }, h('span', { class: 'title' }, x.name))))),
          ] : h('p', { class: 'muted' }, 'Tap a floor to list what is on it. Items appear here once their room has a floor set.')));
    }
    if (S.tab === 'steam') {
      const rads = radiators(D.assets);
      const roomLevel = new Map(D.rooms.filter(r => !Number(r.deleted)).map(r => [r.id, normLevel(r.floor)]));
      const { svg, unplaced } = steamDiagram({ levels, rads, roomLevel, animate: S.animate, onPick: r => open('assets', r.id, 'assets') });
      return h('div', { class: 'list' },
        h('div', { class: 'vis-cols' }, h('div', { class: 'diagram-wrap' }, svg),
          h('div', { class: 'list' },
            h('label', { class: 'vis-check' }, h('input', { type: 'checkbox', checked: S.animate, onchange: e => { S.animate = e.target.checked; draw(); } }), ' Animate steam'),
            h('p', { class: 'muted' }, rads.length ? 'Each radiator hangs off the supply pipe on its floor. Color comes from its notes: cold, hammer or spitting is red; re-pitch is amber.' : 'No radiators yet. Add each radiator as an asset named "Radiator, <room>" and set its room.'),
            unplaced.length ? listBox('Radiators with no floor', unplaced.map(r => h('a', { class: 'item', href: `#/assets/${r.id}` }, h('span', { class: 'title' }, r.name)))) : null)));
    }
    if (S.tab === 'flow') return h('div', { class: 'diagram-wrap flow-wrap' }, flowGraph({ projects: D.projects, onOpen: p => open('projects', p.id, 'projects') }),
      h('p', { class: 'muted' }, 'Left to right is the order to do things. An arrow means the project on the left must be finished first. Set dependencies on each project.'));
    return h('div', { class: 'diagram-wrap' }, budgetChart(budgetRows(D)));
  }

  function draw() {
    if (!alive) return;
    root.replaceChildren(
      h('section', { class: 'panel' }, h('header', null, h('h1', null, 'Visuals')),
        h('div', { class: 'seg-ctl', role: 'group', 'aria-label': 'Choose a visual' }, TABS.map(([id, label]) => h('button', { type: 'button', 'aria-pressed': String(S.tab === id), onclick: () => { S.tab = id; lsSet('hb.vis.tab', id); draw(); } }, label)))),
      h('section', { class: 'panel' }, body()));
  }
  async function load() {
    const [rows, r] = await Promise.all([Promise.all(tables.map(t => HB.list(t).catch(() => []))), import('../core/recur.js').catch(() => null)]);
    if (!alive) return;
    D = Object.fromEntries(tables.map((t, i) => [t, rows[i]]));
    recur = r;
    draw();
  }
  const redraw = () => { clearTimeout(timer); timer = setTimeout(() => load().catch(console.error), 80); };
  const unsubs = [];
  for (const t of tables) { try { unsubs.push(HB.subscribe(t, redraw)); } catch { /* unknown table */ } }
  load().catch(e => { console.error(e); root.replaceChildren(h('p', { class: 'banner bad' }, 'Could not load the visuals.')); });
  return () => { alive = false; clearTimeout(timer); unsubs.forEach(u => { try { u(); } catch { /* ignore */ } }); };
}

registerView({ id: 'visuals', title: 'Visuals', icon: 'chart', order: 90, render });
