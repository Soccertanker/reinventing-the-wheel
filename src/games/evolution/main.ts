import { hapticTap, store } from '../../platform';
import { registerServiceWorker } from '../../platform/pwa';
import { loadVersioned, saveVersioned, type SaveSpec } from '../../platform/versionedSave';
import { h, setRange, setText } from '../../ui/dom';
import './evolution.css';
import { content as c, evaluate, intelligentDesign, meteor, newSave, setChaos, setTerrain, simParams, speciesName, step, togglePointy, type EvoSave, type Evaluated } from './evolution';
import { bodyFromGenome, posedHull, type Sample, type Vec } from './physics';

const spec: SaveSpec<EvoSave> = { key: 'rtw.evolution', version: 1, migrations: {}, fresh: () => newSave((Date.now() ^ 0x9e3779b9) >>> 0) };
let s = await loadVersioned(store, spec, Date.now());
const persist = () => void saveVersioned(store, spec, s);

// ---------- layout ----------
const app = document.getElementById('app') as HTMLElement;
const canvas = h('canvas', { class: 'hill' });
const genEl = h('strong');
const champEl = h('div', { class: 'muted small' });
const statsEl = h('div', { class: 'small' });
const chart = h('canvas', { class: 'chart' });
const terrainRow = h('div', { class: 'row' });
const chaos = h('input', { type: 'range', min: 0, max: 1, step: 0.01, oninput: (e) => (s = setChaos(s, Number((e.target as HTMLInputElement).value))) });
const pointyBtn = h('button', { onclick: () => ((s = togglePointy(s)), hapticTap(), restartGen()) });
const speedBtn = h('button', { onclick: () => (mode = mode === 'watch' ? 'fast' : mode === 'fast' ? 'paused' : 'watch') });
const gallery = h('div', { class: 'gallery' });
const logEl = h('ul', { class: 'log' });

app.append(
  h('header', { class: 'center' }, h('h1', {}, '🧬 Survival of the Roundest'), h('p', { class: 'muted small' }, 'Random blobs roll down a hill. The ones that get farthest have children. Watch evolution reinvent the wheel. Or meddle.')),
  h('div', { class: 'panel' }, h('div', { class: 'row spread' }, genEl, speedBtn), canvas, statsEl, champEl),
  h('div', { class: 'panel' }, h('div', { class: 'small muted' }, 'Best distance (gold) and roundness (blue) per generation'), chart),
  h(
    'div',
    { class: 'panel' },
    h('h3', {}, 'Play god'),
    terrainRow,
    h('label', { class: 'knob' }, h('span', {}, 'Mutation'), chaos, h('span', { class: 'ends' }, h('small', {}, 'cautious'), h('small', {}, 'absolute chaos'))),
    h(
      'div',
      { class: 'row' },
      h('button', { onclick: () => ((s = meteor(s)), hapticTap(), restartGen()) }, '☄️ Meteor'),
      pointyBtn,
      h('button', { onclick: () => ((s = intelligentDesign(s)), hapticTap(), restartGen()) }, '🙌 Intelligent design'),
    ),
  ),
  h('div', { class: 'panel' }, h('h3', {}, 'This generation’s top 5'), gallery),
  logEl,
);

const terrainButtons = c.terrains.map((t) => {
  const b = h('button', { onclick: () => ((s = setTerrain(s, t.id)), restartGen()) }, `${t.name} (${t.slope}°)`);
  terrainRow.append(b);
  return { t, b };
});

// ---------- generation playback ----------
type Mode = 'watch' | 'fast' | 'paused';
let mode: Mode = 'watch';
let ranked: Evaluated[] = [];
let replayStart = 0;
const REPLAY_SPEED = 2.5; // sim seconds per real second

function restartGen() {
  ranked = s.population.map((g) => evaluate(g, s, c, true)).sort((a, b) => b.fitness - a.fitness);
  replayStart = performance.now();
  renderGallery();
  persist();
}

function sampleAt(samples: Sample[], t: number): Sample {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((samples[mid] as Sample).t <= t) lo = mid;
    else hi = mid - 1;
  }
  return samples[lo] as Sample;
}

