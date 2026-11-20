import { hapticTap, store } from '../../platform';
import { registerServiceWorker } from '../../platform/pwa';
import { loadVersioned, saveVersioned, type SaveSpec } from '../../platform/versionedSave';
import { h } from '../../ui/dom';
import './story.css';
import { choose, content as c, ending, locked, newSave, node, reincarnate, shownChoices, type StorySave } from './story';

const spec: SaveSpec<StorySave> = { key: 'rtw.story', version: 1, migrations: {}, fresh: () => newSave() };
let s = await loadVersioned(store, spec, Date.now());
const persist = () => void saveVersioned(store, spec, s);

const app = document.getElementById('app') as HTMLElement;
const meta = h('p', { class: 'meta' });
const scene = h('section', { class: 'scene' });
const traits = h('div', { class: 'traits' });
const timeline = h('div', { class: 'timeline' });
const gallery = h('div', { class: 'gallery' });
const galleryCount = h('span');

app.append(
  h('header', {}, h('h1', {}, 'You Are the Wheel'), meta),
  scene,
  traits,
  timeline,
  h('details', { class: 'endings' }, h('summary', {}, 'Endings ', galleryCount), gallery),
);

let typing: number | undefined;
/** Types text out letter by letter; tap the text to skip. */
function typewrite(el: HTMLElement, text: string) {
  window.clearInterval(typing);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    return;
  }
  let i = 0;
  el.textContent = '';
  el.onclick = () => {
    window.clearInterval(typing);
    el.textContent = text;
  };
  typing = window.setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) window.clearInterval(typing);
  }, 16);
}

const artOf = (id: string) => node(id)?.art ?? ending(id)?.art ?? '?';

function render() {
  meta.textContent = `Life #${s.lives} · ${s.endings.length}/${c.endings.length} endings found`;
  const n = node(s.at);
  const e = ending(s.at);

  if (n) {
    const text = h('p', { class: 'text' });
    scene.replaceChildren(
      h('div', { class: 'when' }, n.when),
      h('div', { class: 'art spin' }, n.art),
      h('h2', {}, `You are ${n.form.replace(/^A /, 'a ').replace(/^An /, 'an ')}.`),
      text,
      h(
        'div',
        { class: 'choices' },
        ...shownChoices(s).map((ch, i) => {
          const why = locked(s, ch);
          return h(
            'button',
            {
              class: 'choice',
              disabled: !!why,
              onclick: () => {
                s = choose(s, i);
                hapticTap();
                persist();
                render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              },
            },
            ch.text,
            why ? h('small', {}, `🔒 ${why}`) : null,
          );
        }),
      ),
    );
    typewrite(text, n.text);
  } else if (e) {
    const text = h('p', { class: 'text' });
    const isNew = s.endings.at(-1) === e.id && s.path.at(-1) === e.id;
    scene.replaceChildren(
      h('div', { class: 'when' }, isNew ? 'ENDING' : 'An ending'),
      h('div', { class: 'art ending-art' }, e.art),
      h('h2', {}, e.title),
      text,
      h('p', { class: 'meta' }, `${s.endings.length} of ${c.endings.length} endings found`),
      h('button', { class: 'choice again', onclick: () => ((s = reincarnate(s)), persist(), render(), hapticTap()) }, '🔄 Live again'),
    );
    typewrite(text, e.text);
  }

  traits.replaceChildren(
    ...Object.entries(c.traits).map(([id, name]) => {
      const v = s.traits[id] ?? 0;
      return h('span', { class: 'trait' }, `${name} `, h('b', {}, '●'.repeat(Math.min(v, 6)) + '○'.repeat(Math.max(0, 3 - v))));
    }),
  );
  timeline.replaceChildren(h('small', {}, 'This life: '), ...s.path.flatMap((id, i) => [i ? h('span', { class: 'arrow' }, '→') : null, h('span', { title: node(id)?.form ?? ending(id)?.title ?? id }, artOf(id))].filter((x): x is HTMLSpanElement => !!x)));

  galleryCount.textContent = `(${s.endings.length}/${c.endings.length})`;
  gallery.replaceChildren(
    ...c.endings.map((en) =>
      s.endings.includes(en.id) ? h('div', { class: 'card', title: en.text }, h('span', {}, en.art), h('small', {}, en.title)) : h('div', { class: 'card locked' }, h('span', {}, '❔'), h('small', {}, '???')),
    ),
  );
}

render();
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());

if (new URLSearchParams(location.search).has('dev')) {
  document.body.append(
    h(
      'details',
      { class: 'dev' },
      h('summary', {}, 'dev'),
      h('button', { onclick: () => ((s = { ...s, endings: c.endings.slice(0, 6).map((x) => x.id) }), render()) }, 'unlock secret path'),
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
