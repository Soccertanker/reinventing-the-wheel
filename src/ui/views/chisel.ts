import {
  corners,
  cornersPerSecond,
  cornersPerTap,
  startSides,
  upgradeCost,
  wheelsPerSecond,
  type ChiselParams,
  type ChiselState,
} from '../../core/mechanics/chisel';
import { h, setDisabled, setText } from '../dom';
import { fmt, fmtRate } from '../format';
import type { MountView } from './types';
import { wheelSvg } from './wheelArt';

export const mountChisel: MountView = (root, era, api) => {
  const c = era.config as ChiselParams;
  const wheels = h('span');
  const rate = h('span');
  const art = wheelSvg();
  const rock = h('button', { class: 'rock', 'aria-label': 'Chisel the rock', onclick: () => (api.tap(), api.act({ type: 'tap' })) }, art.el);
  const progress = h('p', { class: 'muted' });
  const rows = c.upgrades.map((u) => {
    const owned = h('span', { class: 'owned' });
    const btn = h('button', { onclick: () => api.act({ type: 'buy', id: u.id }) });
    const li = h('li', {}, h('div', {}, h('strong', {}, u.name), ' ', owned, h('small', {}, u.description)), btn);
    return { u, owned, btn, li };
  });
  root.append(
    h('p', { class: 'count' }, wheels, ' wheels'),
    h('p', { class: 'muted' }, rate, ' / sec'),
    rock,
    progress,
    h('ul', { class: 'shop' }, ...rows.map((r) => r.li)),
  );
  return {
    update(st, bonus) {
      const s = st as ChiselState;
      setText(wheels, fmt(s.wheels));
      setText(rate, fmtRate(wheelsPerSecond(c, s, bonus)));
      const sides = Math.floor(s.sides);
      art.draw(0, 0, sides >= c.roundAt - 1 ? 0 : sides);
      const left = Math.max(0, Math.ceil(c.roundAt - s.sides));
      setText(
        progress,
        `${sides}-sided rock · ${left} corner${left === 1 ? '' : 's'} to go · ${fmtRate(cornersPerTap(c, s) * bonus)} per tap` +
          (cornersPerSecond(c, s) ? ` · ${fmtRate(cornersPerSecond(c, s) * bonus)}/s automatic` : '') +
          ` · ${corners(c, s)} corners per wheel (rocks start at ${startSides(c, s)} sides)`,
      );
      for (const r of rows) {
        const n = s.owned[r.u.id] ?? 0;
        const maxed = r.u.max !== undefined && n >= r.u.max;
        const cost = upgradeCost(r.u, s);
        setText(r.btn, maxed ? 'maxed' : `${fmt(cost)} wheels`);
        setDisabled(r.btn, maxed || s.wheels < cost);
        setText(r.owned, n ? `×${n}` : '');
        r.li.classList.toggle('hidden', !n && s.made < r.u.baseCost * 0.5);
      }
    },
  };
};
