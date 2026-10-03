// Placeholder Home. S6 ships the real one as web/js/views/home*.js; registering id "home" replaces this.
import { registerView, listViews } from './router.js';
import { h } from './ui.js';
import * as HB from './data.js';
import { iconSvg } from './icons.js';

export function registerHomePlaceholder() {
  registerView({ id: 'home', title: 'Home', icon: 'home', order: 0, render(container) {
    const draw = () => {
      const others = listViews().filter(v => v.id !== 'home');
      const st = HB.status();
      container.replaceChildren(h('div', { class: 'list' },
        h('section', { class: 'panel' },
          h('header', null, h('h1', null, 'House Bible'), h('span', { class: 'eyebrow' }, '353 WASHINGTON ST')),
          h('p', null, 'Your home reference, upkeep schedule and records.'),
          st.pending ? h('p', { class: 'banner' }, `${st.pending} change${st.pending === 1 ? '' : 's'} saved on this device, waiting to sync.`) : null),
        others.length
          ? h('section', { class: 'panel' }, h('header', null, h('h3', null, 'Sections')),
            h('div', { class: 'grid' }, others.map(v => h('a', { class: 'item tile', href: '#/' + v.id }, h('span', { class: 'tile-icon', html: iconSvg(v.icon) }), h('span', { class: 'title' }, v.title)))))
          : h('section', { class: 'panel' }, h('p', { class: 'muted' }, 'No sections are installed yet. They appear here as they are added.'))));
    };
    draw();
    const off = HB.onStatus(() => draw());
    return off;
  } });
}
