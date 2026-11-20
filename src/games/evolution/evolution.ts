/**
 * "Survival of the Roundest": a population of random shapes rolls down a hill; the ones that get
 * farthest breed. Pure, deterministic (seeded RNG in the save). You play a meddling god:
 * change the terrain, crank the mutation rate, drop a meteor, or make pointy shapes attractive.
 */
import raw from '../../../content/games/evolution.json';
import { bodyFromGenome, roundness, simulate, type SimParams, type SimResult } from './physics';

export interface Content {
  genes: number;
  population: number;
  elites: number;
  minRadius: number;
  maxRadius: number;
  finish: number;
  maxSeconds: number;
  push: number;
  gravity: number;
  terrains: { id: string; name: string; slope: number; text: string }[];
  names: { min: number; genus: string }[];
  species: string[];
  milestones: { id: string; kind: 'distance' | 'finish' | 'roundness' | 'wheel'; value: number; text: string }[];
  meteor: string[];
  design: string[];
  pointy: string[];
}

export const content = raw as Content;

export interface GenStats {
  best: number;
  avg: number;
  round: number;
}

export interface EvoSave {
  schemaVersion: 1;
  seed: number;
  generation: number;
  population: number[][];
  terrain: string;
  /** 0..1 mutation strength */
  chaos: number;
  pointyLove: boolean;
  history: GenStats[];
  milestones: string[];
  champion: { genome: number[]; fitness: number; generation: number; name: string } | null;
  cheated: boolean;
  log: string[];
}

/** mulberry32; returns [value, nextSeed] so the seed can live in the save. */
function rand(seed: number): [number, number] {
  let s = (seed + 0x6d2b79f5) >>> 0;
  const next = s;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  return [((s ^ (s >>> 14)) >>> 0) / 4294967296, next];
}

class Rng {
  constructor(public seed: number) {}
  next(): number {
    const [v, s] = rand(this.seed);
    this.seed = s;
    return v;
  }
  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }
}

const clamp = (v: number, c: Content) => Math.max(c.minRadius, Math.min(c.maxRadius, v));
const randomGenome = (rng: Rng, c: Content) => Array.from({ length: c.genes }, () => c.minRadius + rng.next() * (c.maxRadius - c.minRadius));

export function newSave(seed = 12345, c: Content = content): EvoSave {
  const rng = new Rng(seed);
  const population = Array.from({ length: c.population }, () => randomGenome(rng, c));
  return {
    schemaVersion: 1,
    seed: rng.seed,
    generation: 1,
    population,
    terrain: c.terrains[0]?.id ?? 'gentle',
    chaos: 0.35,
    pointyLove: false,
    history: [],
    milestones: [],
    champion: null,
    cheated: false,
    log: ['Gen 1: twenty random blobs stand at the top of a hill. None of them know what a wheel is.'],
  };
}

export function simParams(s: EvoSave, c: Content = content): SimParams {
  const terrain = c.terrains.find((t) => t.id === s.terrain) ?? c.terrains[0];
  return { slopeDeg: terrain?.slope ?? 6, gravity: c.gravity, push: c.push, maxSeconds: c.maxSeconds, finish: c.finish };
}

export interface Evaluated {
  genome: number[];
  result: SimResult;
  round: number;
  fitness: number;
}

export function evaluate(genome: number[], s: EvoSave, c: Content = content, record = false): Evaluated {
  const body = bodyFromGenome(genome);
  const result = simulate(body, simParams(s, c), record);
  const round = roundness(body);
  let fitness = result.finished ? c.finish + (c.maxSeconds - result.time) * 2 : result.distance;
  if (s.pointyLove) fitness += (1 - round) * 40;
  return { genome, result, round, fitness };
}

/** A silly Latin name from a genome (stable for the same shape). */
export function speciesName(genome: number[], c: Content = content): string {
  const r = roundness(bodyFromGenome(genome));
  const genus = c.names.find((n) => r >= n.min)?.genus ?? 'Blobbus';
  const h = Math.floor(genome.reduce((a, g, i) => a + g * (i + 1) * 997, 0));
  return `${genus} ${c.species[h % c.species.length]}`;
}

function log(s: EvoSave, msg: string) {
  s.log.push(`Gen ${s.generation}: ${msg}`);
  if (s.log.length > 40) s.log.shift();
}

