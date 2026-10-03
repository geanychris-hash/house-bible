// One-pipe steam log: water level, pressure, events, a simple trend, and a what-to-look-for checklist.
import {
  HB, h, loadCss, openForm, mountView, register, emptyState, badge, pageHead, panel, thumbStrip, encodeFiles, parseFilesValue,
  todayISO, fmtDate, lsGet, lsSet,
} from './rooms-shared.js';

loadCss('rooms');

const EVENTS = [['check', 'Routine check'], ['vent', 'Vent work'], ['blowdown', 'Blowdown'], ['service', 'Service visit'], ['problem', 'Problem']];
const EVENT_LABEL = Object.fromEntries(EVENTS);
const LEVELS = [['', '(not checked)'], ['low', 'Low'], ['normal', 'Normal (about half a glass)'], ['high', 'High']];
const LEVEL_LABEL = Object.fromEntries(LEVELS);
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const CHECKLIST = [
  ['level', 'Water in the sight glass is near the middle. Low water: do not run the boiler, call a licensed heating pro.'],
  ['pressure', 'Pressure stays low, usually under 2 psi on a one-pipe system. Higher or climbing: turn the thermostat down and call a licensed heating pro.'],
  ['valves', 'Every radiator supply valve is fully open or fully closed, never half. Half-open valves cause banging and spitting.'],
  ['pitch', 'Radiators and the pipes feeding them slope back toward the boiler so condensate can drain. Banging often means water is pooled.'],
  ['vents', 'Air vents hiss while the heat comes up and then close. A vent that spits water, or never closes, needs replacing.'],
  ['even', 'Radiators heat from the boiler end outward. Note any that stay cold at the far end of the run.'],
  ['cycle', 'The boiler is not switching on and off every few minutes (short cycling).'],
  ['makeup', 'Note how often you add water. A rising need for makeup water means a leak or a return problem.'],
  ['leaks', 'No drips at valves, unions, or the boiler jacket; no rust streaks or puddles.'],
  ['pro', 'Anything involving gas, the burner, the flue, or the controls is for a licensed pro. Skimming and blowdown are only what your boiler manual says.'],
];

export async function editSteam(row, onDone) {
  const fields = [
    { key: 'date', label: 'Date', type: 'date', default: todayISO, required: true },
    { key: 'time', label: 'Time', type: 'time', default: nowHM },
    { key: 'event', label: 'What happened', type: 'select', options: EVENTS, default: 'check' },
    { key: 'water_level', label: 'Water level', type: 'select', options: LEVELS },
    { key: 'pressure_psi', label: 'Pressure (psi)', type: 'num' },
    { key: 'notes', label: 'Notes', type: 'textarea', help: 'Noises, cold radiators, vents, water added.' },
    { key: 'photos', label: 'Photos', type: 'files', parentKind: 'general' },
  ];
  return openForm({
    title: row && row.id ? 'Edit entry' : 'New steam entry', fields, values: row || {},
    async onSubmit(out) { const r = await HB.save('steam_log', { ...(row || {}), ...out, photos: encodeFiles(out.photos) }); onDone && onDone(r); },
    onDelete: row && row.id ? async () => { await HB.remove('steam_log', row.id); } : null,
  });
}

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// Pressure line for the last N entries that have a pressure, with dots for water level below.
export function trendChart(entries) {
  const pts = entries.filter(e => e.pressure_psi !== '' && e.pressure_psi != null && !isNaN(e.pressure_psi)).slice(-20);
  const W = 320, H = 100, P = 14;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rec-sparkline', role: 'img', 'aria-label': 'Pressure trend for recent entries' });
  if (pts.length < 2) {
    const t = sv('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': '12' });
    t.textContent = 'Log two or more pressure readings to see a trend.';
    svg.append(t); return svg;
  }
  const vals = pts.map(p => Number(p.pressure_psi));
  const max = Math.max(3, ...vals), min = 0;
  const x = i => P + (W - 2 * P) * i / (pts.length - 1);
  const y = v => H - P - (H - 2 * P) * (v - min) / (max - min);
  svg.append(sv('line', { x1: P, x2: W - P, y1: y(2), y2: y(2), stroke: 'currentColor', 'stroke-opacity': '.35', 'stroke-dasharray': '4 3' }));
  const lab = sv('text', { x: W - P, y: y(2) - 3, 'text-anchor': 'end', fill: 'currentColor', 'font-size': '9', opacity: '.7' }); lab.textContent = '2 psi'; svg.append(lab);
  svg.append(sv('polyline', { points: vals.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: 'var(--accent, #0f6a78)', 'stroke-width': '2' }));
  pts.forEach((p, i) => {
    const c = sv('circle', { cx: x(i), cy: y(Number(p.pressure_psi)), r: 3.5, fill: Number(p.pressure_psi) > 2 ? 'var(--bad, #a22a2a)' : 'var(--accent, #0f6a78)' });
    const t = sv('title'); t.textContent = `${fmtDate(p.date)}: ${p.pressure_psi} psi`; c.append(t); svg.append(c);
  });
  return svg;
}

