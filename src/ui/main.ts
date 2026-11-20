import { eras } from '../core/eras';
import { advance, buy, costOf, reinvent, wheelsPerSecond } from '../core/sim';
import type { GameState } from '../core/state';
import { hapticTap, legacyStore, store } from '../platform';
import { loadGame, saveGame } from '../platform/saveStore';

const era = eras[0]!;
let state: GameState = advance(await loadGame(store, legacyStore, Date.now()), era, Date.now());

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.floor(n).toLocaleString();

$('version').textContent = __APP_VERSION__;
$('era').textContent = era.name;

const list = $<HTMLUListElement>('producers');
const buttons = new Map<string, HTMLButtonElement>();
for (const p of era.producers) {
  const li = document.createElement('li');
  li.innerHTML = `<div><strong></strong> <span class="owned"></span><small></small></div>`;
  li.querySelector('strong')!.textContent = p.name;
  li.querySelector('small')!.textContent = p.description;
  const btn = document.createElement('button');
  btn.addEventListener('click', () => {
    state = buy(state, era, p.id);
    render();
  });
  li.append(btn);
  list.append(li);
  buttons.set(p.id, btn);
}

$('reinvent').addEventListener('click', () => {
  hapticTap();
  state = reinvent(state, era);
  render();
});

function render() {
  $('wheels').textContent = fmt(state.wheels);
  $('wps').textContent = wheelsPerSecond(state, era).toFixed(1);
  for (const p of era.producers) {
    const owned = state.owned[p.id] ?? 0;
    const cost = costOf(p, owned);
    const btn = buttons.get(p.id)!;
    btn.textContent = `${fmt(cost)} wheels`;
    btn.disabled = state.wheels < cost;
    btn.closest('li')!.querySelector('.owned')!.textContent = owned ? `×${owned}` : '';
  }
}

function frame() {
  state = advance(state, era, Date.now());
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const persist = () => void saveGame(store, state);
setInterval(persist, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});