/** Evaluate this generation, record stats and milestones, then breed the next one. */
export function step(state: EvoSave, c: Content = content): EvoSave {
  const s = structuredClone(state);
  const rng = new Rng(s.seed);
  const ranked = s.population.map((g) => evaluate(g, s, c)).sort((a, b) => b.fitness - a.fitness);
  const best = ranked[0] as Evaluated;
  s.history.push({ best: best.result.distance, avg: ranked.reduce((t, e) => t + e.result.distance, 0) / ranked.length, round: best.round });
  if (s.history.length > 400) s.history.shift();
  if (!s.champion || best.fitness > s.champion.fitness) {
    s.champion = { genome: best.genome, fitness: best.fitness, generation: s.generation, name: speciesName(best.genome, c) };
  }
  for (const m of c.milestones) {
    if (s.milestones.includes(m.id)) continue;
    const hit =
      (m.kind === 'distance' && best.result.distance >= m.value) ||
      (m.kind === 'finish' && ranked.some((e) => e.result.finished)) ||
      (m.kind === 'roundness' && best.round >= m.value) ||
      (m.kind === 'wheel' && ranked.some((e) => e.result.finished && e.round >= m.value));
    if (hit) {
      s.milestones.push(m.id);
      log(s, `${m.text}${m.kind === 'wheel' ? ` (It took ${s.generation} generations.${s.cheated ? ' With divine help.' : ''})` : ''}`);
    }
  }

  // Breed: elites survive; the rest are children of tournament-picked parents.
  const parents = ranked.slice(0, Math.max(2, Math.ceil(ranked.length / 2)));
  const tournament = () => {
    const a = rng.pick(parents);
    const b = rng.pick(parents);
    return a.fitness >= b.fitness ? a : b;
  };
  const next = ranked.slice(0, c.elites).map((e) => e.genome);
  while (next.length < c.population) {
    const ma = tournament().genome;
    const pa = tournament().genome;
    const child = ma.map((g, i) => (rng.next() < 0.5 ? g : (pa[i] ?? g)));
    const strength = 0.05 + s.chaos * 0.35;
    const rate = 0.1 + s.chaos * 0.4;
    next.push(child.map((g) => (rng.next() < rate ? clamp(g + (rng.next() * 2 - 1) * strength, c) : g)));
  }
  s.population = next;
  s.generation++;
  s.seed = rng.seed;
  return s;
}

/** ☄️ Kill the best half; random blobs take their place. */
export function meteor(state: EvoSave, c: Content = content): EvoSave {
  const s = structuredClone(state);
  const rng = new Rng(s.seed);
  const ranked = s.population.map((g) => evaluate(g, s, c)).sort((a, b) => b.fitness - a.fitness);
  const half = Math.floor(ranked.length / 2);
  s.population = [...ranked.slice(half).map((e) => e.genome), ...Array.from({ length: half }, () => randomGenome(rng, c))];
  log(s, rng.pick(c.meteor));
  s.seed = rng.seed;
  return s;
}

/** 🙌 Cheat: drop a perfect circle into the population. */
export function intelligentDesign(state: EvoSave, c: Content = content): EvoSave {
  const s = structuredClone(state);
  const rng = new Rng(s.seed);
  s.population[s.population.length - 1] = Array(c.genes).fill(c.maxRadius);
  s.cheated = true;
  log(s, rng.pick(c.design));
  s.seed = rng.seed;
  return s;
}

export function setTerrain(state: EvoSave, id: string, c: Content = content): EvoSave {
  const t = c.terrains.find((x) => x.id === id);
  if (!t || t.id === state.terrain) return state;
  const s = structuredClone(state);
  s.terrain = id;
  log(s, t.text);
  return s;
}

export function togglePointy(state: EvoSave, c: Content = content): EvoSave {
  const s = structuredClone(state);
  s.pointyLove = !s.pointyLove;
  log(s, s.pointyLove ? (c.pointy[s.generation % c.pointy.length] ?? '') : '💔 Pointy is out. Rolling is attractive again.');
  return s;
}

export function setChaos(state: EvoSave, chaos: number): EvoSave {
  return { ...state, chaos: Math.max(0, Math.min(1, chaos)) };
}