function levelStrip(entries) {
  const recent = entries.slice(-14);
  if (!recent.length) return null;
  const color = { low: 'var(--bad, #a22a2a)', normal: 'var(--good, #1d6a39)', high: 'var(--warn, #8a5200)' };
  return h('div', { class: 'rec-row', 'aria-label': 'Recent water levels' }, recent.map(e =>
    h('span', { class: 'rec-badge', style: `background:${color[e.water_level] || 'var(--surface-2,#eef2f4)'};color:${color[e.water_level] ? '#fff' : 'inherit'}`, title: `${fmtDate(e.date)}: ${LEVEL_LABEL[e.water_level] || 'not checked'}` }, (LEVEL_LABEL[e.water_level] || '-').slice(0, 1))));
}

function build(rt, data) {
  const body = h('div', { class: 'rec-view' });
  const checks = (() => { try { return JSON.parse(lsGet('hb.steam.checks', '{}')) || {}; } catch { return {}; } })();
  const list = h('div'), trend = h('div');
  function update() {
    const all = (data.steam_log || []).slice().sort((a, b) => String(a.date + (a.time || '')).localeCompare(String(b.date + (b.time || ''))));
    const last = all[all.length - 1];
    trend.replaceChildren(
      last ? h('p', { class: 'rec-muted' }, `Latest: ${fmtDate(last.date)}${last.time ? ' ' + last.time : ''}. Water ${LEVEL_LABEL[last.water_level] ? LEVEL_LABEL[last.water_level].toLowerCase() : 'not checked'}${last.pressure_psi !== '' && last.pressure_psi != null ? `, ${last.pressure_psi} psi` : ''}.`) : null,
      trendChart(all), levelStrip(all));
    if (!all.length) { list.replaceChildren(emptyState('No entries yet', 'Log the sight glass and gauge every few days in the heating season, and any time something sounds wrong.')); return; }
    list.replaceChildren(h('div', { class: 'rec-list' }, all.slice().reverse().slice(0, 60).map(e => h('button', { type: 'button', class: 'rec-item', onclick: () => editSteam(e) },
      h('span', { class: 'rec-grow' },
        h('span', { class: 'rec-title' }, `${fmtDate(e.date)}${e.time ? ' ' + e.time : ''} - ${EVENT_LABEL[e.event] || e.event || 'Entry'}`),
        h('span', { class: 'rec-sub' }, [e.water_level ? 'Water ' + (LEVEL_LABEL[e.water_level] || e.water_level).toLowerCase() : '', e.pressure_psi !== '' && e.pressure_psi != null ? e.pressure_psi + ' psi' : '', e.notes].filter(Boolean).join(' / ')),
        thumbStrip(parseFilesValue(e.photos), 'Steam photo')),
      e.event === 'problem' ? badge('Problem', 'rec-bad') : null))));
  }
  const checklist = h('ul', { class: 'rec-check-list' }, CHECKLIST.map(([k, text]) => h('li', null, h('label', null,
    h('input', { type: 'checkbox', checked: !!checks[k], onchange: e => { checks[k] = e.target.checked; lsSet('hb.steam.checks', JSON.stringify(checks)); } }), text))));
  body.append(
    pageHead('Steam heat', h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editSteam(null) }, 'New entry')),
    h('div', { class: 'rec-note' }, h('p', null, 'Boiler, burner, gas, and flue work is for a licensed pro. This log is for watching and noticing.')),
    h('div', { class: 'rec-two' },
      panel('Recent trend', trend),
      panel('What to look for', checklist, h('button', { class: 'rec-btn rec-small', type: 'button', onclick: () => { for (const k of Object.keys(checks)) checks[k] = false; lsSet('hb.steam.checks', '{}'); body.querySelectorAll('.rec-check-list input').forEach(i => { i.checked = false; }); } }, 'Reset ticks'))),
    panel('Log', list));
  return { node: body, refresh: update };
}

register({ id: 'steam', title: 'Steam', icon: 'flame', order: 70, render(container) { return mountView(container, ['steam_log'], build); } });
