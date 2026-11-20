/**
 * "You Are the Wheel": a branching story. You *are* the wheel; each choice decides what you
 * become next across 5,000 years. Collect endings. Choices nudge three traits (Spin, Grip,
 * Wanderlust); a few paths need a trait high enough, and one needs 6 endings found.
 * Pure logic; the whole story is content/games/story.json.
 */
import raw from '../../../content/games/story.json';

export type Traits = Record<string, number>;

export interface Choice {
  text: string;
  to: string;
  traits?: Traits;
  requires?: Traits;
  requiresEndings?: number;
}

export interface StoryNode {
  id: string;
  art: string;
  when: string;
  form: string;
  text: string;
  choices: Choice[];
}

export interface Ending {
  id: string;
  art: string;
  title: string;
  text: string;
}

export interface Content {
  start: string;
  traits: Record<string, string>;
  nodes: StoryNode[];
  endings: Ending[];
}

export function validate(c: Content): Content {
  const ids = new Set([...c.nodes.map((n) => n.id), ...c.endings.map((e) => e.id)]);
  if (ids.size !== c.nodes.length + c.endings.length) throw new Error('duplicate node/ending id');
  if (!c.nodes.some((n) => n.id === c.start)) throw new Error('missing start node');
  for (const n of c.nodes) {
    if (!n.choices.length) throw new Error(`${n.id}: no choices`);
    if (!n.choices.some((ch) => !ch.requires && !ch.requiresEndings)) throw new Error(`${n.id}: every choice is gated (dead end)`);
    for (const ch of n.choices) {
      if (!ids.has(ch.to)) throw new Error(`${n.id}: choice leads to unknown ${ch.to}`);
      for (const t of [...Object.keys(ch.traits ?? {}), ...Object.keys(ch.requires ?? {})]) if (!(t in c.traits)) throw new Error(`${n.id}: unknown trait ${t}`);
    }
  }
  return c;
}

export const content: Content = validate(raw as Content);

export interface StorySave {
  schemaVersion: 1;
  /** current node or ending id */
  at: string;
  traits: Traits;
  /** node ids visited this life */
  path: string[];
  endings: string[];
  lives: number;
}

export function newSave(c: Content = content): StorySave {
  return { schemaVersion: 1, at: c.start, traits: {}, path: [c.start], endings: [], lives: 1 };
}

export const node = (id: string, c: Content = content) => c.nodes.find((n) => n.id === id);
export const ending = (id: string, c: Content = content) => c.endings.find((e) => e.id === id);

/** Why a choice is locked, or null if it can be taken. Locked choices are shown as teasers. */
export function locked(s: StorySave, ch: Choice, c: Content = content): string | null {
  if (ch.requiresEndings !== undefined && s.endings.length < ch.requiresEndings) return `Find ${ch.requiresEndings} endings first (${s.endings.length} so far)`;
  for (const [t, v] of Object.entries(ch.requires ?? {})) {
    if ((s.traits[t] ?? 0) < v) return `Needs ${c.traits[t] ?? t} ${v} (you have ${s.traits[t] ?? 0})`;
  }
  return null;
}

/** Choices to show: hidden entirely if they need endings you're nowhere near. */
export function shownChoices(s: StorySave, c: Content = content): Choice[] {
  const n = node(s.at, c);
  if (!n) return [];
  return n.choices.filter((ch) => ch.requiresEndings === undefined || s.endings.length >= Math.max(1, ch.requiresEndings - 3));
}

export function choose(state: StorySave, index: number, c: Content = content): StorySave {
  const ch = shownChoices(state, c)[index];
  if (!ch || locked(state, ch, c)) return state;
  const s = structuredClone(state);
  for (const [t, v] of Object.entries(ch.traits ?? {})) s.traits[t] = (s.traits[t] ?? 0) + v;
  s.at = ch.to;
  s.path.push(ch.to);
  if (ending(ch.to, c) && !s.endings.includes(ch.to)) s.endings.push(ch.to);
  return s;
}

/** Start a new life (endings are kept). */
export function reincarnate(state: StorySave, c: Content = content): StorySave {
  return { ...state, at: c.start, traits: {}, path: [c.start], lives: state.lives + 1 };
}
