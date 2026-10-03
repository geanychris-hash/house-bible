/* SVG visuals: year wheel, house cutaway, steam diagram, project flow, budget bars. All colors come from CSS classes/tokens. */
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
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
/* month-based angle so every month is a 30 degree wedge, 12 o'clock = Jan 1 */
const angM = (y, m, d) => (m + (d - 1) / daysIn(y, m)) * 30 - 90;
const angMD = (md, y) => { const [m, d] = md.split('-').map(Number); return angM(y, m - 1, d); };
const trunc = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');

/* ---------- heating season helpers ---------- */
function heatInfo(today = new Date()) {
  const { heatFrom, heatTo } = S.settings;
  const md = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const wrap = heatTo < heatFrom;
  const inSeason = wrap ? (md >= heatFrom || md <= heatTo) : (md >= heatFrom && md <= heatTo);
  const y = today.getFullYear();
  const mk = (s, yr) => { const [m, d] = s.split('-').map(Number); return new Date(yr, m - 1, d); };
  let start, end;
  if (inSeason) {
    start = md >= heatFrom ? mk(heatFrom, y) : mk(heatFrom, y - 1);
    end = wrap ? (md >= heatFrom ? mk(heatTo, y + 1) : mk(heatTo, y)) : mk(heatTo, y);
    return { inSeason, day: Math.round((today - start) / 864e5) + 1, left: Math.round((end - today) / 864e5), total: Math.round((end - start) / 864e5) + 1 };
  }
  start = md < heatFrom ? mk(heatFrom, y) : mk(heatFrom, y + 1);
  return { inSeason, until: Math.round((start - today) / 864e5) };
}

/* ---------- year wheel ---------- */
function taskMarkers(t) {
  const s0 = parseISO(t.start), r = t.rule;
  if (r.type === 'yearly') return [{ kind: 'dot', m: s0.getMonth(), d: s0.getDate() }];
  if (r.type === 'monthly') { const out = [], n = r.interval || 1; for (let k = 0; k < 12; k += n) out.push({ kind: 'dot', m: (s0.getMonth() + k) % 12, d: Math.min(s0.getDate(), 28) }); return out; }
  return [{ kind: 'band', from: r.from, to: r.to }];
}
function tasksInMonth(m) {
  return S.tasks.filter(t => taskMarkers(t).some(k => {
    if (k.kind === 'dot') return k.m === m;
    const fm = Number(k.from.split('-')[0]) - 1, tm = Number(k.to.split('-')[0]) - 1;
    return fm <= tm ? (m >= fm && m <= tm) : (m >= fm || m <= tm);
  }));
}
function yearWheel({ today = new Date(), selected = null, onMonth }) {
  const y = today.getFullYear(), cx = 180, cy = 180;
  const svg = sv('svg', { viewBox: '0 0 360 360', role: 'img', class: 'wheel', 'aria-label': 'Year wheel of maintenance tasks' });
  // month segments
  for (let m = 0; m < 12; m++) {
    const a0 = m * 30 - 90 + .6, a1 = m * 30 - 90 + 29.4;
    const g = sv('g', { class: 'seg' + (selected === m ? ' sel' : ''), role: 'button', tabindex: '0', 'aria-label': MONTH_FULL[m], onclick: () => onMonth && onMonth(m), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMonth && onMonth(m); } } },
      sv('path', { d: annulus(cx, cy, 138, 164, a0, a1) }));
    const [tx, ty] = polar(cx, cy, 151, m * 30 - 75);
    g.append(sv('text', { x: f1(tx), y: f1(ty + 4), 'text-anchor': 'middle' }, MONTH_FULL[m].slice(0, 3).toUpperCase()));
    svg.append(g);
  }
  // heating season arc
  let a0 = angMD(S.settings.heatFrom, y), a1 = angMD(S.settings.heatTo, y);
  if (a1 <= a0) a1 += 360;
  svg.append(sv('path', { class: 'heat-arc', d: annulus(cx, cy, 126, 133, a0, Math.min(a1, a0 + 359.9)) }));
  // task dots in lanes
  const dots = [];
  S.tasks.forEach(t => { const st = taskStatus(t); taskMarkers(t).forEach(k => { if (k.kind === 'dot') dots.push({ t, st, a: angM(y, k.m, k.d) }); }); });
  dots.sort((p, q) => p.a - q.a);
  const lanes = [114, 102, 90, 78], lastA = lanes.map(() => -999);
  dots.forEach(d => {
    let lane = lastA.findIndex(a => d.a - a > 9);
    if (lane < 0) lane = 0;
    lastA[lane] = d.a;
    const [x, yy] = polar(cx, cy, lanes[lane], d.a);
    const cls = d.st.state === 'over' ? 'bad' : d.st.state === 'due' ? 'warn' : d.st.state === 'upcoming' && d.st.days <= 30 ? 'acc' : 'idle';
    svg.append(sv('circle', { class: 'dot ' + cls, cx: f1(x), cy: f1(yy), r: 4.6, tabindex: '0', role: 'button', 'aria-label': d.t.title, onclick: () => showTask(d.t), onkeydown: e => { if (e.key === 'Enter') showTask(d.t); } }, sv('title', null, d.t.title)));
  });
  // today needle
  const na = angM(y, today.getMonth(), today.getDate());
  const [nx, ny] = polar(cx, cy, 160, na), [bx, by] = polar(cx, cy, 52, na);
  svg.append(sv('line', { class: 'needle', x1: f1(bx), y1: f1(by), x2: f1(nx), y2: f1(ny) }), sv('circle', { class: 'needle-tip', cx: f1(nx), cy: f1(ny), r: 4 }));
  // center readout
  const hi = heatInfo(today);
  const big = hi.inSeason ? `DAY ${hi.day}` : `${hi.until}d`;
  const small = hi.inSeason ? `HEATING · ${hi.left} LEFT` : 'UNTIL HEATING';
  svg.append(sv('text', { class: 'c-big', x: cx, y: cy - 2, 'text-anchor': 'middle' }, big), sv('text', { class: 'c-small', x: cx, y: cy + 18, 'text-anchor': 'middle' }, small),
    sv('text', { class: 'c-small', x: cx, y: cy + 36, 'text-anchor': 'middle' }, `${MONTH_FULL[today.getMonth()].toUpperCase()} ${today.getDate()}`));
  return svg;
}

