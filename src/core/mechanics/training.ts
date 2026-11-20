/**
 * "training": you no longer make wheels; you train AI models that make wheels.
 * - Pick a model size (log scale) and a dataset, then start a training run. Big models are better
 *   and take absurdly long; the ETA is honest about it.
 * - Training borrows most of your GPUs, so the deployed model slows down meanwhile.
 * - The deployed model makes wheels every second. Some outputs are hallucinations (not wheels),
 *   and the alignment slider trades hallucinations for refusals.
 * - "Synthetic" data is your previous model's output: cheap, but every generation is worse (model collapse).
 * - Big runs can diverge (loss goes NaN) and are lost.
 * Used by the Sci-fi Supercomputer era.
 */
import { arr, num, obj, str, strs, uniqueIds } from '../content';
import { pick } from '../rng';
import type { MechanicState } from '../state';
import { costAt, produce, type Mechanic } from './types';

export interface Dataset {
  id: string;
  name: string;
  quality: number;
  size: number;
  /** quality comes from the deployed model instead (times collapse factor) */
  synthetic?: boolean;
}

export interface TrainingParams {
  gpu: { name: string; baseCost: number; costGrowth: number; flops: number };
  datasets: Dataset[];
  minLogSize: number;
  maxLogSize: number;
  /** work units = workScale * (size / 1e6) ^ workExponent * dataset.size */
  workScale: number;
  workExponent: number;
  /** share of compute the training run takes */
  trainingShare: number;
  collapseFactor: number;
  attemptsPerGpuSecond: number;
  divergencePerHour: number;
  hallucinations: string[];
  refusals: string[];
  divergences: string[];
  events: string[];
  completions: string[];
  eventEverySeconds: number;
}

export interface Model {
  logSize: number;
  quality: number;
  dataset: string;
  generation: number;
}

export interface Run {
  logSize: number;
  dataset: string;
  quality: number;
  work: number;
  done: number;
  loss: number[];
}

export interface TrainingState extends MechanicState {
  gpus: number;
  logSize: number;
  dataset: string;
  alignment: number;
  model: Model | null;
  run: Run | null;
  hallucinated: number;
  refused: number;
  generation: number;
  eventTimer: number;
  quipTimer: number;
}

export const gpuCost = (c: TrainingParams, s: TrainingState) => costAt(c.gpu.baseCost, c.gpu.costGrowth, s.gpus - 1);

export function trainingWork(c: TrainingParams, logSize: number, ds: Dataset): number {
  return c.workScale * (10 ** logSize / 1e6) ** c.workExponent * ds.size;
}

/** Scaling law: bigger is better, with diminishing returns, capped by data quality. */
export function modelQuality(logSize: number, dataQuality: number): number {
  return dataQuality * (1 - 0.9 * (10 ** logSize / 1e6) ** -0.25);
}

export function datasetQuality(ds: Dataset, s: TrainingState, c: TrainingParams): number {
  return ds.synthetic ? (s.model?.quality ?? 0) * c.collapseFactor : ds.quality;
}

/** Outcome shares per inference attempt. */
export function outcomes(quality: number, alignment: number): { wheel: number; hallucination: number; refusal: number } {
  const a = alignment / 100;
  const refusal = 0.6 * a * a;
  const hallucination = (1 - refusal) * (1 - quality) * (1 - 0.8 * a);
  return { wheel: 1 - refusal - hallucination, hallucination, refusal };
}

export function computePerSecond(c: TrainingParams, s: TrainingState): number {
  return s.gpus * c.gpu.flops;
}

export function inferenceShare(c: TrainingParams, s: TrainingState): number {
  return s.run ? 1 - c.trainingShare : 1;
}

export function wheelsPerSecond(c: TrainingParams, s: TrainingState, bonus: number): number {
  if (!s.model) return 0;
  return s.gpus * c.attemptsPerGpuSecond * inferenceShare(c, s) * outcomes(s.model.quality, s.alignment).wheel * bonus;
}

