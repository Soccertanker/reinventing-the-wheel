import { hapticTap, store } from '../../platform';
import { registerServiceWorker } from '../../platform/pwa';
import { loadVersioned, saveVersioned, type SaveSpec } from '../../platform/versionedSave';
import { bar, h, setDisabled, setText } from '../../ui/dom';
import './boulder.css';
import { blocker, cancelQueued, content as c, duration, enqueue, newSave, nextLoop, projectItems, tick, visible, type BoulderSave } from './logic';

const spec: SaveSpec<BoulderSave> = { key: 'rtw.boulder', version: 1, migrations: {}, fresh: () => newSave() };
let s = await loadVersioned(store, spec, Date.now());
const persist = () => void saveVersioned(store, spec, s);

const TITLES: Record<string, string> = {
  death: '💀 FLATTENED',
  fled: '🏃 FLATTENED (while running)',
  escape: '🛞 YOU ESCAPED',
  secret: '🪨 THE BOULDER WAS THE WHEEL',
};
const ENDINGS = ['death', 'fled', 'escape', 'secret'];

const app = document.getElementById('app') as HTMLElement;
const loopInfo = h('p', { class: 'muted small' });
const timer = bar();
const timerText = h('div', { class: 'timer-text' });
const currentName = h('strong');
const currentBar = bar();
const queueEl = h('ol', { class: 'queue' });
const items = h('div', { class: 'chips' });
const taskGrid = h('div', { class: 'tasks' });
const journal = h('ul', { class: 'journal' });
const logEl = h('ul', { class: 'log' });
const overlay = h('div', { class: 'overlay hidden' });

app.append(
  h('header', { class: 'center' }, h('h1', {}, '60 Seconds Before the Boulder'), loopInfo),
  h('div', { class: 'panel boulder' }, timerText, timer.el),
  h('div', { class: 'panel' }, h('div', {}, 'Doing: ', currentName), currentBar.el, queueEl),
  items,
  taskGrid,
  h('details', { class: 'panel' }, h('summary', {}, 'Journal (survives the boulder)'), journal),
  logEl,
  overlay,
);

const buttons = new Map<string, { b: HTMLButtonElement; time: HTMLElement; why: HTMLElement }>();
for (const t of c.tasks) {
  const time = h('small', { class: 'time' });
  const why = h('small', { class: 'why' });
  const b = h('button', { class: 'task', onclick: () => ((s = enqueue(s, t.id)), hapticTap()) }, h('span', {}, t.name), time, why);
  if (t.win) b.classList.add('win');
  buttons.set(t.id, { b, time, why });
  taskGrid.append(b);
}

