import { act, advance, advanceBy, allComplete, bonusFor, eraTitle, goalFor, hydrate, lifetimeWheels, newGame, reinvent, switchEra } from '../core/engine';
import { meta } from '../core/meta';
import { eras, type Era } from '../core/eras';
import type { GameState } from '../core/state';
import { hapticTap, legacyStore, store } from '../platform';
import { registerServiceWorker } from '../platform/pwa';
import { loadGame, SAVE_KEY, saveGame } from '../platform/saveStore';
import { devEnabled, mountDev } from './dev';
import { bar, h, setText } from './dom';
import { fmt } from './format';
import { views } from './views';
import type { View } from './views/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let state: GameState = hydrate(await loadGame(store, legacyStore, Date.now(), () => newGame(eras, Date.now())), eras);
state = advance(state, eras, Date.now());

$('version').textContent = __APP_VERSION__;
const tabs = $('tabs');
const eraName = $('era-name');
const tagline = $('era-tagline');
const goalLabel = $('goal-label');
const goalBar = bar();
$('goal').append(goalBar.el);
const bonusEl = $('bonus');
const lifetime = $('lifetime');
const viewRoot = $('view');
const logList = $<HTMLUListElement>('log');
const loopEl = $('loop');
const reinventInfo = h('p', { class: 'muted' });
const reinventBox = h(
  'div',
  { class: 'panel reinvent hidden' },
  h('strong', {}, 'The wheel is complete.'),
  reinventInfo,
  h('button', {
    class: 'big',
    onclick: () => {
      if (!confirm('Start over from the Stone Age with a permanent multiplier?')) return;
      hapticTap();
      state = reinvent(state, eras);
      mountedEra = '';
      persist();
    },
  }, meta.button),
);
$('view').before(reinventBox);

const persist = () => void saveGame(store, state);

// ---- Era view (re-mounted when the player switches era) ----
let view: View | null = null;
let mountedEra = '';
function mountEra(era: Era) {
  viewRoot.replaceChildren();
  view = views[era.mechanic as keyof typeof views](viewRoot, era, {
    act: (a) => {
      state = act(state, eras, era.id, a);
    },
    tap: hapticTap,
  });
  mountedEra = era.id;
  document.documentElement.style.setProperty('--accent', era.accent);
  tabButtons.find((t) => t.era.id === era.id)?.b.scrollIntoView({ block: 'nearest', inline: 'center' });
  setText(eraName, eraTitle(state, era));
  setText(tagline, era.tagline);
}

// ---- Tabs ----
const tabButtons = eras.map((era) => {
  const b = h('button', {
    class: 'tab',
    onclick: () => {
      state = switchEra(state, era.id);
      persist();
    },
  });
  tabs.append(b);
  return { era, b };
});

let lastLogSeq = -1;
function renderLog() {
  if (state.logSeq === lastLogSeq) return;
  lastLogSeq = state.logSeq;
  const recent = state.log.slice(-8).reverse();
  logList.replaceChildren(
    ...recent.map((l) => {
      const e = eras.find((x) => x.id === l.era);
      const li = h('li', { class: l.era === state.currentEra ? 'here' : '' }, h('span', { class: 'dot', style: `background:${e?.accent ?? '#888'}` }), l.msg);
      return li;
    }),
  );
}

function render() {
  const era = eras.find((e) => e.id === state.currentEra) ?? eras[0];
  if (!era) return;
  if (era.id !== mountedEra) mountEra(era);
  setText(eraName, eraTitle(state, era));
  const st = state.eras[era.id];
  if (st && view) view.update(st, bonusFor(state, eras, era));
  for (const { era: e, b } of tabButtons) {
    const unlocked = state.unlocked.includes(e.id);
    setText(b, unlocked ? `${state.completed.includes(e.id) ? '✓ ' : ''}${eraTitle(state, e)}` : '???');
    b.disabled = !unlocked;
    b.classList.toggle('on', e.id === era.id);
    b.classList.toggle('new', unlocked && (state.eras[e.id]?.made ?? 0) === 0 && e.id !== era.id);
  }
  const made = st?.made ?? 0;
  const done = state.completed.includes(era.id);
  const goal = goalFor(state, era);
  const label = state.reinventions ? `${era.goal.label.replace(/[\d,.]+/, fmt(goal))}` : era.goal.label;
  setText(goalLabel, done ? `✓ ${label}` : `${label}: ${fmt(made)} / ${fmt(goal)}`);
  goalBar.set(made / goal, done ? 'done' : '');
  // New Game+ offer once every era is complete.
  const canReinvent = allComplete(state, eras);
  reinventBox.classList.toggle('hidden', !canReinvent);
  if (canReinvent) setText(reinventInfo, `Start over from the Stone Age. Everything runs ×${meta.loopMultiplier} faster forever; goals grow ×${meta.goalGrowth}.`);
  setText(loopEl, state.reinventions ? `Reinvention #${state.reinventions} · everything ×${fmt(meta.loopMultiplier ** state.reinventions)}` : '');
  const bonus = bonusFor(state, eras, era);
  setText(bonusEl, bonus > 1 ? `Ancestral know-how: everything here runs ×${+bonus.toFixed(2)} faster` : '');
  setText(lifetime, `${fmt(lifetimeWheels(state))} wheels reinvented, all-time`);
  renderLog();
}

// ---- Loop ----
const dev = devEnabled
  ? mountDev(eras, {
      get: () => state,
      set: (s) => (state = s),
      reset: async () => {
        await store.remove(SAVE_KEY);
        location.reload();
      },
    })
  : null;

let lastFrame = Date.now();
function frame() {
  const now = Date.now();
  state = advance(state, eras, now);
  const warp = dev?.warp() ?? 1;
  if (warp > 1) state = advanceBy(state, eras, (now - lastFrame) * (warp - 1));
  lastFrame = now;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(persist, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

registerServiceWorker();
