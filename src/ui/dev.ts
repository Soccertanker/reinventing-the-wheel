/**
 * Dev/test panel, shown when the URL has ?dev. Lets testers skip the grind on preview builds:
 * time warp, free wheels, finish an era, unlock everything, reset.
 */
import { advanceBy, goalFor } from '../core/engine';
import type { Era } from '../core/eras';
import type { GameState } from '../core/state';
import { h } from './dom';

export interface DevHooks {
  get(): GameState;
  set(s: GameState): void;
  reset(): Promise<void>;
}

export const devEnabled = new URLSearchParams(location.search).has('dev');

export function mountDev(eras: readonly Era[], hooks: DevHooks): { warp: () => number } {
  let warp = 1;
  const era = () => eras.find((e) => e.id === hooks.get().currentEra);
  const mutate = (fn: (s: GameState) => void) => {
    const s = structuredClone(hooks.get());
    fn(s);
    hooks.set(advanceBy(s, eras, 250)); // one tick so goals/unlocks are processed
  };
  const warpBtns = [1, 10, 100, 1000].map((w) =>
    h('button', {
      class: w === 1 ? 'on' : '',
      onclick: (e) => {
        warp = w;
        for (const b of warpBtns) b.classList.toggle('on', b === e.currentTarget);
      },
    }, `×${w}`),
  );
  const panel = h(
    'details',
    { class: 'dev' },
    h('summary', {}, 'dev'),
    h('div', { class: 'row' }, h('small', {}, 'time'), ...warpBtns),
    h(
      'div',
      { class: 'row' },
      h('button', {
        onclick: () =>
          mutate((s) => {
            const e = era();
            const st = e && s.eras[e.id];
            if (e && st) {
              const n = Math.ceil(goalFor(s, e) / 10);
              st.wheels += n;
              st.made += n;
            }
          }),
      }, '+10% goal'),
      h('button', {
        onclick: () =>
          mutate((s) => {
            const e = era();
            const st = e && s.eras[e.id];
            if (e && st) st.made = Math.max(st.made, goalFor(s, e));
          }),
      }, 'finish era'),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', {
        onclick: () => {
          // Finish every era except the last, so the final goal is still there to play.
          for (let i = 0; i < eras.length - 1; i++) {
            mutate((s) => {
              const e = eras.find((x) => s.unlocked.includes(x.id) && !s.completed.includes(x.id));
              const st = e && s.eras[e.id];
              if (e && st) st.made = Math.max(st.made, goalFor(s, e));
            });
          }
        },
      }, 'unlock all'),
      h('button', {
        onclick: () => {
          if (confirm('Reset this save?')) void hooks.reset();
        },
      }, 'reset'),
    ),
  );
  document.body.append(panel);
  return { warp: () => warp };
}
