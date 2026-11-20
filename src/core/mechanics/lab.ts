/**
 * "lab": wheels are now science. You tune knobs (sliders) and run experiments; each result is a
 * roundness score that tells you how close you are to an unknown optimum. Passing prototypes are
 * wheels and earn grant money. Grad students run experiments near your best result and keep
 * improving it (automatic hill climbing). Every so often the standards body redefines "round"
 * and the optimum drifts, so the search never quite ends. Reviewer 2 occasionally rejects a pass.
 * Used by the Modern Lab era.
 */
import { arr, num, obj, str, strs } from '../content';
import { pick } from '../rng';
import type { MechanicState } from '../state';
import { costAt, produce, type Mechanic } from './types';

export interface Knob {
  name: string;
  low: string;
  high: string;
}

export interface LabParams {
  knobs: Knob[];
  experimentSeconds: number;
  passScore: number;
  noise: number;
  grantPerPoint: number;
  /** grant money you start with (enough to hire your first grad students) */
  startingGrant: number;
  student: { name: string; baseCost: number; costGrowth: number; slowdown: number; jitter: number };
  equipment: { name: string; baseCost: number; costGrowth: number; speedup: number };
  passesPerPaper: number;
  fundingPerPaper: number;
  driftEverySeconds: number;
  driftAmount: number;
  reviewer2Chance: number;
  verdicts: { score: number; text: string }[];
  reviewer2: string[];
  drifts: string[];
}

export interface Experiment {
  params: number[];
  remaining: number;
}

