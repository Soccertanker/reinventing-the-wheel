import {
  computePerSecond,
  datasetQuality,
  gpuCost,
  modelQuality,
  outcomes,
  trainingWork,
  wheelsPerSecond,
  type TrainingParams,
  type TrainingState,
} from '../../core/mechanics/training';
import { bar, h, setDisabled, setRange, setText } from '../dom';
import { fmt, fmtDuration, fmtParams, fmtRate, pct } from '../format';
import type { MountView } from './types';
import { sparkline } from './wheelArt';

export const mountTraining: MountView = (root, era, api) => {
  const c = era.config as TrainingParams;
  const wheels = h('span');
  const rate = h('span');
  const gpus = h('span');
  const buyGpu = h('button', { onclick: () => api.act({ type: 'buyGpu' }) });

  // Deployed model card
  const modelName = h('strong');
  const modelInfo = h('small');
  const mix = h('div', { class: 'mix' });
  const mixWheel = h('span', { class: 'mix-wheel' });
  const mixHall = h('span', { class: 'mix-hall' });
  const mixRef = h('span', { class: 'mix-ref' });
  mix.append(mixWheel, mixHall, mixRef);
  const mixLegend = h('small', { class: 'muted' });
  const align = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 1,
    oninput: (e) => api.act({ type: 'alignment', value: Number((e.target as HTMLInputElement).value) }),
  });

  // Training run setup
  const size = h('input', {
    type: 'range',
    min: c.minLogSize,
    max: c.maxLogSize,
    step: 0.1,
    oninput: (e) => api.act({ type: 'size', value: Number((e.target as HTMLInputElement).value) }),
  });
  const sizeLabel = h('strong');
  const datasets = c.datasets.map((d) => {
    const input = h('input', { type: 'radio', name: `ds-${era.id}`, value: d.id, onchange: () => api.act({ type: 'dataset', id: d.id }) });
    const note = h('small', { class: 'muted' });
    return { d, input, note, el: h('label', { class: 'radio' }, input, ` ${d.name} `, note) };
  });
  const forecast = h('p', { class: 'muted' });
  const train = h('button', { class: 'big', onclick: () => (api.tap(), api.act({ type: 'train' })) }, 'Start training run');

  // Active run
  const runBox = h('div', { class: 'panel' });
  const runTitle = h('strong');
  const runProgress = bar();
  const runEta = h('p', { class: 'muted' });
  const loss = sparkline();
  const cancel = h('button', { onclick: () => api.act({ type: 'cancel' }) }, 'Cancel run');
  runBox.append(runTitle, runProgress.el, runEta, h('div', { class: 'chart' }, h('small', { class: 'muted' }, 'loss'), loss.el), cancel);

  const setup = h(
    'div',
    { class: 'panel' },
    h('h3', {}, 'New training run'),
    h('label', { class: 'knob' }, h('span', {}, 'Model size: ', sizeLabel, ' parameters'), size),
    ...datasets.map((d) => d.el),
    forecast,
    train,
  );
  const stats = h('p', { class: 'muted' });

  root.append(
    h('p', { class: 'count' }, wheels, ' AI-generated wheels'),
    h('p', { class: 'muted' }, rate, ' / sec · ', gpus),
    h('div', { class: 'row' }, buyGpu),
    h(
      'div',
      { class: 'panel' },
      h('div', {}, modelName, ' ', modelInfo),
      mix,
      mixLegend,
      h('label', { class: 'knob' }, h('span', {}, 'Alignment'), align, h('span', { class: 'ends' }, h('small', {}, 'unhinged'), h('small', {}, 'too polite to function'))),
    ),
    runBox,
    setup,
    stats,
  );

  return {
    update(st, bonus) {
      const s = st as TrainingState;
      setText(wheels, fmt(s.wheels));
      setText(rate, fmtRate(wheelsPerSecond(c, s, bonus)));
      setText(gpus, `${s.gpus} × ${c.gpu.name}`);
      const gc = gpuCost(c, s);
      setText(buyGpu, `Buy ${c.gpu.name} (${fmt(gc)} wheels)`);
      setDisabled(buyGpu, s.wheels < gc);

      if (s.model) {
        setText(modelName, `Wheel-GPT v${s.model.generation}`);
        setText(modelInfo, `${fmtParams(s.model.logSize)} params · quality ${pct(s.model.quality, 1)}${s.run ? ` · running at ${pct(1 - c.trainingShare)} while training` : ''}`);
        const o = outcomes(s.model.quality, s.alignment);
        mixWheel.style.flexGrow = String(o.wheel);
        mixHall.style.flexGrow = String(o.hallucination);
        mixRef.style.flexGrow = String(o.refusal);
        setText(mixLegend, `${pct(o.wheel)} wheels · ${pct(o.hallucination)} hallucinations · ${pct(o.refusal)} refusals`);
      } else {
        setText(modelName, 'No model deployed');
        setText(modelInfo, 'Train your first model below. Start small.');
        setText(mixLegend, '');
      }
      setRange(align, s.alignment);

      setRange(size, s.logSize);
      setText(sizeLabel, fmtParams(s.logSize));
      const ds = c.datasets.find((d) => d.id === s.dataset);
      for (const d of datasets) {
        if (d.input.checked !== (d.d.id === s.dataset)) d.input.checked = d.d.id === s.dataset;
        const locked = !!d.d.synthetic && !s.model;
        setDisabled(d.input, locked);
        setText(d.note, locked ? '(needs a model first)' : `quality ${pct(datasetQuality(d.d, s, c))}`);
      }
      const trainSpeed = computePerSecond(c, s) * c.trainingShare;
      if (ds) {
        const q = modelQuality(s.logSize, datasetQuality(ds, s, c));
        setText(forecast, `Expected quality ${pct(q, 1)} · ETA ${fmtDuration(trainingWork(c, s.logSize, ds) / trainSpeed)} on ${s.gpus} GPU${s.gpus === 1 ? '' : 's'}`);
      }
      setDisabled(train, !!s.run || !ds || (!!ds.synthetic && !s.model));

      runBox.classList.toggle('hidden', !s.run);
      setup.classList.toggle('hidden', !!s.run);
      if (s.run) {
        const f = s.run.done / s.run.work;
        setText(runTitle, `Training ${fmtParams(s.run.logSize)} model... ${pct(f, 1)}`);
        runProgress.set(f);
        setText(runEta, `ETA ${fmtDuration((s.run.work - s.run.done) / trainSpeed)} · expected quality ${pct(s.run.quality, 1)}`);
        loss.draw(s.run.loss, 1.2);
      }
      setText(stats, `${fmt(s.hallucinated)} hallucinated wheels discarded · ${fmt(s.refused)} polite refusals`);
    },
  };
};
