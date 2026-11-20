import { producerCost, producersRate, type ProducersParams, type ProducersState } from '../../core/mechanics/producers';
import { h, setDisabled, setText } from '../dom';
import { fmt, fmtRate } from '../format';
import type { MountView } from './types';

export const mountProducers: MountView = (root, era, api) => {
  const c = era.config as ProducersParams;
  const wheels = h('span');
  const rate = h('span');
  const click = h('button', { class: 'big', onclick: () => (api.tap(), api.act({ type: 'click' })) }, c.clickLabel);
  const rows = c.producers.map((p) => {
    const owned = h('span', { class: 'owned' });
    const btn = h('button', { onclick: () => api.act({ type: 'buy', id: p.id }) });
    const li = h('li', {}, h('div', {}, h('strong', {}, p.name), ' ', owned, h('small', {}, `${p.description} (+${fmtRate(p.wheelsPerSecond)}/s)`)), btn);
    return { p, owned, btn, li };
  });
  root.append(
    h('p', { class: 'count' }, wheels, ' wheels'),
    h('p', { class: 'muted' }, rate, ' / sec'),
    click,
    h('ul', { class: 'shop' }, ...rows.map((r) => r.li)),
  );
  return {
    update(st, bonus) {
      const s = st as ProducersState;
      setText(wheels, fmt(s.wheels));
      setText(rate, fmtRate(producersRate(s, c, bonus)));
      for (const r of rows) {
        const cost = producerCost(r.p, s);
        setText(r.btn, `${fmt(cost)} wheels`);
        setDisabled(r.btn, s.wheels < cost);
        const n = s.owned[r.p.id] ?? 0;
        setText(r.owned, n ? `×${n}` : '');
        r.li.classList.toggle('hidden', !n && s.made < r.p.baseCost * 0.5);
      }
    },
  };
};
