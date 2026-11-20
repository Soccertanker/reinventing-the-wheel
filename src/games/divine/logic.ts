/**
 * "Divine Inspiration": a god game / discovery puzzle. Pure logic, no DOM.
 * You are a minor god of Round Things. You can't act directly; you send dreams made of two
 * symbols, and the tribe invents whatever they think you meant. Some inventions unlock new
 * symbols, and a chain of them leads to the wheel. Faith (the cost of dreaming) regenerates
 * over time and grows with your followers.
 */
import raw from '../../../content/games/divine.json';

export interface Symbol {
  id: string;
  emoji: string;
  name: string;
  start?: boolean;
}

export interface Invention {
  id: string;
  emoji: string;
  name: string;
  a: string;
  b: string;
  followers: number;
  unlocks?: string[];
  goal?: boolean;
  text: string;
}

export interface Content {
  dreamCost: number;
  startFaith: number;
  faithPerSecond: number;
  baseMaxFaith: number;
  maxFaithPerFollower: number;
  oracleCost: number;
  symbols: Symbol[];
  inventions: Invention[];
  duds: string[];
  repeats: string[];
  chatter: string[];
  oracle: { before: string; text: string }[];
  ending: string;
}

const key = (a: string, b: string) => [a, b].sort().join('+');

export function validate(c: Content): Content {
  const sym = new Set(c.symbols.map((s) => s.id));
  const seen = new Map<string, string>();
  for (const inv of c.inventions) {
    for (const s of [inv.a, inv.b, ...(inv.unlocks ?? [])]) if (!sym.has(s)) throw new Error(`${inv.id}: unknown symbol ${s}`);
    const k = key(inv.a, inv.b);
    if (seen.has(k)) throw new Error(`${inv.id}: same dream as ${seen.get(k)}`);
    seen.set(k, inv.id);
  }
  if (!c.inventions.some((i) => i.goal)) throw new Error('no goal invention');
  return c;
}

export const content: Content = validate(raw as Content);

export interface Revelation {
  text: string;
  invention?: string;
  kind: 'new' | 'repeat' | 'dud' | 'oracle' | 'chatter';
}

export interface DivineSave {
  schemaVersion: 1;
  faith: number;
  followers: number;
  symbols: string[];
  discovered: string[];
  dreams: number;
  last: Revelation | null;
  history: Revelation[];
  /** seconds since the last bit of tribe chatter */
  chatterTimer: number;
  lastTickAt: number;
}

export function newSave(now: number, c: Content = content): DivineSave {
  return {
    schemaVersion: 1,
    faith: c.startFaith,
    followers: 3,
    symbols: c.symbols.filter((s) => s.start).map((s) => s.id),
    discovered: [],
    dreams: 0,
    last: null,
    history: [],
    chatterTimer: 0,
    lastTickAt: now,
  };
}

export const maxFaith = (s: DivineSave, c: Content = content) => Math.floor(c.baseMaxFaith + s.followers * c.maxFaithPerFollower);
export const won = (s: DivineSave, c: Content = content) => c.inventions.some((i) => i.goal && s.discovered.includes(i.id));
export const findInvention = (a: string, b: string, c: Content = content) => c.inventions.find((i) => key(i.a, i.b) === key(a, b));

function reveal(s: DivineSave, r: Revelation) {
  s.last = r;
  s.history.push(r);
  if (s.history.length > 30) s.history.shift();
}

/** Deterministic "random" pick so duds don't depend on Math.random (testable, replayable). */
const pickBy = <T>(items: T[], n: number) => items[Math.abs(n) % items.length] as T;

/** Send a dream of two symbols. */
export function dream(state: DivineSave, a: string, b: string, c: Content = content): DivineSave {
  if (state.faith < c.dreamCost || !state.symbols.includes(a) || !state.symbols.includes(b)) return state;
  const s = structuredClone(state);
  s.faith -= c.dreamCost;
  s.dreams++;
  const inv = findInvention(a, b, c);
  if (!inv) {
    reveal(s, { kind: 'dud', text: pickBy(c.duds, s.dreams * 7 + a.length * 3 + b.length) });
  } else if (s.discovered.includes(inv.id)) {
    reveal(s, { kind: 'repeat', text: pickBy(c.repeats, s.dreams), invention: inv.id });
  } else {
    const wasWon = won(s, c);
    s.discovered.push(inv.id);
    s.followers += inv.followers;
    for (const u of inv.unlocks ?? []) if (!s.symbols.includes(u)) s.symbols.push(u);
    reveal(s, { kind: 'new', text: inv.goal && !wasWon ? `${inv.text} ${c.ending}` : inv.text, invention: inv.id });
  }
  return s;
}

/** A hint toward the next step on the wheel path you haven't found yet. */
export function consultOracle(state: DivineSave, c: Content = content): DivineSave {
  if (state.faith < c.oracleCost || won(state, c)) return state;
  const next = c.oracle.find((o) => !state.discovered.includes(o.before));
  if (!next) return state;
  const s = structuredClone(state);
  s.faith -= c.oracleCost;
  reveal(s, { kind: 'oracle', text: next.text });
  return s;
}

/** Faith regenerates in real time (also while you're away), and the tribe chats now and then. */
export function advance(state: DivineSave, now: number, c: Content = content): DivineSave {
  const dt = Math.min(Math.max(0, (now - state.lastTickAt) / 1000), 24 * 3600);
  if (dt <= 0) return state;
  const s = { ...state, lastTickAt: now };
  s.faith = Math.min(maxFaith(s, c), s.faith + dt * c.faithPerSecond * (1 + s.followers / 50));
  s.chatterTimer = state.chatterTimer + dt;
  if (s.chatterTimer > 40) {
    s.chatterTimer = 0;
    s.history = [...s.history, { kind: 'chatter' as const, text: pickBy(c.chatter, Math.floor(now / 1000)) }].slice(-30);
  }
  return s;
}