/* ---------- level layout shared by cutaway and steam ---------- */
const BAND_H = 66;
function levelKind(name) { return /attic/i.test(name) ? 'roof' : /basement|cellar/i.test(name) ? 'below' : /exterior|yard|outside/i.test(name) ? 'ext' : 'floor'; }
function layoutLevels(levels) {
  const bands = levels.filter(n => levelKind(n) !== 'ext').map(n => ({ name: n, kind: levelKind(n) }));
  const top = 10;
  bands.forEach((b, i) => { b.y = top + i * BAND_H; b.h = BAND_H; });
  const firstBelow = bands.findIndex(b => b.kind === 'below');
  const ground = firstBelow >= 0 ? bands[firstBelow].y : top + bands.length * BAND_H;
  const extName = levels.find(n => levelKind(n) === 'ext') || null;
  return { bands, top, ground, bottom: top + bands.length * BAND_H, extName };
}
const TYPES = [
  ['shutoffs', 'Shutoffs', 'k-shut'], ['systems', 'Systems', 'k-sys'], ['radiators', 'Radiators', 'k-rad'],
  ['appliances', 'Appliances', 'k-app'], ['paint', 'Paint', 'k-paint'], ['projects', 'Projects', 'k-proj']];
function itemsAtLevel(level) {
  const out = {};
  TYPES.forEach(([k]) => { out[k] = (k === 'projects' ? S.projects.filter(p => p.status !== 'Done') : S.house[k]).filter(x => (x.level || '') === level); });
  return out;
}
function radStatus(r) {
  if (r.issue && r.issue !== 'None') return 'bad';
  if (r.pitch === 'Needs re-pitch') return 'warn';
  const fresh = r.lastChecked && daysBetween(r.lastChecked, todayISO()) <= 365;
  if (fresh && r.pitch === 'Pitched OK') return 'good';
  return 'unk';
}

