/** "Reinvention" (New Game+) settings: what carries over when you start the whole game again. */
import raw from '../../content/reinvention.json';
import { num, obj, str, strs } from './content';

export interface Meta {
  /** production multiplier per completed reinvention, applied to every era */
  loopMultiplier: number;
  /** era goals multiply by this per reinvention */
  goalGrowth: number;
  /** era name prefixes per loop: Neo-Stone Age, Hyper-Stone Age, ... */
  prefixes: string[];
  button: string;
  endings: string[];
  /** log line when a new loop starts; {n} = reinvention number */
  restarts: string[];
}

export function validateMeta(r: unknown, path = 'content/reinvention.json'): Meta {
  const o = obj(r, path);
  return {
    loopMultiplier: num(o, 'loopMultiplier', path, { min: 1 }),
    goalGrowth: num(o, 'goalGrowth', path, { min: 1 }),
    prefixes: strs(o, 'prefixes', path),
    button: str(o, 'button', path),
    endings: strs(o, 'endings', path),
    restarts: strs(o, 'restarts', path),
  };
}

export const meta: Meta = validateMeta(raw);