export interface LabState extends MechanicState {
  grants: number;
  knobs: number[];
  target: number[];
  best: { params: number[]; score: number } | null;
  manual: Experiment | null;
  students: number;
  studentTimers: number[];
  equipment: number;
  passes: number;
  papers: number;
  driftTimer: number;
  last: { score: number; passed: boolean; by: string } | null;
  experiments: number;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** 100 at the optimum, falling with RMS distance (0..100 knob scale). */
export function trueScore(params: number[], target: number[]): number {
  const d2 = params.reduce((sum, p, i) => sum + ((p - (target[i] ?? 50)) / 100) ** 2, 0) / params.length;
  return clamp(100 - 160 * Math.sqrt(d2));
}

export function experimentSeconds(c: LabParams, s: LabState): number {
  return c.experimentSeconds * c.equipment.speedup ** s.equipment;
}

export const studentCost = (c: LabParams, s: LabState) => costAt(c.student.baseCost, c.student.costGrowth, s.students);
export const equipmentCost = (c: LabParams, s: LabState) => costAt(c.equipment.baseCost, c.equipment.costGrowth, s.equipment);
export const funding = (c: LabParams, s: LabState) => 1 + s.papers * c.fundingPerPaper;

export function verdict(c: LabParams, score: number): string {
  return [...c.verdicts].sort((a, b) => b.score - a.score).find((v) => score >= v.score)?.text ?? '';
}

function finish(s: LabState, c: LabParams, params: number[], by: string, ctx: { rng: () => number; log: (m: string) => void; bonus: number }) {
  s.experiments++;
  const score = clamp(trueScore(params, s.target) + (ctx.rng() * 2 - 1) * c.noise);
  let passed = score >= c.passScore;
  if (passed && ctx.rng() < c.reviewer2Chance) {
    passed = false;
    if (by === 'you') ctx.log(pick(ctx.rng, c.reviewer2));
  }
  if (!s.best || score > s.best.score) s.best = { params: [...params], score };
  if (passed) {
    produce(s, ctx.bonus);
    s.grants += (score - c.passScore + 1) * c.grantPerPoint * funding(c, s);
    s.passes++;
    if (s.passes % c.passesPerPaper === 0) {
      s.papers++;
      ctx.log(`Paper #${s.papers} published: "On the Roundness of Round Things, part ${s.papers}". Funding up.`);
    }
  }
  s.last = { score, passed, by };
}

export const lab: Mechanic<LabParams, LabState> = {
  validate(raw, path) {
    const o = obj(raw, path);
    const st = obj(o.student, `${path}.student`);
    const eq = obj(o.equipment, `${path}.equipment`);
    return {
      knobs: arr(o, 'knobs', path).map((k, i) => {
        const kk = obj(k, `${path}.knobs[${i}]`);
        return { name: str(kk, 'name', path), low: str(kk, 'low', path), high: str(kk, 'high', path) };
      }),
      experimentSeconds: num(o, 'experimentSeconds', path, { min: 0.1 }),
      passScore: num(o, 'passScore', path, { min: 0, max: 100 }),
      noise: num(o, 'noise', path, { min: 0 }),
      grantPerPoint: num(o, 'grantPerPoint', path, { min: 0 }),
      startingGrant: num(o, 'startingGrant', path, { min: 0 }),
      student: {
        name: str(st, 'name', path),
        baseCost: num(st, 'baseCost', path, { min: 1 }),
        costGrowth: num(st, 'costGrowth', path, { min: 1 }),
        slowdown: num(st, 'slowdown', path, { min: 0.1 }),
        jitter: num(st, 'jitter', path, { min: 0 }),
      },
      equipment: {
        name: str(eq, 'name', path),
        baseCost: num(eq, 'baseCost', path, { min: 1 }),
        costGrowth: num(eq, 'costGrowth', path, { min: 1 }),
        speedup: num(eq, 'speedup', path, { min: 0.1, max: 1 }),
      },
      passesPerPaper: num(o, 'passesPerPaper', path, { min: 1 }),
      fundingPerPaper: num(o, 'fundingPerPaper', path, { min: 0 }),
      driftEverySeconds: num(o, 'driftEverySeconds', path, { min: 1 }),
      driftAmount: num(o, 'driftAmount', path, { min: 0 }),
      reviewer2Chance: num(o, 'reviewer2Chance', path, { min: 0, max: 1 }),
      verdicts: arr(o, 'verdicts', path).map((v, i) => {
        const vv = obj(v, `${path}.verdicts[${i}]`);
        return { score: num(vv, 'score', path), text: str(vv, 'text', path) };
      }),
      reviewer2: strs(o, 'reviewer2', path),
      drifts: strs(o, 'drifts', path),
    };
  },

  init: (c) => ({
    wheels: 0,
    made: 0,
    grants: c.startingGrant,
    knobs: c.knobs.map(() => 50),
    // Fixed starting optimum (content-independent so it's the same for everyone); drifts randomly later.
    target: c.knobs.map((_, i) => [73, 21, 88, 40, 62][i % 5] as number),
    best: null,
    manual: null,
    students: 0,
    studentTimers: [],
    equipment: 0,
    passes: 0,
    papers: 0,
    driftTimer: 0,
    last: null,
    experiments: 0,
  }),

  tick(s, c, dt, ctx) {
    if (s.manual) {
      s.manual.remaining -= dt;
      if (s.manual.remaining <= 0) {
        const p = s.manual.params;
        s.manual = null;
        finish(s, c, p, 'you', ctx);
      }
    }
    const studentTime = experimentSeconds(c, s) * c.student.slowdown;
    for (let i = 0; i < s.students; i++) {
      const t = (s.studentTimers[i] ?? studentTime) - dt;
      if (t > 0) {
        s.studentTimers[i] = t;
        continue;
      }
      s.studentTimers[i] = studentTime;
      const base = s.best?.params ?? s.knobs;
      const params = base.map((p) => clamp(p + (ctx.rng() * 2 - 1) * c.student.jitter));
      finish(s, c, params, c.student.name, ctx);
    }
    s.driftTimer += dt;
    if (s.driftTimer >= c.driftEverySeconds) {
      s.driftTimer = 0;
      s.target = s.target.map((t) => clamp(t + (ctx.rng() * 2 - 1) * c.driftAmount, 5, 95));
      // Old "best" was measured against the old definition of round.
      if (s.best) s.best = { params: s.best.params, score: trueScore(s.best.params, s.target) };
      ctx.log(pick(ctx.rng, c.drifts));
    }
  },

  act(s, c, a) {
    switch (a.type) {
      case 'knob': {
        const i = Number(a.index);
        if (Number.isInteger(i) && i >= 0 && i < s.knobs.length) s.knobs[i] = clamp(Number(a.value) || 0);
        break;
      }
      case 'run':
        if (!s.manual) s.manual = { params: [...s.knobs], remaining: experimentSeconds(c, s) };
        break;
      case 'useBest':
        if (s.best) s.knobs = s.best.params.map((p) => Math.round(p));
        break;
      case 'hireStudent': {
        const cost = studentCost(c, s);
        if (s.grants < cost) return;
        s.grants -= cost;
        s.students++;
        break;
      }
      case 'buyEquipment': {
        const cost = equipmentCost(c, s);
        if (s.grants < cost) return;
        s.grants -= cost;
        s.equipment++;
        break;
      }
    }
  },
};
