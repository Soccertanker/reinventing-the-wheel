import { ContentError, validateEraDef, type EraDef } from './content';
import { getMechanic, type AnyMechanic } from './mechanics';

export interface Era extends EraDef {
  impl: AnyMechanic;
  /** validated mechanic params */
  config: unknown;
}

/** Validates era definitions: unique ids/orders, known mechanic, valid params. */
export function loadEras(files: Record<string, unknown>): Era[] {
  const eras = Object.entries(files).map(([file, raw]) => {
    const def = validateEraDef(raw, file);
    const impl = getMechanic(def.mechanic);
    if (!impl) throw new ContentError(`${file}: unknown mechanic "${def.mechanic}"`);
    return { ...def, impl, config: impl.validate(def.params, `${file}.params`) };
  });
  eras.sort((a, b) => a.order - b.order);
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const e of eras) {
    if (ids.has(e.id)) throw new ContentError(`duplicate era id ${e.id}`);
    if (orders.has(e.order)) throw new ContentError(`duplicate era order ${e.order}`);
    ids.add(e.id);
    orders.add(e.order);
  }
  if (!eras.length) throw new ContentError('no eras');
  return eras;
}

/**
 * Every content/eras/*.json is bundled at build time (offline-first).
 * Adding an era that uses an existing mechanic is a content-only change: drop in a JSON file.
 */
const files = import.meta.glob('../../content/eras/*.json', { eager: true, import: 'default' });
export const eras: readonly Era[] = loadEras(files);