function render() {
  const r = s.run;
  setText(loopInfo, `Loop #${s.loops} · endings found ${s.endings.length}/${ENDINGS.length}${s.bestEscape !== null ? ` · best escape ${s.bestEscape.toFixed(1)}s` : ''}`);
  const left = Math.max(0, c.loopSeconds - r.elapsed);
  timer.set(r.elapsed / c.loopSeconds, left < 10 ? 'danger' : left < 25 ? 'warn' : '');
  setText(timerText, `🪨 Boulder arrives in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
  document.body.classList.toggle('rumble', left < 10 && !r.over);

  const cur = r.current && c.tasks.find((t) => t.id === r.current?.task);
  setText(
    currentName,
    cur ? `${cur.name} (${r.current?.remaining.toFixed(1)}s)` : r.elapsed === 0 ? 'nothing yet. The boulder starts rolling when you make your first move.' : 'nothing. Tap a task!',
  );
  currentBar.set(r.current ? 1 - r.current.remaining / r.current.total : 0);
  const qKey = r.queue.join('|');
  if (queueEl.dataset.k !== qKey) {
    queueEl.dataset.k = qKey;
    queueEl.replaceChildren(
      ...r.queue.map((id, i) =>
        h('li', {}, h('button', { class: 'chip', onclick: () => (s = cancelQueued(s, i)) }, `${c.tasks.find((t) => t.id === id)?.name ?? id} ✕`)),
      ),
    );
  }

  const bag = r.items;
  const proj = projectItems(s);
  const iKey = JSON.stringify([bag, proj]);
  if (items.dataset.k !== iKey) {
    items.dataset.k = iKey;
    const names = Object.keys(c.items).filter((k) => (bag[k] ?? 0) > 0 || (proj[k] ?? 0) > 0);
    items.replaceChildren(
      ...(names.length
        ? names.map((k) => h('span', { class: 'chip' }, `${c.items[k]} ×${bag[k] ?? 0}${(proj[k] ?? 0) !== (bag[k] ?? 0) ? ` → ${proj[k] ?? 0}` : ''}`))
        : [h('span', { class: 'muted small' }, 'Your hands are empty.')]),
    );
  }

  for (const t of c.tasks) {
    const ui = buttons.get(t.id);
    if (!ui) continue;
    const show = visible(s, t);
    ui.b.classList.toggle('hidden', !show);
    if (!show) continue;
    const d = duration(s, t);
    setText(ui.time, d < t.seconds ? `${d}s (was ${t.seconds}s)` : `${d}s`);
    const why = blocker(s, t);
    setText(ui.why, why && why !== 'queue full' ? why : '');
    setDisabled(ui.b, !!why);
  }

  const jKey = s.knowledge.join('|');
  if (journal.dataset.k !== jKey) {
    journal.dataset.k = jKey;
    journal.replaceChildren(
      ...(s.knowledge.length ? s.knowledge.map((k) => h('li', {}, c.knowledge[k] ?? k)) : [h('li', { class: 'muted' }, 'Nothing yet. Everything resets... except what you learn.')]),
    );
  }

  const lKey = `${s.loops}:${r.log.length}`;
  if (logEl.dataset.k !== lKey) {
    logEl.dataset.k = lKey;
    logEl.replaceChildren(...r.log.slice(-6).reverse().map((l) => h('li', {}, l)));
  }

  overlay.classList.toggle('hidden', !r.over);
  if (r.over && overlay.dataset.k !== `${s.loops}`) {
    overlay.dataset.k = `${s.loops}`;
    const learned = s.knowledge.length;
    overlay.replaceChildren(
      h(
        'div',
        { class: `panel over ${r.over.kind}` },
        h('h2', {}, TITLES[r.over.kind] ?? r.over.kind),
        h('p', {}, r.over.text),
        h('p', { class: 'muted small' }, `Loop #${s.loops} · ${r.over.time.toFixed(1)}s · ${learned} thing${learned === 1 ? '' : 's'} in your journal · endings ${s.endings.length}/${ENDINGS.length}`),
        h('button', { class: 'big', onclick: () => ((s = nextLoop(s)), persist(), hapticTap()) }, r.over.kind === 'death' || r.over.kind === 'fled' ? 'Wake up. Again.' : 'Do it again, faster'),
      ),
    );
    persist();
  }
}

// Real-time loop. Pauses while the tab is hidden (this game isn't idle; the boulder waits for you).
let last = performance.now();
let speed = 1;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (document.visibilityState === 'visible') s = tick(s, dt * speed);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(persist, 3000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

if (new URLSearchParams(location.search).has('dev')) {
  const panel = h(
    'details',
    { class: 'dev' },
    h('summary', {}, 'dev'),
    h('button', { onclick: () => (speed = speed === 1 ? 4 : 1) }, 'speed ×1/×4'),
    h('button', { onclick: () => (s = tick(s, 10)) }, '+10s'),
    h('button', {
      onclick: async () => {
        if (!confirm('Reset all progress?')) return;
        await store.remove(spec.key);
        location.reload();
      },
    }, 'reset'),
  );
  document.body.append(panel);
}

document.getElementById('version')?.append(__APP_VERSION__);
registerServiceWorker();