// ---------- drawing ----------
function drawHill(time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const hgt = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  const slope = (simParams(s).slopeDeg * Math.PI) / 180;
  const view = Math.min(slope, (28 * Math.PI) / 180); // draw steep hills a bit flatter so they fit
  // Camera follows the champion, showing about 9 m of hill.
  const best0 = ranked[0];
  const focus = best0 && best0.result.samples.length ? sampleAt(best0.result.samples, Math.min(best0.result.time, time)).x : 0;
  const span = 9;
  const camX = Math.max(span / 2 - 1, Math.min(c.finish + 1 - span / 2, focus));
  const scale = w / span;
  const len = c.finish + 2;
  // Downhill runs right-and-down; 'up from the ground' is perpendicular to it. The camera point sits mid-screen.
  const toScreen = ([x, y]: Vec): [number, number] => [
    w / 2 + ((x - camX) * Math.cos(view) + y * Math.sin(view)) * scale,
    hgt * 0.62 + ((x - camX) * Math.sin(view) - y * Math.cos(view)) * scale,
  ];

  // distance markers
  ctx.fillStyle = '#9db3a6';
  ctx.font = '11px system-ui';
  for (let m = 0; m <= c.finish; m += 5) {
    const [mx, my] = toScreen([m, 0]);
    ctx.fillRect(mx - 1, my, 2, 8);
    ctx.fillText(`${m} m`, mx - 10, my + 20);
  }
  // ground
  ctx.strokeStyle = '#5c7a4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(...toScreen([-1, 0]));
  ctx.lineTo(...toScreen([len, 0]));
  ctx.stroke();
  // finish flag
  const [fx, fy] = toScreen([c.finish, 0]);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx, fy - 26);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(fx, fy - 26, 12, 8);

  const drawShape = (pts: Vec[], fill: string, stroke: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...toScreen(p)) : ctx.moveTo(...toScreen(p))));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  // ghosts: everyone else where they ended up
  for (const e of ranked.slice(1)) {
    const last = e.result.samples.at(-1);
    if (last) drawShape(posedHull(bodyFromGenome(e.genome), last), '#ffffff08', '#ffffff30');
  }
  // the champion, rolling
  const best = ranked[0];
  if (best && best.result.samples.length) {
    const t = Math.min(best.result.time, time);
    const pose = sampleAt(best.result.samples, t);
    drawShape(posedHull(bodyFromGenome(best.genome), pose), '#ffd16633', '#ffd166');
    ctx.fillStyle = '#ffd166';
    ctx.font = '12px system-ui';
    const [lx, ly] = toScreen([pose.x, 2.6]);
    ctx.fillText(`${pose.x.toFixed(1)} m`, lx - 14, ly);
  }
}

function drawChart() {
  const ctx = chart.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = chart.clientWidth;
  const hgt = chart.clientHeight;
  if (chart.width !== Math.round(w * dpr)) {
    chart.width = Math.round(w * dpr);
    chart.height = Math.round(hgt * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  const hist = s.history;
  if (hist.length < 2) return;
  const line = (vals: number[], max: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = hgt - 4 - (v / max) * (hgt - 8);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  line(hist.map((x) => x.best), c.finish, '#ffd166');
  line(hist.map((x) => x.round), 1, '#6ec1ff');
}

function renderGallery() {
  gallery.replaceChildren(
    ...ranked.slice(0, 5).map((e) => {
      const body = bodyFromGenome(e.genome);
      const pts = body.hull.map(([x, y]) => `${(50 + x * 40).toFixed(1)},${(50 - y * 40).toFixed(1)}`).join(' ');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', pts);
      svg.append(poly);
      return h('div', { class: 'specimen' }, svg, h('small', {}, speciesName(e.genome)), h('small', { class: 'muted' }, `${e.result.distance.toFixed(1)} m · ${(e.round * 100).toFixed(0)}% round`));
    }),
  );
}

let lastLog = '';
function renderUi() {
  setText(genEl, `Generation ${s.generation}${s.cheated ? ' (assisted)' : ''}`);
  setText(speedBtn, mode === 'watch' ? '▶ watching' : mode === 'fast' ? '⏩ fast-forward' : '⏸ paused');
  const best = ranked[0];
  if (best) setText(statsEl, `Best this generation: ${best.result.distance.toFixed(1)} m${best.result.finished ? ` (finished in ${best.result.time.toFixed(1)}s!)` : ''} · ${(best.round * 100).toFixed(1)}% round`);
  if (s.champion) setText(champEl, `All-time champion: ${s.champion.name} (gen ${s.champion.generation})`);
  setRange(chaos, s.chaos);
  setText(pointyBtn, s.pointyLove ? '💔 Pointy is no longer hot' : '💘 Make pointy attractive');
  for (const { t, b } of terrainButtons) b.classList.toggle('on', t.id === s.terrain);
  const lk = s.log.join('\n');
  if (lk !== lastLog) {
    lastLog = lk;
    logEl.replaceChildren(...s.log.slice(-8).reverse().map((l) => h('li', {}, l)));
  }
}

// ---------- main loop ----------
let lastFast = 0;
function frame(now: number) {
  if (mode === 'watch') {
    const simT = ((now - replayStart) / 1000) * REPLAY_SPEED;
    const dur = Math.max(2, (ranked[0]?.result.time ?? 0) + 1.2);
    if (simT > dur) {
      s = step(s);
      restartGen();
      drawChart();
    }
    drawHill(simT);
  } else if (mode === 'fast' && now - lastFast > 120) {
    lastFast = now;
    s = step(s);
    restartGen();
    drawChart();
    drawHill(Infinity);
  } else if (mode === 'paused') {
    drawHill(Infinity);
  }
  renderUi();
  requestAnimationFrame(frame);
}

restartGen();
drawChart();
requestAnimationFrame(frame);
setInterval(persist, 5000);
window.addEventListener('resize', drawChart);

if (new URLSearchParams(location.search).has('dev')) {
  document.body.append(
    h(
      'details',
      { class: 'dev' },
      h('summary', {}, 'dev'),
      h('button', {
        onclick: () => {
          for (let i = 0; i < 50; i++) s = step(s);
          restartGen();
          drawChart();
        },
      }, '+50 gens'),
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
