/**
 * "60 Seconds Before the Boulder": a time-loop roguelite. Pure logic, no DOM.
 * Each loop lasts 60 s of play time. Items reset every loop; knowledge and muscle memory
 * (tasks get faster each time you've done them) persist. Invent the wheel before the boulder hits.
 */
import raw from '../../../content/games/boulder.json';

type Bag = Record<string, number>;

export interface Task {
  id: string;
  name: string;
  seconds: number;
  needs?: { items?: Bag; knows?: string[] };
  consumes?: Bag;
  gives?: { items?: Bag; knows?: string[] };
  /** only appears after this many seconds into the loop */
  afterSecond?: number;
  /** can only be done once per loop */
  once?: boolean;
  win?: 'escape' | 'secret';
  lose?: boolean;
  text: string;
}

export interface Content {
  loopSeconds: number;
  mastery: number;
  minMastery: number;
  queueLimit: number;
  items: Record<string, string>;
  knowledge: Record<string, string>;
  tasks: Task[];
  deaths: string[];
  loopStarts: string[];
}

export function validate(c: Content): Content {
  const ids = new Set<string>();
  for (const t of c.tasks) {
    if (ids.has(t.id)) throw new Error(`duplicate task ${t.id}`);
    ids.add(t.id);
    if (!(t.seconds > 0)) throw new Error(`${t.id}: seconds must be > 0`);
    const items = [...Object.keys(t.needs?.items ?? {}), ...Object.keys(t.consumes ?? {}), ...Object.keys(t.gives?.items ?? {})];
    for (const i of items) if (!(i in c.items)) throw new Error(`${t.id}: unknown item ${i}`);
    for (const k of [...(t.needs?.knows ?? []), ...(t.gives?.knows ?? [])]) if (!(k in c.knowledge)) throw new Error(`${t.id}: unknown knowledge ${k}`);
  }
  if (!c.deaths.length || !c.loopStarts.length) throw new Error('need deaths and loopStarts');
  return c;
}

export const content: Content = validate(raw as Content);

export type Outcome = { kind: 'death' | 'escape' | 'secret' | 'fled'; text: string; time: number };

export interface Run {
  elapsed: number;
  items: Bag;
  done: string[];
  current: { task: string; remaining: number; total: number } | null;
  queue: string[];
  log: string[];
  over: Outcome | null;
}

export interface BoulderSave {
  schemaVersion: 1;
  loops: number;
  knowledge: string[];
  /** task id -> times completed in previous loops (muscle memory) */
  mastery: Record<string, number>;
  /** ids of endings seen: escape, secret, fled, death */
  endings: string[];
  bestEscape: number | null;
  run: Run;
}

function newRun(loop: number, c: Content): Run {
  const start = c.loopStarts[(loop - 1) % c.loopStarts.length] ?? '';
  return { elapsed: 0, items: {}, done: [], current: null, queue: [], log: [start.replace('{n}', String(loop))], over: null };
}

export function newSave(c: Content = content): BoulderSave {
  return { schemaVersion: 1, loops: 1, knowledge: [], mastery: {}, endings: [], bestEscape: null, run: newRun(1, c) };
}

/** Seconds this task takes for you now (muscle memory makes repeat tasks faster). */
export function duration(s: BoulderSave, t: Task, c: Content = content): number {
  const factor = Math.max(c.minMastery, c.mastery ** (s.mastery[t.id] ?? 0));
  return Math.round(t.seconds * factor * 10) / 10;
}

export function visible(s: BoulderSave, t: Task): boolean {
  if (t.afterSecond !== undefined && s.run.elapsed < t.afterSecond) return false;
  // Tasks that need knowledge you don't have stay secret.
  return (t.needs?.knows ?? []).every((k) => s.knowledge.includes(k));
}

/** Why a visible task can't be started right now, or null if it can. Counts items reserved by queued tasks. */
export function blocker(s: BoulderSave, t: Task, c: Content = content): string | null {
  if (s.run.over) return 'loop over';
  if (t.once && (s.run.done.includes(t.id) || s.run.queue.includes(t.id) || s.run.current?.task === t.id)) return 'already done this loop';
  if (s.run.queue.length >= c.queueLimit) return 'queue full';
  const projected = projectItems(s, c);
  for (const [item, n] of Object.entries(t.needs?.items ?? {})) {
    if ((projected[item] ?? 0) < n) return `needs ${n} ${c.items[item] ?? item}`;
  }
  return null;
}

