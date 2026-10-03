// Projects: pile, order (sequencing), shopping, tool check, and project detail.
import { registerView } from '../core/router.js';
import { HB, HBui, h, panel, btn, chip, empty, banner, tabBar, inp, money0, ensureCss, watchTables, idMap } from './projects-common.js';
import { materialsSection, shoppingView } from './materials.js';
import { editExpense } from './expenses.js';
import { editTool } from './tools.js';
import {
  PRIORITIES, STATUSES, SEASONS, isOn, isOpen, num0, toNum, projectDeps, projectSteps, projectTools, withTools,
  materialsEstimate, projectSpent, sequence, toolCheck, ownsTool,
} from '../core/plan.js';

const PRIO = { Safety: 0, Damage: 1, Comfort: 2, Cosmetic: 3 };
const STATUS_ORDER = { active: 0, planned: 1, idea: 2, done: 3, dropped: 4 };
const prioClass = p => p === 'Safety' ? 'bad' : p === 'Damage' ? 'warn' : '';
const statusClass = s => s === 'done' ? 'good' : s === 'active' ? 'acc' : '';
const stepsJson = steps => JSON.stringify(steps.map(s => ({ t: s.t, d: s.d ? 1 : 0 })));

function editProject(p, onDone) {
  const v = p ? { ...p, pro: isOn(p.pro) ? 'Pro' : 'DIY', capital_improvement: isOn(p.capital_improvement) ? 'Yes' : 'No' }
    : { status: 'idea', priority: 'Comfort', pro: 'DIY', season: 'Year-round', capital_improvement: 'No' };
  HBui.openForm({
    title: p ? 'Edit project' : 'New project',
    values: v,
    fields: [
      { k: 'name', label: 'Project name', wide: true, placeholder: 'Re-pitch radiators' },
      { k: 'status', label: 'Status', type: 'select', options: STATUSES },
      { k: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
      { k: 'pro', label: 'Who does it', type: 'select', options: ['DIY', 'Pro'] },
      { k: 'season', label: 'Best season', type: 'select', options: SEASONS },
      { k: 'room', label: 'Room', type: 'ref', table: 'rooms' },
      { k: 'budget', label: 'Budget ($)', type: 'number' },
      { k: 'capital_improvement', label: 'Capital improvement', type: 'select', options: ['No', 'Yes'] },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: async out => {
      if (!String(out.name || '').trim()) { HBui.toast('Name the project'); return false; }
      const row = await HB.save('projects', {
        ...(p ? { id: p.id } : { deps: '[]', steps: '[]', parts: '{"tools":[]}' }),
        ...out, name: out.name.trim(), pro: out.pro === 'Pro' ? 1 : 0, capital_improvement: out.capital_improvement === 'Yes' ? 1 : 0,
      });
      onDone(row);
    },
    onDelete: p ? async () => {
      await HB.remove('projects', p.id);
      // Other projects no longer wait on a deleted one.
      for (const o of await HB.list('projects')) if (projectDeps(o).includes(p.id)) await HB.save('projects', { id: o.id, deps: JSON.stringify(projectDeps(o).filter(d => d !== p.id)) });
      onDone(null);
    } : null,
  });
}

registerView({
  id: 'projects', title: 'Projects', icon: 'hammer', order: 40,
  render(container, ctx) {
    ensureCss();
    const st = { tab: 'list', pid: ctx?.params?.id || null, showClosed: false };
    if (st.pid) st.tab = 'detail';

    const load = async () => {
      const [projects, materials, expenses, tools, rooms] = await Promise.all(['projects', 'materials', 'expenses', 'tools', 'rooms'].map(t => HB.list(t)));
      return { projects, materials, expenses, tools, rooms, roomNames: idMap(rooms) };
    };
    const go = (tab, pid = null) => { st.tab = tab; st.pid = pid; draw(); container.scrollIntoView?.(); };

    function card(p, d) {
      const est = materialsEstimate(d.materials.filter(m => m.project === p.id)), spent = projectSpent(p.id, d.expenses), b = num0(p.budget);
      const steps = projectSteps(p), done = steps.filter(s => s.d).length;
      const deps = projectDeps(p).filter(x => d.projects.some(q => q.id === x && isOpen(q)));
      return h('div', { class: 's5-item s5-click', tabindex: '0', role: 'button', onclick: () => go('detail', p.id), onkeydown: e => { if (e.key === 'Enter') go('detail', p.id); } },
        h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, p.name), chip(p.status, statusClass(p.status))),
        h('div', { class: 's5-row' }, chip(p.priority, prioClass(p.priority)), chip(isOn(p.pro) ? 'Pro' : 'DIY'), chip(p.season),
          p.room ? chip(d.roomNames.get(p.room) || 'Room') : null, steps.length ? chip(`${done}/${steps.length} steps`) : null, deps.length ? chip(`after ${deps.length}`) : null),
        (b || spent) ? h('div', null,
          b ? h('div', { class: 's5-bar' + (spent > b ? ' over' : '') }, h('i', { style: `width:${Math.min(100, spent / b * 100)}%` })) : null,
          h('span', { class: 's5-muted s5-mono' }, `${money0(spent)} spent${b ? ' of ' + money0(b) + ' budget' : ''}${est ? ' - est. ' + money0(est) + ' to buy' : ''}`)) : null);
    }

    function listView(d) {
      const sorted = d.projects.filter(p => st.showClosed || isOpen(p)).sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9) || String(a.name).localeCompare(String(b.name)));
      const closed = d.projects.length - d.projects.filter(isOpen).length;
      return panel('Project pile', btn('New project', () => editProject(null, row => row && go('detail', row.id)), 'primary small'),
        sorted.length ? h('div', { class: 's5-list' }, sorted.map(p => card(p, d))) : empty('Nothing here yet. Add every project you are thinking about, then use Order to sequence them.'),
        closed ? h('label', { class: 's5-check s5-top' }, h('input', { type: 'checkbox', checked: st.showClosed ? true : null, onchange: e => { st.showClosed = e.target.checked; draw(); } }), `Show done and dropped (${closed})`) : null);
    }

    function orderView(d) {
      const { phases, cycles, blocked } = sequence(d.projects);
      const kids = [banner('A project waits for everything it depends on. Within a phase: Safety, Damage, Comfort, Cosmetic, then best season. Done and dropped projects drop out.')];
      if (cycles.length) kids.push(banner('Circular dependency: ' + cycles.map(c => c.map(p => p.name).join(' and ')).join('; ') + '. Open one of them and remove a "must happen first" item.', true));
      if (blocked.length) kids.push(banner('Waiting on a circular chain: ' + blocked.map(p => p.name).join(', ') + '.', true));
      if (!phases.length && !cycles.length) kids.push(empty('No open projects to order.'));
      const byId = new Map(d.projects.map(p => [p.id, p]));
      phases.forEach((ps, i) => kids.push(panel(`Phase ${i + 1}`, null, h('div', { class: 's5-list' }, ps.map(p => {
        const after = projectDeps(p).map(x => byId.get(x)).filter(x => x && isOpen(x));
        return h('div', null, card(p, d), after.length ? h('div', { class: 's5-muted s5-after' }, 'After: ' + after.map(a => a.name).join(', ')) : null);
      })))));
      return h('div', { class: 's5-list' }, kids);
    }

    function toolsView(d) {
      const tc = toolCheck(d.projects, d.tools);
      return panel('Tool check', null,
        tc.length ? h('div', { class: 's5-list' }, tc.map(t => h('div', { class: 's5-item' },
          h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, t.name), chip(t.own ? 'Own' : 'Need', t.own ? 'good' : 'warn')),
          h('span', { class: 's5-muted' }, 'For ' + t.projects.join(', '))))) : empty('List tools inside a project and they are checked against your inventory here.'),
        h('p', { class: 's5-muted s5-top' }, 'Matching is by name. "Drill" matches "Cordless drill/driver". Add what you own on the Tools page.'));
    }

    /* ---------- detail ---------- */
    function detail(d) {
      const p = d.projects.find(x => x.id === st.pid);
      if (!p) { st.tab = 'list'; st.pid = null; return listView(d); }
      const refresh = () => draw();
      const steps = projectSteps(p);
      const saveSteps = async () => { await HB.save('projects', { id: p.id, steps: stepsJson(steps) }); };

      const stepsBox = h('div', { class: 's5-steps' });
      const drawSteps = () => {
        stepsBox.replaceChildren(...steps.map((s, i) => {
          const span = h('span', { class: s.d ? 'done' : '' }, s.t);
          return h('label', { class: 's5-step' },
            h('input', { type: 'checkbox', checked: s.d ? true : null, onchange: async e => { s.d = e.target.checked; span.className = s.d ? 'done' : ''; await saveSteps(); } }),
            span,
            h('button', { class: 's5-btn small', type: 'button', 'aria-label': 'Remove step ' + s.t, onclick: async ev => { ev.preventDefault(); steps.splice(i, 1); await saveSteps(); drawSteps(); } }, '×'));
        }));
        if (!steps.length) stepsBox.append(empty('No steps yet. Add the outline of the job.'));
      };
      drawSteps();
      const newStep = h('input', { placeholder: 'Add a step, press Enter', 'aria-label': 'New step', onkeydown: async e => { if (e.key === 'Enter' && e.target.value.trim()) { steps.push({ t: e.target.value.trim(), d: false }); e.target.value = ''; await saveSteps(); drawSteps(); } } });

      const chosen = new Set(projectDeps(p));
      const others = d.projects.filter(o => o.id !== p.id && (isOpen(o) || chosen.has(o.id))).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const depBox = h('div', { class: 's5-list' }, others.length ? others.map(o => h('label', { class: 's5-check' },
        h('input', { type: 'checkbox', checked: chosen.has(o.id) ? true : null, onchange: async e => {
          e.target.checked ? chosen.add(o.id) : chosen.delete(o.id);
          await HB.save('projects', { id: p.id, deps: JSON.stringify([...chosen]) });
          const next = d.projects.map(q => q.id === p.id ? { ...q, deps: JSON.stringify([...chosen]) } : q);
          if (sequence(next).cycles.some(c => c.some(q => q.id === p.id))) HBui.toast('Circular: these projects now wait on each other.');
        } }), o.name + (isOpen(o) ? '' : ' (' + o.status + ')'))) : [empty('No other projects yet.')]);

      const tools = projectTools(p);
      const toolsBox = h('div', { class: 's5-row' });
      const saveTools = () => HB.save('projects', { id: p.id, parts: withTools(p, tools) });
      const drawTools = () => {
        toolsBox.replaceChildren(...tools.map((t, i) => {
          const own = ownsTool(t, d.tools);
          return h('span', { class: 's5-chip ' + (own ? 'good' : 'warn') }, `${t} - ${own ? 'own' : 'need'} `,
            own ? null : h('button', { type: 'button', class: 's5-link', onclick: () => editTool(null, { name: t, status: 'want' }, refresh) }, 'wishlist'),
            h('button', { type: 'button', class: 's5-link', 'aria-label': 'Remove ' + t, onclick: async () => { tools.splice(i, 1); await saveTools(); drawTools(); } }, '×'));
        }));
        if (!tools.length) toolsBox.append(empty('No tools listed.'));
      };
      drawTools();
      const newTool = h('input', { placeholder: 'Add a tool, press Enter', 'aria-label': 'New tool', onkeydown: async e => { if (e.key === 'Enter' && e.target.value.trim()) { tools.push(e.target.value.trim()); e.target.value = ''; await saveTools(); drawTools(); } } });

      const spend = d.expenses.filter(x => x.project === p.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const spent = projectSpent(p.id, d.expenses), b = toNum(p.budget);
      const closeBtn = isOpen(p) ? btn('Mark done', async () => { await HB.save('projects', { id: p.id, status: 'done' }); refresh(); }, 'small') : btn('Reopen', async () => { await HB.save('projects', { id: p.id, status: 'active' }); refresh(); }, 'small');

      return h('div', { class: 's5-list' },
        panel(null, null,
          h('div', { class: 's5-row spread' }, btn('‹ All projects', () => go('list'), 's5-btn small'), h('div', { class: 's5-row' }, closeBtn, btn('Edit details', () => editProject(p, row => row ? refresh() : go('list')), 'small'))),
          card(p, d), p.notes ? h('p', { class: 's5-muted s5-top' }, p.notes) : null,
          isOn(p.pro) ? h('p', { class: 's5-muted' }, 'Pro job. Gas, flue, main electrical, suspected asbestos or lead are always for a licensed pro.') : null),
        panel('Steps', null, stepsBox, h('div', { class: 's5-row s5-top' }, newStep)),
        panel('Must happen first', null, depBox),
        materialsSection(p, d.materials, refresh),
        panel('Tools needed', null, toolsBox, h('div', { class: 's5-row s5-top' }, newTool)),
        panel('Spending', btn('Add expense', () => editExpense(null, { project: p.id, capital_improvement: isOn(p.capital_improvement) ? 'Yes' : 'No' }, refresh), 'small primary'),
          spend.length ? h('div', { class: 's5-list' }, spend.map(x => h('div', { class: 's5-item s5-click', tabindex: '0', role: 'button', onclick: () => editExpense(x, {}, refresh) },
            h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, x.item), h('span', { class: 's5-mono' }, money0(x.amount))), h('span', { class: 's5-muted' }, [x.date, x.store].filter(Boolean).join(' - '))))) : empty('Nothing spent yet.'),
          h('div', { class: 's5-row spread s5-foot' }, h('span', { class: 's5-muted' }, b ? (spent > b ? `Over budget by ${money0(spent - b)}` : `${money0(b - spent)} left of ${money0(b)}`) : 'No budget set'), h('strong', { class: 's5-mono' }, 'Spent ' + money0(spent)))));
    }

    let seq = 0;
    async function draw() {
      const mine = ++seq;
      const d = await load();
      if (mine !== seq) return;
      const tabs = tabBar([['list', 'Projects'], ['order', 'Order'], ['shop', 'Shopping'], ['tools', 'Tool check']], st.tab === 'detail' ? 'list' : st.tab, k => go(k));
      let body;
      if (st.tab === 'detail') body = detail(d);
      else if (st.tab === 'order') body = orderView(d);
      else if (st.tab === 'shop') body = shoppingView(d.projects, d.materials);
      else if (st.tab === 'tools') body = toolsView(d);
      else body = listView(d);
      container.replaceChildren(h('div', { class: 's5-list' }, tabs, body));
    }
    // Detail redraws after every add/remove; save() promises resolve before the redraw reads again.
    draw();
    return watchTables(container, ['projects', 'materials', 'expenses', 'tools', 'rooms'], draw);
  },
});