/* ---------- house cutaway ---------- */
function houseCutaway({ selected, onPick }) {
  const L = layoutLevels(S.settings.levels), X0 = 98, BW = 204, W = 360, H = L.bottom + 18;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram house', role: 'group', 'aria-label': 'House cutaway by level' });
  svg.append(sv('defs', null, sv('pattern', { id: 'earth', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, sv('path', { class: 'earth-line', d: 'M0 8L8 0' }))));
  L.bands.forEach(b => {
    const items = itemsAtLevel(b.name), sel = selected === b.name;
    const g = sv('g', { class: 'band ' + b.kind + (sel ? ' sel' : ''), tabindex: '0', role: 'button', 'aria-label': `${b.name}, tap to list items`, onclick: () => onPick(b.name), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(b.name); } } });
    if (b.kind === 'roof') g.append(sv('polygon', { class: 'shape', points: `${X0 - 8},${b.y + b.h} ${X0 + BW / 2},${b.y + 4} ${X0 + BW + 8},${b.y + b.h}` }));
    else g.append(sv('rect', { class: 'shape', x: X0, y: b.y, width: BW, height: b.h }));
    if (b.kind === 'below') g.append(sv('rect', { class: 'earth', x: X0, y: b.y, width: BW, height: b.h }));
    g.append(sv('text', { class: 'lvl', x: 8, y: b.y + 24 }, b.name.toUpperCase()));
    let x = X0 + 14;
    const yy = b.y + (b.kind === 'roof' ? 44 : 24);
    TYPES.forEach(([k, label, cls]) => {
      const n = items[k].length; if (!n) return;
      g.append(sv('circle', { class: 'badge ' + cls, cx: x, cy: yy, r: 9 }, sv('title', null, `${label}: ${n}`)), sv('text', { class: 'badge-n', x, y: yy + 3.5, 'text-anchor': 'middle' }, n));
      x += 24;
    });
    items.radiators.slice(0, 9).forEach((r, i) => g.append(sv('rect', { class: 'mini-rad ' + radStatus(r), x: X0 + 14 + i * 14, y: b.y + b.h - 22, width: 10, height: 12, rx: 1.5 }, sv('title', null, r.room))));
    svg.append(g);
  });
  svg.append(sv('line', { class: 'ground', x1: 0, y1: L.ground, x2: W - 56, y2: L.ground }));
  if (L.extName) {
    const items = itemsAtLevel(L.extName), n = TYPES.reduce((s, [k]) => s + items[k].length, 0), sel = selected === L.extName;
    const g = sv('g', { class: 'band ext' + (sel ? ' sel' : ''), tabindex: '0', role: 'button', 'aria-label': `${L.extName}, tap to list items`, onclick: () => onPick(L.extName), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(L.extName); } } },
      sv('rect', { class: 'shape', x: 312, y: L.top, width: 40, height: L.bottom - L.top, rx: 8 }),
      sv('text', { class: 'lvl', transform: `translate(337 ${L.top + (L.bottom - L.top) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, L.extName.toUpperCase()));
    if (n) g.append(sv('circle', { class: 'badge k-app', cx: 332, cy: L.top + 18, r: 9 }), sv('text', { class: 'badge-n', x: 332, y: L.top + 21.5, 'text-anchor': 'middle' }, n));
    svg.append(g);
  }
  return svg;
}

/* ---------- steam diagram ---------- */
function steamDiagram({ animate, onPick }) {
  const L = layoutLevels(S.settings.levels);
  const rads = S.house.radiators.slice().sort((a, b) => a.room.localeCompare(b.room));
  const byLevel = {};
  L.bands.forEach(b => byLevel[b.name] = rads.filter(r => r.level === b.name));
  const unplaced = rads.filter(r => !byLevel[r.level]);
  const maxPer = Math.max(3, ...Object.values(byLevel).map(a => a.length));
  const SP = 56, X0 = 98, BW = Math.max(204, maxPer * SP + 24), W = X0 + BW + 24, H = L.bottom + 18;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram steam', role: 'group', 'aria-label': 'One-pipe steam system diagram' });
  L.bands.forEach(b => {
    const g = sv('g', { class: 'band ' + b.kind + ' flat' });
    if (b.kind === 'roof') g.append(sv('polygon', { class: 'shape', points: `${X0 - 8},${b.y + b.h} ${X0 + BW / 2},${b.y + 4} ${X0 + BW + 8},${b.y + b.h}` }));
    else g.append(sv('rect', { class: 'shape', x: X0, y: b.y, width: BW, height: b.h }));
    g.append(sv('text', { class: 'lvl', x: 8, y: b.y + 24 }, b.name.toUpperCase()));
    svg.append(g);
  });
  svg.append(sv('line', { class: 'ground', x1: 0, y1: L.ground, x2: W, y2: L.ground }));
  const base = L.bands.find(b => b.kind === 'below') || L.bands[L.bands.length - 1];
  if (!base) return svg;
  const mainY = base.y + 40;
  const K = Math.min(3, Math.max(1, Math.ceil(maxPer / 2)));
  const xs = K === 1 ? [X0 + BW * .6] : Array.from({ length: K }, (_, i) => X0 + 70 + i * ((BW - 90) / (K - 1)));
  const topRad = L.bands.find(b => byLevel[b.name].length);
  const topY = topRad ? topRad.y + 50 : mainY;
  const cls = 'pipe' + (animate ? ' flow' : '');
  // boiler
  const bo = sv('g', { class: 'boiler', role: 'img', 'aria-label': 'Boiler' },
    sv('rect', { x: X0 + 8, y: base.y + 14, width: 44, height: 40, rx: 6 }), sv('circle', { class: 'gauge', cx: X0 + 30, cy: base.y + 28, r: 8 }),
    sv('path', { class: 'flame', d: `M${X0 + 30} ${base.y + 52}c-6-4-6-9-2-13c1 3 3 3 4 1c3 3 5 8-2 12z` }), sv('text', { class: 'tiny', x: X0 + 30, y: base.y + 11, 'text-anchor': 'middle' }, 'BOILER'));
  svg.append(sv('line', { class: cls, x1: X0 + 52, y1: mainY, x2: xs[xs.length - 1], y2: mainY }));
  xs.forEach(x => svg.append(sv('line', { class: cls, x1: x, y1: mainY, x2: x, y2: topY })));
  svg.append(bo);
  const nearest = cx => xs.reduce((a, b) => Math.abs(b - cx) < Math.abs(a - cx) ? b : a);
  L.bands.forEach(b => {
    const list = byLevel[b.name], n = list.length; if (!n) return;
    const gap = Math.min(SP, (BW - 20) / n), startX = X0 + 10 + (BW - 20 - gap * n) / 2 + gap / 2;
    list.forEach((r, i) => {
      const cx = startX + i * gap, st = radStatus(r), py = b.y + b.h - 18;
      svg.append(sv('line', { class: cls, x1: nearest(cx), y1: py, x2: cx, y2: py }), sv('line', { class: cls, x1: cx, y1: py, x2: cx, y2: py - 4 }));
      const g = sv('g', { class: 'rad ' + st, tabindex: '0', role: 'button', 'aria-label': `${r.room}, ${statusWord(st)}`, onclick: () => onPick(r), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r); } } }, sv('title', null, `${r.room}: ${statusWord(st)}`));
      g.append(sv('rect', { class: 'rad-base', x: cx - 16, y: py - 6, width: 32, height: 3, rx: 1 }));
      for (let k = 0; k < 5; k++) g.append(sv('rect', { class: 'rad-fin', x: cx - 15 + k * 6.6, y: py - 26, width: 4.4, height: 20, rx: 2 }));
      g.append(sv('text', { class: 'tiny', x: cx, y: py + 13, 'text-anchor': 'middle' }, trunc(r.room.replace(/\s*\(example\)/, '*'), 8)));
      svg.append(g);
    });
  });
  svg.unplaced = unplaced;
  return svg;
}
const statusShort = (r) => { const s = radStatus(r); return r.issue && r.issue !== 'None' ? ({ 'Cold or slow': 'Cold', 'Water hammer': 'Hammer', 'Spitting vent': 'Spits' }[r.issue] || r.issue) : { good: 'OK', warn: 'Re-pitch', bad: 'Issue', unk: 'New' }[s]; };
const statusWord = s => ({ good: 'checked and pitched', warn: 'needs re-pitch', bad: 'has an issue', unk: 'not checked this year' }[s]);

/* ---------- project flow ---------- */
function flowGraph({ onOpen }) {
  const { phases, cyclic } = sequence(S.projects);
  const cols = phases.map(ps => ps.slice());
  if (cyclic.length) cols.push(cyclic.slice());
  const NW = 172, NH = 54, GX = 52, GY = 14, PAD = 10;
  const maxRows = Math.max(1, ...cols.map(c => c.length));
  const W = PAD * 2 + cols.length * NW + Math.max(0, cols.length - 1) * GX, H = PAD * 2 + 16 + maxRows * (NH + GY) - GY;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram flow', role: 'group', 'aria-label': 'Project dependency flow', style: `width:${W}px;max-width:100%;min-width:${Math.min(W, 520)}px` });
  svg.append(sv('defs', null, sv('marker', { id: 'arr', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, sv('path', { class: 'arrow', d: 'M0 0L8 4L0 8z' }))));
  const pos = new Map();
  cols.forEach((c, ci) => {
    const x = PAD + ci * (NW + GX);
    svg.append(sv('text', { class: 'col-h', x, y: PAD + 8 }, ci < phases.length ? `PHASE ${ci + 1}` : 'CIRCULAR'));
    c.forEach((p, ri) => pos.set(p.id, { x, y: PAD + 16 + ri * (NH + GY) }));
  });
  S.projects.filter(p => pos.has(p.id)).forEach(p => (p.deps || []).forEach(d => {
    if (!pos.has(d)) return;
    const a = pos.get(d), b = pos.get(p.id), x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
    svg.append(sv('path', { class: 'edge', d: `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2 - 1} ${y2}`, 'marker-end': 'url(#arr)' }));
  }));
  [...pos.entries()].forEach(([id, p]) => {
    const pr = findProject(id), cyc = cyclic.includes(pr);
    const g = sv('g', { class: 'node pr-' + pr.priority + (cyc ? ' cyc' : ''), tabindex: '0', role: 'button', 'aria-label': `${pr.name}, ${pr.priority}, ${pr.status}`, onclick: () => onOpen(pr), onkeydown: e => { if (e.key === 'Enter') onOpen(pr); } },
      sv('rect', { class: 'box', x: p.x, y: p.y, width: NW, height: NH, rx: 6 }), sv('rect', { class: 'stripe', x: p.x, y: p.y, width: 5, height: NH, rx: 2 }),
      sv('text', { class: 'n1', x: p.x + 13, y: p.y + 21 }, trunc(pr.name.replace(/\s*\(example\)/, '*'), 24)),
      sv('text', { class: 'n2', x: p.x + 13, y: p.y + 40 }, `${pr.priority} · ${pr.pro}${pr.budget ? ' · ' + money(pr.budget).replace('.00', '') : ''}`),
      sv('title', null, pr.name));
    svg.append(g);
  });
  if (!pos.size) svg.append(sv('text', { class: 'n2', x: PAD, y: H / 2 }, 'No open projects'));
  return svg;
}

/* ---------- budget bars ---------- */
function budgetChart() {
  const rows = S.projects.filter(p => (Number(p.budget) || projectEstimate(p) || projectSpent(p))).map(p => ({ name: p.name, budget: Number(p.budget) || 0, est: p.status === 'Done' ? 0 : projectEstimate(p), spent: projectSpent(p) }));
  const RH = 30, LW = 150, W = 600, H = Math.max(40, rows.length * RH + 34);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'diagram budget', role: 'img', 'aria-label': 'Budget, estimate and spend by project' });
  if (!rows.length) { svg.append(sv('text', { class: 'n2', x: 4, y: 24 }, 'Add budgets or materials to see this chart.')); return svg; }
  const max = Math.max(...rows.map(r => Math.max(r.budget, r.est + r.spent))) || 1, BW = W - LW - 70;
  const sx = v => v / max * BW;
  rows.forEach((r, i) => {
    const y = 6 + i * RH;
    svg.append(sv('text', { class: 'n2', x: 0, y: y + 14 }, trunc(r.name.replace(/\s*\(example\)/, '*'), 22)));
    if (r.budget) svg.append(sv('rect', { class: 'b-budget', x: LW, y, width: sx(r.budget), height: 20, rx: 3 }));
    svg.append(sv('rect', { class: 'b-spent' + (r.budget && r.spent > r.budget ? ' over' : ''), x: LW, y: y + 4, width: sx(r.spent), height: 12, rx: 2 }));
    svg.append(sv('rect', { class: 'b-est', x: LW + sx(r.spent), y: y + 4, width: sx(r.est), height: 12, rx: 2 }));
    svg.append(sv('text', { class: 'n3', x: LW + Math.max(sx(r.budget), sx(r.spent + r.est)) + 6, y: y + 14 }, money(r.spent + r.est).replace('.00', '')));
  });
  const ly = H - 8;
  svg.append(sv('rect', { class: 'b-budget', x: LW, y: ly - 8, width: 14, height: 9, rx: 2 }), sv('text', { class: 'n3', x: LW + 20, y: ly }, 'budget'),
    sv('rect', { class: 'b-spent', x: LW + 80, y: ly - 8, width: 14, height: 9, rx: 2 }), sv('text', { class: 'n3', x: LW + 100, y: ly }, 'spent'),
    sv('rect', { class: 'b-est', x: LW + 150, y: ly - 8, width: 14, height: 9, rx: 2 }), sv('text', { class: 'n3', x: LW + 170, y: ly }, 'materials still to buy'));
  return svg;
}
