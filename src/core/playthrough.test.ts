/**
 * Balance check: a simple greedy bot plays the whole game in simulated time.
 * Fails if any era can't be finished, and prints how long each era took (pacing).
 */
import { describe, expect, it } from 'vitest';
import { act, advanceBy, goalFor, newGame, reinvent } from './engine';
import { eras } from './eras';
import type { Action } from './mechanics/types';
import { machineCost, stokerCost, type AssemblyParams, type AssemblyState } from './mechanics/assembly';
import { equipmentCost, studentCost, type LabParams, type LabState } from './mechanics/lab';
import { producerCost, type ProducersParams, type ProducersState } from './mechanics/producers';
import { gpuCost, trainingWork, type TrainingParams, type TrainingState } from './mechanics/training';
import { pumpCost, type CosmosParams, type CosmosState } from './mechanics/cosmos';
import type { GameState } from './state';

const cfg = <T>(id: string) => eras.find((e) => e.id === id)?.config as T;

/** Actions a reasonably attentive player might take this second. */
function botActions(s: GameState): Action[] {
  const id = s.currentEra;
  const st = s.eras[id];
  const out: Action[] = [];
  if (id === 'stone') {
    const c = cfg<ProducersParams>(id);
    const x = st as ProducersState;
    out.push({ type: 'click' }, { type: 'click' }, { type: 'click' });
    const best = [...c.producers].filter((p) => producerCost(p, x) <= x.wheels).sort((a, b) => b.wheelsPerSecond / producerCost(b, x) - a.wheelsPerSecond / producerCost(a, x))[0];
    if (best) out.push({ type: 'buy', id: best.id });
  }
  if (id === 'industrial') {
    const c = cfg<AssemblyParams>(id);
    const x = st as AssemblyState;
    if (x.pressure < 60) out.push({ type: 'shovel' }, { type: 'shovel' });
    const machines = Object.values(x.machines).reduce((a, b) => a + b, 0);
    if (x.stokers * c.stoker.pressurePerSecond < machines * c.steamPerMachine * 1.1 && stokerCost(c, x) <= x.wheels) out.push({ type: 'buyStoker' });
    // Buy for the stage whose output is scarcest relative to what the next stage needs.
    const cheapest = [...c.stages].sort((a, b) => machineCost(a, x) - machineCost(b, x));
    const lowStock = c.stages.find((stg) => stg.output !== 'wheel' && (x.stock[stg.output] ?? 0) < 5);
    const target = lowStock ?? c.stages.at(-1) ?? cheapest[0];
    if (target && machineCost(target, x) <= x.wheels) out.push({ type: 'buyMachine', stage: target.id });
  }
  if (id === 'lab') {
    const c = cfg<LabParams>(id);
    const x = st as LabState;
    // Human-ish hill climbing: try a nudge around the best result so far.
    if (!x.manual) {
      const base = x.best?.params ?? x.knobs;
      base.forEach((v, i) => out.push({ type: 'knob', index: i, value: v + (((x.experiments * 7 + i * 13) % 21) - 10) }));
      out.push({ type: 'run' });
    }
    if (studentCost(c, x) <= x.grants) out.push({ type: 'hireStudent' });
    else if (x.students >= 5 && equipmentCost(c, x) <= x.grants) out.push({ type: 'buyEquipment' });
  }
  if (id === 'supercomputer') {
    const c = cfg<TrainingParams>(id);
    const x = st as TrainingState;
    if (gpuCost(c, x) <= x.wheels) out.push({ type: 'buyGpu' });
    if (!x.run) {
      const ds = c.datasets.find((d) => d.id === 'photos');
      let size = c.minLogSize;
      while (ds && size + 0.5 <= c.maxLogSize && trainingWork(c, size + 0.5, ds) / (x.gpus * c.gpu.flops * c.trainingShare) <= 600) size += 0.5;
      out.push({ type: 'dataset', id: 'photos' }, { type: 'size', value: size }, { type: 'alignment', value: 25 }, { type: 'train' });
    }
  }
  if (id === 'cosmic') {
    const c = cfg<CosmosParams>(id);
    const x = st as CosmosState;
    out.push({ type: 'pi', value: 3.1416 }, { type: 'gravity', value: 0 });
    if (!x.universe) out.push({ type: 'bang' });
    else if (!x.universe.alive) out.push({ type: 'crunch' }, { type: 'bang' });
    if (pumpCost(c, x) <= x.wheels) out.push({ type: 'buyPump' });
    if (!x.daemon && x.wheels >= c.daemon.cost) out.push({ type: 'buyDaemon' });
  }
  return out;
}

describe('playthrough', () => {
  it('a greedy bot can finish every era in reasonable time', () => {
    let s = newGame(eras, 0, 123);
    const finishedAt: Record<string, number> = {};
    const limit = 8 * 3600;
    let t = 0;
    for (; t < limit && s.completed.length < eras.length; t++) {
      for (const a of botActions(s)) s = act(s, eras, s.currentEra, a);
      s = advanceBy(s, eras, 1000);
      for (const id of s.completed) finishedAt[id] ??= t;
      const next = eras.find((e) => s.unlocked.includes(e.id) && !s.completed.includes(e.id));
      if (next) s = { ...s, currentEra: next.id };
      if (process.env.TRACE && t % 600 === 0) console.log(t, s.currentEra, JSON.stringify(s.eras[s.currentEra], (k, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : k === "loss" ? undefined : v)));
    }
    let prev = 0;
    const report = eras.map((e) => {
      const at = finishedAt[e.id];
      const line = `${e.name.padEnd(16)} ${at === undefined ? 'NOT FINISHED' : `${((at - prev) / 60).toFixed(1)} min`}`;
      if (at !== undefined) prev = at;
      return line;
    });
    console.log(`Bot playthrough (simulated):\n  ${report.join('\n  ')}\n  total: ${(t / 60).toFixed(1)} min`);
    expect(s.completed).toEqual(eras.map((e) => e.id));

    // New Game+: the second loop should be faster despite bigger goals.
    s = reinvent(s, eras);
    let t2 = 0;
    for (; t2 < limit && s.completed.length < eras.length; t2++) {
      for (const a of botActions(s)) s = act(s, eras, s.currentEra, a);
      s = advanceBy(s, eras, 1000);
      const next = eras.find((e) => s.unlocked.includes(e.id) && !s.completed.includes(e.id));
      if (next) s = { ...s, currentEra: next.id };
    }
    console.log(`  reinvention #1 (goals ×${goalFor(s, eras[0]!) / eras[0]!.goal.made}): ${(t2 / 60).toFixed(1)} min`);
    expect(s.completed.length).toBe(eras.length);
    expect(t2).toBeLessThan(t);
  });
});
