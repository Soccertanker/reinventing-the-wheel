import {
  insightFor,
  insightMultiplier,
  lifespanGy,
  piQuality,
  pumpCost,
  timeSpeed,
  type CosmosParams,
  type CosmosState,
} from '../../core/mechanics/cosmos';
import { bar, h, setDisabled, setRange, setText } from '../dom';
import { fmt, fmtRate } from '../format';
import type { MountView } from './types';
import { wheelSvg } from './wheelArt';

/** What civilizations will build with this pi. */
function shapeFor(q: number): { sides: number; name: string } {
  if (q > 0.97) return { sides: 0, name: 'perfectly round wheels' };
  if (q > 0.6) return { sides: 16, name: 'slightly bumpy wheels' };
  if (q > 0.25) return { sides: 10, name: 'decagons (they roll, reluctantly)' };
  if (q > 0.05) return { sides: 6, name: 'hexagons (they do not roll)' };
  return { sides: 4, name: 'squares. Proud, stationary squares.' };
}

export const mountCosmos: MountView = (root, era, api) => {
  const c = era.config as CosmosParams;
  const wheels = h('span');
  const insight = h('span');
  const pi = h('input', {
    type: 'range',
    min: 3,
    max: 3.3,
    step: 0.0001,
    oninput: (e) => api.act({ type: 'pi', value: Number((e.target as HTMLInputElement).value) }),
  });
  const piVal = h('strong');
  const grav = h('input', {
    type: 'range',
    min: -1,
    max: 1,
    step: 0.01,
    oninput: (e) => api.act({ type: 'gravity', value: Number((e.target as HTMLInputElement).value) }),
  });
  const gravVal = h('strong');
  const art = wheelSvg();
  const shape = h('div');
  const life = h('div', { class: 'muted' });
  const bang = h('button', { class: 'big', onclick: () => (api.tap(), api.act({ type: 'bang' })) }, 'BIG BANG');
  const crunch = h('button', { onclick: () => (api.tap(), api.act({ type: 'crunch' })) });

  const uTitle = h('strong');
  const age = bar();
  const uInfo = h('p', { class: 'muted' });

  const pump = h('button', { onclick: () => api.act({ type: 'buyPump' }) });
  const daemon = h('button', { onclick: () => api.act({ type: 'buyDaemon' }) });

  root.append(
    h('p', { class: 'count' }, wheels, ' cosmic wheels'),
    h('p', { class: 'muted' }, 'Insight ×', insight, ' (from crunched universes)'),
    h(
      'div',
      { class: 'panel' },
      h('h3', {}, 'Constants for the next universe'),
      h('label', { class: 'knob' }, h('span', {}, 'π = ', piVal), pi),
      h('label', { class: 'knob' }, h('span', {}, 'Gravity = ', gravVal), grav),
      h('div', { class: 'lab-result' }, art.el, h('div', {}, h('small', { class: 'muted' }, 'Civilizations will invent:'), shape, life)),
      h('div', { class: 'row' }, bang, crunch),
    ),
    h('div', { class: 'panel' }, uTitle, age.el, uInfo),
    h('div', { class: 'row' }, pump, daemon),
  );

  return {
    update(st, bonus) {
      const s = st as CosmosState;
      setText(wheels, fmt(s.wheels));
      setText(insight, fmtRate(insightMultiplier(s)));
      setRange(pi, s.pi);
      setText(piVal, s.pi.toFixed(4));
      setRange(grav, s.logGravity);
      const g = 10 ** s.logGravity;
      setText(gravVal, `${g.toFixed(2)}g`);
      const q = piQuality(s.pi, c.piTolerance);
      const sh = shapeFor(q);
      art.draw(0, 0, sh.sides);
      setText(shape, sh.name);
      const span = lifespanGy(c, g);
      setText(
        life,
        span < c.starsAtGy
          ? `Lifespan ${span.toFixed(2)} billion years: collapses before the first star.`
          : span < c.civsAtGy
            ? `Lifespan ${span.toFixed(1)} billion years: life, but no time for civilizations.`
            : `Lifespan ${span.toFixed(1)} billion years: room for civilizations.`,
      );

      const u = s.universe;
      setDisabled(bang, !!u?.alive);
      setText(bang, u?.alive ? 'Universe in progress' : 'BIG BANG');
      setDisabled(crunch, !u);
      setText(crunch, u ? `Big Crunch (+${insightFor(c, u.wheels).toFixed(2)} insight)` : 'Big Crunch');
      if (u) {
        setText(uTitle, `Universe #${s.universes} ${u.alive ? '' : '(dead)'}`);
        age.set(u.age / Math.max(u.lifespan, 0.001), u.alive ? '' : 'warn');
        setText(
          uInfo,
          `Age ${u.age.toFixed(1)} / ${u.lifespan.toFixed(1)} billion years · ${fmt(u.civs)} civilizations · ${fmt(u.wheels)} wheels · ` +
            `${fmtRate(u.civs * c.wheelsPerCiv * piQuality(u.pi, c.piTolerance) * insightMultiplier(s) * bonus)}/s · ` +
            `time flows at ${fmtRate(timeSpeed(c, s))} Gy/s`,
        );
      } else {
        setText(uTitle, 'No universe. Just you, and the void, and a strong opinion about wheels.');
        age.set(0);
        setText(uInfo, '');
      }
      const pc = pumpCost(c, s);
      setText(pump, `${c.pump.name} #${s.pumps + 1}: time ×${c.pump.speedup} (${fmt(pc)})`);
      setDisabled(pump, s.wheels < pc);
      setText(daemon, s.daemon ? `${c.daemon.name}: running` : `${c.daemon.name}: auto Crunch + Bang (${fmt(c.daemon.cost)})`);
      setDisabled(daemon, s.daemon || s.wheels < c.daemon.cost);
    },
  };
};
