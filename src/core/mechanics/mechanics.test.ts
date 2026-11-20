import { describe, expect, it } from 'vitest';
import { eras } from '../eras';
import { makeRng } from '../rng';
import { assembly, MAX_PRESSURE, type AssemblyParams } from './assembly';
import { cosmos, piQuality, type CosmosParams } from './cosmos';
import { lab, trueScore, type LabParams } from './lab';
import { producers, type ProducersParams } from './producers';
import { outcomes, training, type TrainingParams } from './training';
import type { Ctx } from './types';

const cfg = <T>(id: string) => eras.find((e) => e.id === id)?.config as T;
function ctx(seed = 1): Ctx & { logs: string[] } {
  const rng = makeRng(seed);
  const logs: string[] = [];
  return { rng: () => rng.next(), bonus: 1, log: (m) => logs.push(m), logs };
}
function run<S>(m: { tick: (s: S, c: never, dt: number, x: Ctx) => void }, s: S, c: unknown, seconds: number, x = ctx()) {
  for (let t = 0; t < seconds * 4; t++) m.tick(s, c as never, 0.25, x);
}

describe('producers (Stone Age)', () => {
  const c = cfg<ProducersParams>('stone');
  it('click, buy, produce', () => {
    const s = producers.init(c);
    for (let i = 0; i < 10; i++) producers.act(s, c, { type: 'click' }, ctx());
    producers.act(s, c, { type: 'buy', id: 'chisel' }, ctx());
    expect(s.wheels).toBe(0);
    expect(s.owned.chisel).toBe(1);
    run(producers, s, c, 10);
    expect(s.wheels).toBeCloseTo(2);
  });
});

describe('assembly (Industrial)', () => {
  const c = cfg<AssemblyParams>('industrial');
  it('makes nothing without steam, wheels with it', () => {
    const s = assembly.init(c);
    run(assembly, s, c, 30);
    expect(s.made).toBe(0);
    s.stokers = 3;
    run(assembly, s, c, 120);
    expect(s.made).toBeGreaterThan(5);
  });

  it('the valve prevents explosions; without it the boiler blows and wrecks a machine', () => {
    const s = assembly.init(c);
    s.stokers = 40;
    s.machines.smelt = 3;
    run(assembly, s, c, 20);
    expect(s.explosions).toBe(0);
    expect(s.pressure).toBeLessThanOrEqual(c.valveAt);
    s.valve = false;
    const x = ctx();
    run(assembly, s, c, 20, x);
    expect(s.explosions).toBeGreaterThan(0);
    expect(s.machines.smelt).toBeLessThan(3);
    expect(x.logs.length).toBeGreaterThan(0);
    expect(s.pressure).toBeLessThanOrEqual(MAX_PRESSURE + 50);
  });
});

describe('lab (Modern Lab)', () => {
  const c = cfg<LabParams>('lab');
  it('scores 100 at the optimum', () => {
    expect(trueScore([10, 20, 30], [10, 20, 30])).toBe(100);
    expect(trueScore([0, 0, 0], [100, 100, 100])).toBe(0);
  });

  it('grad students hill-climb toward the optimum and pass prototypes', () => {
    const s = lab.init(c);
    s.students = 8;
    run(lab, s, c, 600);
    expect(s.best?.score ?? 0).toBeGreaterThan(c.passScore);
    expect(s.made).toBeGreaterThan(10);
    expect(s.grants).toBeGreaterThan(0);
  });
});

describe('training (Supercomputer)', () => {
  const c = cfg<TrainingParams>('supercomputer');
  it('trains a first model, deploys it, and it makes wheels', () => {
    const s = training.init(c);
    training.act(s, c, { type: 'dataset', id: 'synthetic' }, ctx());
    training.act(s, c, { type: 'train' }, ctx());
    expect(s.run).toBeNull(); // no model yet to make synthetic data from
    training.act(s, c, { type: 'dataset', id: 'photos' }, ctx());
    training.act(s, c, { type: 'train' }, ctx());
    expect(s.run).not.toBeNull();
    run(training, s, c, 60);
    expect(s.model?.generation).toBe(1);
    expect(s.made).toBeGreaterThan(0);
    expect(s.hallucinated).toBeGreaterThan(0);
  });

  it('alignment trades hallucinations for refusals', () => {
    const lo = outcomes(0.5, 0);
    const hi = outcomes(0.5, 100);
    expect(hi.hallucination).toBeLessThan(lo.hallucination);
    expect(hi.refusal).toBeGreaterThan(lo.refusal);
    for (const o of [lo, hi]) expect(o.wheel + o.hallucination + o.refusal).toBeCloseTo(1);
  });
});

describe('cosmos (Cosmic)', () => {
  const c = cfg<CosmosParams>('cosmic');
  it('wrong pi makes polygons, right pi makes wheels', () => {
    expect(piQuality(Math.PI, c.piTolerance)).toBe(1);
    expect(piQuality(3, c.piTolerance)).toBeLessThan(1e-6);
    const good = cosmos.init(c);
    cosmos.act(good, c, { type: 'pi', value: 3.1416 }, ctx());
    cosmos.act(good, c, { type: 'gravity', value: 0 }, ctx());
    cosmos.act(good, c, { type: 'bang' }, ctx());
    const bad = structuredClone(good);
    bad.universe!.pi = 3;
    run(cosmos, good, c, 60);
    run(cosmos, bad, c, 60);
    expect(good.made).toBeGreaterThan(1000);
    expect(bad.made).toBeLessThan(1);
  });

  it('crunching converts a universe into insight', () => {
    const s = cosmos.init(c);
    cosmos.act(s, c, { type: 'pi', value: 3.1416 }, ctx());
    cosmos.act(s, c, { type: 'gravity', value: 0 }, ctx());
    cosmos.act(s, c, { type: 'bang' }, ctx());
    run(cosmos, s, c, 60);
    cosmos.act(s, c, { type: 'crunch' }, ctx());
    expect(s.insight).toBeGreaterThan(1);
    expect(s.universe).toBeNull();
  });
});
