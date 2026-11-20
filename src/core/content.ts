/** Content schema + validation helpers. Balance and text live in content/eras/*.json. */

export interface EraDef {
  id: string;
  name: string;
  order: number;
  /** which mechanic module runs this era (see mechanics/index.ts) */
  mechanic: string;
  tagline: string;
  /** shown in the log when the era unlocks */
  intro: string;
  goal: { made: number; label: string };
  /** production multiplier granted to all later eras once this era's goal is met */
  bonus: number;
  /** accent color for the era's UI */
  accent: string;
  /** mechanic-specific parameters, validated by the mechanic */
  params: unknown;
}

export class ContentError extends Error {}

type Obj = Record<string, unknown>;

export function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ContentError(`${path}: expected object`);
  return v as Obj;
}

export function num(o: Obj, key: string, path: string, opts: { min?: number; max?: number } = {}): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ContentError(`${path}.${key}: expected number`);
  if (opts.min !== undefined && v < opts.min) throw new ContentError(`${path}.${key}: must be >= ${opts.min}`);
  if (opts.max !== undefined && v > opts.max) throw new ContentError(`${path}.${key}: must be <= ${opts.max}`);
  return v;
}

export function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v === '') throw new ContentError(`${path}.${key}: expected non-empty string`);
  return v;
}

export function arr(o: Obj, key: string, path: string, minLength = 1): unknown[] {
  const v = o[key];
  if (!Array.isArray(v) || v.length < minLength) throw new ContentError(`${path}.${key}: expected array (>= ${minLength})`);
  return v;
}

export function strs(o: Obj, key: string, path: string): string[] {
  return arr(o, key, path).map((s, i) => {
    if (typeof s !== 'string' || !s) throw new ContentError(`${path}.${key}[${i}]: expected string`);
    return s;
  });
}

export function uniqueIds<T extends { id: string }>(items: T[], path: string): T[] {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) throw new ContentError(`${path}: duplicate id ${it.id}`);
    seen.add(it.id);
  }
  return items;
}

export function validateEraDef(raw: unknown, file: string): EraDef {
  const o = obj(raw, file);
  const goal = obj(o.goal, `${file}.goal`);
  const accent = str(o, 'accent', file);
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new ContentError(`${file}.accent: expected #rrggbb`);
  return {
    id: str(o, 'id', file),
    name: str(o, 'name', file),
    order: num(o, 'order', file, { min: 1 }),
    mechanic: str(o, 'mechanic', file),
    tagline: str(o, 'tagline', file),
    intro: str(o, 'intro', file),
    goal: { made: num(goal, 'made', `${file}.goal`, { min: 1 }), label: str(goal, 'label', `${file}.goal`) },
    bonus: num(o, 'bonus', file, { min: 1 }),
    accent,
    params: o.params,
  };
}
