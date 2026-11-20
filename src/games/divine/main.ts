import { hapticTap, store } from '../../platform';
import { registerServiceWorker } from '../../platform/pwa';
import { loadVersioned, saveVersioned, type SaveSpec } from '../../platform/versionedSave';
import { bar, h, setDisabled, setText } from '../../ui/dom';
import { fmt } from '../../ui/format';
import './divine.css';
import { advance, consultOracle, content as c, dream, maxFaith, newSave, won, type DivineSave, type Revelation } from './logic';

const spec: SaveSpec<DivineSave> = { key: 'rtw.divine', version: 1, migrations: {}, fresh: () => newSave(Date.now()) };
let s = advance(await loadVersioned(store, spec, Date.now()), Date.now());
const persist = () => void saveVersioned(store, spec, s);
let picks: string[] = [];

const app = document.getElementById('app') as HTMLElement;
const faithBar = bar();
const faithText = h('span');
const followers = h('span');
const winBanner = h('div', { class: 'panel win hidden' });
const card = h('div', { class: 'panel revelation' });
const slotA = h('button', { class: 'slot', onclick: () => (picks = picks.slice(1)) });
const slotB = h('button', { class: 'slot', onclick: () => (picks = picks.slice(0, 1)) });
const send = h('button', {
  class: 'big',
  onclick: () => {
    if (picks.length !== 2) return;
    s = dream(s, picks[0] as string, picks[1] as string);
    picks = [];
    hapticTap();
    persist();
  },
});
const oracle = h('button', { onclick: () => ((s = consultOracle(s)), persist()) });
const palette = h('div', { class: 'palette' });
const codexCount = h('span');
const codex = h('div', { class: 'codex' });
const history = h('ul', { class: 'history' });

app.append(
  h('header', { class: 'center' }, h('h1', {}, '✨ Divine Inspiration'), h('p', { class: 'muted small' }, 'You are a minor god of Round Things. You can only speak in dreams.')),
  h('div', { class: 'panel stats' }, h('div', {}, '🙏 Faith ', faithText), faithBar.el, h('div', { class: 'muted small' }, followers)),
  winBanner,
  card,
  h(
    'div',
    { class: 'panel' },
    h('h3', {}, 'Compose a dream'),
    h('div', { class: 'slots' }, slotA, h('span', { class: 'plus' }, '+'), slotB),
    palette,
    send,
    oracle,
  ),
  h('details', { class: 'panel' }, h('summary', {}, 'Codex of inventions ', codexCount), codex),
  h('h3', {}, 'What the tribe has been up to'),
  history,
);

const symbolButtons = c.symbols.map((sym) => {
  const b = h('button', {
    class: 'sym',
    title: sym.name,
    onclick: () => {
      if (picks.length < 2) picks = [...picks, sym.id];
      else picks = [picks[1] as string, sym.id];
      hapticTap();
    },
  }, h('span', { class: 'emoji' }, sym.emoji), h('small', {}, sym.name));
  palette.append(b);
  return { sym, b };
});

const emojiOf = (id: string) => c.symbols.find((x) => x.id === id)?.emoji ?? '?';
const invOf = (id?: string) => c.inventions.find((i) => i.id === id);

function cardFor(r: Revelation | null) {
  if (!r) return [h('div', { class: 'big-emoji' }, '🌙'), h('p', {}, 'The tribe sleeps. Pick two symbols and send them a dream. They will invent... something.')];
  const inv = invOf(r.invention);
  const icon = r.kind === 'dud' ? '💭' : r.kind === 'oracle' ? '🔮' : (inv?.emoji ?? '✨');
  const title = r.kind === 'dud' ? 'A misunderstanding' : r.kind === 'oracle' ? 'The Oracle speaks' : r.kind === 'repeat' ? `${inv?.name} (again)` : `New invention: ${inv?.name}`;
  return [h('div', { class: 'big-emoji' }, icon), h('strong', {}, title), h('p', {}, r.text)];
}

function render() {
  const max = maxFaith(s);
  faithBar.set(s.faith / max);
  setText(faithText, `${Math.floor(s.faith)} / ${max}`);
  setText(followers, `👥 ${fmt(s.followers)} followers · ${s.dreams} dreams sent · faith regrows faster with more followers`);

  const lastKey = `${s.history.length}:${s.dreams}:${s.last?.text ?? ''}`;
  if (card.dataset.k !== lastKey) {
    card.dataset.k = lastKey;
    card.replaceChildren(...cardFor(s.last));
    card.classList.remove('pop');
    void card.offsetWidth; // restart the animation
    card.classList.add('pop');
  }

  winBanner.classList.toggle('hidden', !won(s));
  setText(winBanner, `🛞 The wheel exists. You did that. Now find every other thing they can invent: ${s.discovered.length}/${c.inventions.length}.`);

  setText(slotA, picks[0] ? emojiOf(picks[0]) : '?');
  setText(slotB, picks[1] ? emojiOf(picks[1]) : '?');
  setText(send, picks.length === 2 ? `Send dream (${c.dreamCost} faith)` : 'Pick two symbols');
  setDisabled(send, picks.length !== 2 || s.faith < c.dreamCost);
  setText(oracle, `🔮 Consult the oracle for a hint (${c.oracleCost} faith)`);
  setDisabled(oracle, s.faith < c.oracleCost || won(s));
  oracle.classList.toggle('hidden', won(s));

  for (const { sym, b } of symbolButtons) {
    b.classList.toggle('hidden', !s.symbols.includes(sym.id));
    b.classList.toggle('picked', picks.includes(sym.id));
  }

  const cKey = s.discovered.join('|');
  if (codex.dataset.k !== cKey) {
    codex.dataset.k = cKey;
    setText(codexCount, `(${s.discovered.length}/${c.inventions.length})`);
    codex.replaceChildren(
      ...c.inventions.map((inv) =>
        s.discovered.includes(inv.id)
          ? h('div', { class: 'entry', title: inv.text }, h('span', {}, inv.emoji), h('small', {}, inv.name), h('small', { class: 'muted' }, `${emojiOf(inv.a)}+${emojiOf(inv.b)}`))
          : h('div', { class: 'entry unknown' }, h('span', {}, '❔'), h('small', { class: 'muted' }, '???')),
      ),
    );
  }

  const hKey = String(s.history.length) + (s.history.at(-1)?.text ?? '');
  if (history.dataset.k !== hKey) {
    history.dataset.k = hKey;
    history.replaceChildren(...s.history.slice(-8).reverse().map((r) => h('li', { class: r.kind }, r.text)));
  }
}

function frame() {
  s = advance(s, Date.now());
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(persist, 5000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());

if (new URLSearchParams(location.search).has('dev')) {
  document.body.append(
    h(
      'details',
      { class: 'dev' },
      h('summary', {}, 'dev'),
      h('button', { onclick: () => (s = { ...s, faith: maxFaith(s) }) }, 'fill faith'),
      h('button', {
        onclick: async () => {
          if (!confirm('Reset?')) return;
          await store.remove(spec.key);
          location.reload();
        },
      }, 'reset'),
    ),
  );
}
document.getElementById('version')?.append(__APP_VERSION__);
registerServiceWorker();