export const training: Mechanic<TrainingParams, TrainingState> = {
  validate(raw, path) {
    const o = obj(raw, path);
    const g = obj(o.gpu, `${path}.gpu`);
    return {
      gpu: {
        name: str(g, 'name', path),
        baseCost: num(g, 'baseCost', path, { min: 1 }),
        costGrowth: num(g, 'costGrowth', path, { min: 1 }),
        flops: num(g, 'flops', path, { min: 0 }),
      },
      datasets: uniqueIds(
        arr(o, 'datasets', path).map((d, i) => {
          const dd = obj(d, `${path}.datasets[${i}]`);
          return {
            id: str(dd, 'id', path),
            name: str(dd, 'name', path),
            quality: num(dd, 'quality', path, { min: 0, max: 1 }),
            size: num(dd, 'size', path, { min: 0 }),
            synthetic: dd.synthetic === true,
          };
        }),
        `${path}.datasets`,
      ),
      minLogSize: num(o, 'minLogSize', path),
      maxLogSize: num(o, 'maxLogSize', path),
      workScale: num(o, 'workScale', path, { min: 0 }),
      workExponent: num(o, 'workExponent', path, { min: 0 }),
      trainingShare: num(o, 'trainingShare', path, { min: 0, max: 1 }),
      collapseFactor: num(o, 'collapseFactor', path, { min: 0, max: 1 }),
      attemptsPerGpuSecond: num(o, 'attemptsPerGpuSecond', path, { min: 0 }),
      divergencePerHour: num(o, 'divergencePerHour', path, { min: 0 }),
      hallucinations: strs(o, 'hallucinations', path),
      refusals: strs(o, 'refusals', path),
      divergences: strs(o, 'divergences', path),
      events: strs(o, 'events', path),
      completions: strs(o, 'completions', path),
      eventEverySeconds: num(o, 'eventEverySeconds', path, { min: 1 }),
    };
  },

  init: (c) => ({
    wheels: 0,
    made: 0,
    gpus: 1,
    logSize: c.minLogSize,
    dataset: c.datasets[0]?.id ?? '',
    alignment: 30,
    model: null,
    run: null,
    hallucinated: 0,
    refused: 0,
    generation: 0,
    eventTimer: 0,
    quipTimer: 0,
  }),

  tick(s, c, dt, ctx) {
    if (s.run) {
      const run = s.run;
      run.done += computePerSecond(c, s) * c.trainingShare * dt;
      const progress = Math.min(1, run.done / run.work);
      // Record a loss point every 2% of progress, for the chart.
      while (run.loss.length < Math.floor(progress * 50) + 1) {
        const p = run.loss.length / 50;
        run.loss.push(Math.max(0.01, (1 - run.quality * Math.sqrt(p)) * (1 + (ctx.rng() - 0.5) * 0.2)));
      }
      // Bigger models diverge more often (per hour of training).
      const risk = c.divergencePerHour * Math.max(0, run.logSize - 8) * (dt / 3600);
      if (ctx.rng() < risk) {
        ctx.log(pick(ctx.rng, c.divergences));
        s.run = null;
      } else if (run.done >= run.work) {
        s.generation++;
        const model = { logSize: run.logSize, quality: run.quality, dataset: run.dataset, generation: s.generation };
        if (!s.model || model.quality >= s.model.quality) {
          s.model = model;
          ctx.log(`${pick(ctx.rng, c.completions)} (Model v${s.generation} deployed, quality ${(model.quality * 100).toFixed(1)}%.)`);
        } else {
          ctx.log(`Model v${s.generation} finished, but it's worse than what's deployed (${(model.quality * 100).toFixed(1)}%). Archived in /dev/null.`);
        }
        s.run = null;
      }
    }

    if (s.model) {
      const attempts = s.gpus * c.attemptsPerGpuSecond * inferenceShare(c, s) * dt;
      const o = outcomes(s.model.quality, s.alignment);
      produce(s, attempts * o.wheel * ctx.bonus);
      s.hallucinated += attempts * o.hallucination;
      s.refused += attempts * o.refusal;
      // Show a sample of what the model is actually doing.
      s.quipTimer += dt;
      if (s.quipTimer >= 12) {
        s.quipTimer = 0;
        const r = ctx.rng() * (o.hallucination + o.refusal);
        if (r < o.hallucination) ctx.log(`Model output: ${pick(ctx.rng, c.hallucinations)}`);
        else if (o.refusal > 0.02) ctx.log(`Model: "${pick(ctx.rng, c.refusals)}"`);
      }
    }

    s.eventTimer += dt;
    if (s.eventTimer >= c.eventEverySeconds) {
      s.eventTimer = 0;
      if (s.model) ctx.log(pick(ctx.rng, c.events));
    }
  },

  act(s, c, a, ctx) {
    switch (a.type) {
      case 'size':
        s.logSize = Math.max(c.minLogSize, Math.min(c.maxLogSize, Number(a.value) || c.minLogSize));
        break;
      case 'dataset':
        if (c.datasets.some((d) => d.id === a.id)) s.dataset = String(a.id);
        break;
      case 'alignment':
        s.alignment = Math.max(0, Math.min(100, Number(a.value) || 0));
        break;
      case 'train': {
        if (s.run) return;
        const ds = c.datasets.find((d) => d.id === s.dataset);
        if (!ds || (ds.synthetic && !s.model)) return;
        const q = datasetQuality(ds, s, c);
        s.run = { logSize: s.logSize, dataset: ds.id, quality: modelQuality(s.logSize, q), work: trainingWork(c, s.logSize, ds), done: 0, loss: [] };
        break;
      }
      case 'cancel':
        if (s.run) {
          s.run = null;
          ctx.log('Training run cancelled. The GPUs pretend they were never involved.');
        }
        break;
      case 'buyGpu': {
        const cost = gpuCost(c, s);
        if (s.wheels < cost) return;
        s.wheels -= cost;
        s.gpus++;
        break;
      }
    }
  },
};