/** Items after the current task and everything queued finishes (so you can plan ahead). */
export function projectItems(s: BoulderSave, c: Content = content): Bag {
  const bag = { ...s.run.items };
  const pending = [s.run.current?.task, ...s.run.queue].filter((x): x is string => !!x);
  for (const id of pending) {
    const t = c.tasks.find((x) => x.id === id);
    if (!t) continue;
    for (const [k, n] of Object.entries(t.consumes ?? {})) bag[k] = (bag[k] ?? 0) - n;
    for (const [k, n] of Object.entries(t.gives?.items ?? {})) bag[k] = (bag[k] ?? 0) + n;
  }
  return bag;
}

export function enqueue(state: BoulderSave, id: string, c: Content = content): BoulderSave {
  const t = c.tasks.find((x) => x.id === id);
  if (!t || !visible(state, t) || blocker(state, t, c)) return state;
  const s = structuredClone(state);
  s.run.queue.push(id);
  startNext(s, c);
  return s;
}

export function cancelQueued(state: BoulderSave, index: number): BoulderSave {
  if (index < 0 || index >= state.run.queue.length) return state;
  const s = structuredClone(state);
  s.run.queue.splice(index, 1);
  return s;
}

function startNext(s: BoulderSave, c: Content) {
  while (!s.run.current && s.run.queue.length && !s.run.over) {
    const id = s.run.queue.shift() as string;
    const t = c.tasks.find((x) => x.id === id);
    if (!t) continue;
    const missing = Object.entries(t.needs?.items ?? {}).some(([k, n]) => (s.run.items[k] ?? 0) < n);
    if (missing) {
      s.run.log.push(`You can't "${t.name}" — missing materials.`);
      continue;
    }
    const d = duration(s, t, c);
    s.run.current = { task: id, remaining: d, total: d };
  }
}

function finish(s: BoulderSave, t: Task, c: Content) {
  for (const [k, n] of Object.entries(t.consumes ?? {})) s.run.items[k] = (s.run.items[k] ?? 0) - n;
  for (const [k, n] of Object.entries(t.gives?.items ?? {})) s.run.items[k] = (s.run.items[k] ?? 0) + n;
  for (const k of t.gives?.knows ?? []) {
    if (!s.knowledge.includes(k)) {
      s.knowledge.push(k);
      s.run.log.push(`📜 Learned: ${c.knowledge[k] ?? k}`);
    }
  }
  s.run.done.push(t.id);
  s.mastery[t.id] = (s.mastery[t.id] ?? 0) + 1;
  s.run.log.push(t.text);
  if (t.win) end(s, t.win, t.text);
  else if (t.lose) end(s, 'fled', t.text);
}

function end(s: BoulderSave, kind: Outcome['kind'], text: string) {
  s.run.over = { kind, text, time: s.run.elapsed };
  s.run.current = null;
  s.run.queue = [];
  if (!s.endings.includes(kind)) s.endings.push(kind);
  if (kind === 'escape' || kind === 'secret') s.bestEscape = Math.min(s.bestEscape ?? Infinity, s.run.elapsed);
}

/** Advances play time by `dt` seconds. */
export function tick(state: BoulderSave, dt: number, c: Content = content): BoulderSave {
  if (state.run.over || dt <= 0) return state;
  // The boulder starts rolling when you make your first move, so you can read first.
  if (state.run.elapsed === 0 && !state.run.current && !state.run.queue.length) return state;
  const s = structuredClone(state);
  let left = dt;
  while (left > 0 && !s.run.over) {
    const step = s.run.current ? Math.min(left, s.run.current.remaining) : left;
    const toBoulder = c.loopSeconds - s.run.elapsed;
    if (step >= toBoulder) {
      s.run.elapsed = c.loopSeconds;
      end(s, 'death', c.deaths[(s.loops - 1) % c.deaths.length] ?? '');
      break;
    }
    s.run.elapsed += step;
    left -= step;
    if (s.run.current) {
      s.run.current.remaining -= step;
      if (s.run.current.remaining <= 1e-9) {
        const t = c.tasks.find((x) => x.id === s.run.current?.task);
        s.run.current = null;
        if (t) finish(s, t, c);
        startNext(s, c);
      }
    }
  }
  return s;
}

/** Start the next loop (after the boulder, or after escaping, to try for a better time). */
export function nextLoop(state: BoulderSave, c: Content = content): BoulderSave {
  const s = structuredClone(state);
  s.loops++;
  s.run = newRun(s.loops, c);
  return s;
}

/** Save migrations for this game (none yet; v1 is the first). */
export const migrations = {};
