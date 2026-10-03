// Home: the landing screen. Today, things running out, active projects, last steam entry, weather status, setup checklist.
// Replaces S2's placeholder Home (same id). Reads only through HB.list; never writes except the checklist "hide" flag in localStorage.
import { registerView, getView, listViews } from '../core/router.js';
import { h, money, fmtDate as fmtD } from '../core/ui.js';
import * as HB from '../core/data.js';
import { expiring, setupChecklist, progress, lastSteam, alertLine, activeProjects, parseJson } from './home-logic.js';

const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const fmt = s => (typeof fmtD === 'function' ? fmtD(s) : s);

let recurPromise = null;
const loadRecur = () => (recurPromise = recurPromise || import('../core/recur.js').catch(() => null));

function link(id, label, cls = 'btn small') {
  const exists = Boolean(getView(id));
  return exists ? h('a', { class: cls, href: '#/' + id }, label) : null;
}
const when = days => days == null ? '' : days < 0 ? `${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

function panel(title, body, action) {
  return h('section', { class: 'panel home-panel' }, h('header', null, h('h3', null, title), action || null), body);
}
const empty = text => h('p', { class: 'muted' }, text);

export function render(container) {
  let alive = true;
  const root = h('div', { class: 'list home-root' });
  container.replaceChildren(root);
  const tables = ['tasks', 'task_log', 'assets', 'documents', 'consumables', 'projects', 'steam_log', 'shutoffs', 'rooms', 'settings'];
  const unsubs = [];
  let timer = null;

  async function draw() {
    const [data, recur] = await Promise.all([
      Promise.all(tables.map(t => HB.list(t).catch(() => []))).then(r => Object.fromEntries(tables.map((t, i) => [t, r[i]]))),
      loadRecur(),
    ]);
    if (!alive) return;
    const today = todayISO();
    const setting = key => { const r = data.settings.find(s => s.id === key || s.key === key); return r ? parseJson(r.value, null) : null; };
    const house = setting('house');
    const st = HB.status ? HB.status() : { pending: 0 };

    // ---- today's tasks
    let overdue = [], due = [];
    if (recur) {
      for (const t of data.tasks) {
        if (Number(t.active) === 0) continue;
        const s = recur.taskStatus(t, data.task_log.filter(l => l.task === t.id), today);
        if (s.state === 'overdue') overdue.push({ t, s }); else if (s.state === 'due') due.push({ t, s });
      }
      overdue.sort((a, b) => b.s.overdueDays - a.s.overdueDays);
      due.sort((a, b) => (a.s.days ?? 0) - (b.s.days ?? 0));
    }
    const taskRow = ({ t, s }, cls) => h('a', { class: 'item ' + cls, href: '#/maintenance' },
      h('span', { class: 'title' }, t.title),
      h('span', { class: 'muted' }, cls === 'over' ? `Overdue ${s.overdueDays} day${s.overdueDays === 1 ? '' : 's'}` : s.windowEnd ? `Season ends ${fmt(s.windowEnd)}` : `Due ${when(s.days)}`, t.pro_only && Number(t.pro_only) ? ' · licensed pro' : ''));
    const todayBody = !recur ? empty('The maintenance schedule is not installed yet.')
      : (!overdue.length && !due.length) ? empty(data.tasks.length ? 'Nothing due. Nice.' : 'No tasks yet. Open Maintenance to load the starter list.')
        : h('div', { class: 'list' }, overdue.slice(0, 6).map(x => taskRow(x, 'over')), due.slice(0, 6).map(x => taskRow(x, 'due')),
          overdue.length + due.length > 12 ? h('p', { class: 'muted' }, `and ${overdue.length + due.length - 12} more`) : null);

    // ---- expiring
    const exp = expiring({ assets: data.assets, documents: data.documents }, today);
    const expBody = exp.length ? h('div', { class: 'list' }, exp.slice(0, 6).map(x => h('a', { class: 'item ' + (x.days < 0 ? 'over' : 'due'), href: '#/' + (x.table === 'assets' ? 'assets' : 'documents') },
      h('span', { class: 'title' }, x.title), h('span', { class: 'muted' }, `${x.kind === 'warranty' ? 'Warranty' : x.kind === 'insurance' ? 'Insurance' : 'Document'} ${x.days < 0 ? 'expired' : 'expires'} ${fmt(x.date)}`)))) : null;

    // ---- low consumables
    const lowRows = recur ? data.consumables.map(c => ({ c, s: recur.consumableStatus(c, today) })).filter(x => x.s.low || x.s.state !== 'ok')
      .sort((a, b) => (a.s.days ?? 9999) - (b.s.days ?? 9999)) : [];
    const lowBody = lowRows.length ? h('div', { class: 'list' }, lowRows.slice(0, 6).map(({ c, s }) => h('a', { class: 'item ' + (s.state === 'overdue' || s.low ? 'over' : 'due'), href: '#/consumables' },
      h('span', { class: 'title' }, c.name), h('span', { class: 'muted' }, [c.spec, s.low ? 'none on hand' : null, s.next ? `replace ${when(s.days)}` : null].filter(Boolean).join(' · '))))) : null;

    // ---- projects, steam, alerts
    const projs = activeProjects(data.projects);
    const projBody = projs.length ? h('div', { class: 'list' }, projs.slice(0, 5).map(p => h('a', { class: 'item', href: '#/projects' }, h('span', { class: 'title' }, p.name),
      h('span', { class: 'muted' }, [p.priority, Number(p.pro) ? 'licensed pro' : '', p.budget ? money(p.budget) : ''].filter(Boolean).join(' · '))))) : empty('No active projects.');
    const steam = lastSteam(data.steam_log);
    const steamBody = steam ? h('a', { class: 'item', href: '#/steam' }, h('span', { class: 'title' }, `${fmt(steam.date)}${steam.time ? ' ' + steam.time : ''} · ${steam.event || 'check'}`),
      h('span', { class: 'muted' }, [steam.water_level && `water ${steam.water_level}`, steam.pressure_psi !== '' && steam.pressure_psi != null && `${steam.pressure_psi} psi`, steam.notes].filter(Boolean).join(' · ') || 'No details'))
      : empty('No steam log entries yet.');
    const al = alertLine(setting('alerts'), setting('notify'));

    // ---- checklist
    const items = setupChecklist({ assets: data.assets, shutoffs: data.shutoffs, rooms: data.rooms, documents: data.documents, house });
    const pr = progress(items);
    const hidden = lsGet('hb.home.checklist') === 'hide' && pr.done < pr.total;
    const check = h('section', { class: 'panel home-panel' },
      h('header', null, h('h3', null, 'Set up the house'), h('span', { class: 'chip ' + (pr.done === pr.total ? 'good' : 'acc') }, `${pr.done} of ${pr.total}`)),
      h('div', { class: 'home-bar', role: 'progressbar', 'aria-valuenow': pr.pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Setup progress' }, h('span', { style: `width:${pr.pct}%` })),
      hidden ? h('button', { type: 'button', class: 'btn small', onclick: () => { lsSet('hb.home.checklist', 'show'); draw(); } }, 'Show the checklist')
        : h('div', { class: 'list' }, items.map(i => {
          const view = getView(i.to);
          const row = h(view ? 'a' : 'div', { class: 'item home-step' + (i.done ? ' done' : ''), href: view ? '#/' + i.to : null },
            h('span', { class: 'home-check', 'aria-hidden': 'true' }, i.done ? '✓' : ''),
            h('span', { class: 'title' }, i.label), i.done ? h('span', { class: 'muted' }, 'Done') : h('span', { class: 'muted' }, i.hint));
          return row;
        }),
        pr.done < pr.total ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => { lsSet('hb.home.checklist', 'hide'); draw(); } }, 'Hide this for now') : null));

    const sections = listViews().filter(v => v.id !== 'home' && v.id !== 'visuals');
    root.replaceChildren(
      h('section', { class: 'panel home-panel' },
        h('header', null, h('h1', null, 'House Bible'), h('span', { class: 'eyebrow' }, '353 WASHINGTON ST')),
        st.pending ? h('p', { class: 'banner' }, `${st.pending} change${st.pending === 1 ? '' : 's'} saved on this device, waiting to sync.`) : null,
        h('p', { class: 'banner ' + (al.level === 'good' ? '' : 'warn') }, al.text)),
      panel('Today', todayBody, link('maintenance', 'Maintenance')),
      expBody ? panel('Expiring', expBody) : null,
      lowBody ? panel('Running low or due', lowBody, link('consumables', 'Supplies')) : null,
      panel('Active projects', projBody, link('projects', 'Projects')),
      panel('Last steam log entry', steamBody, link('steam', 'Steam log')),
      check,
      sections.length ? panel('Sections', h('div', { class: 'grid' }, sections.map(v => h('a', { class: 'item tile', href: '#/' + v.id }, h('span', { class: 'title' }, v.title))))) : null);
  }

  const redraw = () => { clearTimeout(timer); timer = setTimeout(() => draw().catch(console.error), 60); };
  for (const t of tables) { try { unsubs.push(HB.subscribe(t, redraw)); } catch { /* table unknown to this data layer */ } }
  if (HB.onStatus) unsubs.push(HB.onStatus(redraw));
  if (!document.getElementById('home-css')) {
    const l = h('link', { rel: 'stylesheet', id: 'home-css', href: new URL('../../css/home.css', import.meta.url).href });
    document.head.append(l);
  }
  draw().catch(e => { console.error(e); root.replaceChildren(h('p', { class: 'banner bad' }, 'Could not load the home screen.')); });
  return () => { alive = false; clearTimeout(timer); unsubs.forEach(u => { try { u(); } catch { /* ignore */ } }); };
}

registerView({ id: 'home', title: 'Home', icon: 'home', order: 0, render });
