/** Content schema. All balance lives in content/*.json; code only interprets it. */

export interface Producer {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  wheelsPerSecond: number;
}

export interface Era {
  id: string;
  name: string;
  clickYield: number;
  producers: Producer[];
}

/** Runtime validation so a bad content edit fails tests/CI instead of the player's game. */
export function validateEra(raw: unknown): Era {
  const fail = (msg: string): never => {
    throw new Error(`Invalid era content: ${msg}`);
  };
  if (typeof raw !== 'object' || raw === null) fail('not an object');
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) fail('id');
  if (typeof e.name !== 'string') fail('name');
  if (typeof e.clickYield !== 'number' || e.clickYield <= 0) fail('clickYield');
  if (!Array.isArray(e.producers)) fail('producers');

  const ids = new Set<string>();
  for (const p of e.producers as unknown[]) {
    const r = p as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id) fail('producer id');
    if (ids.has(r.id as string)) fail(`duplicate producer id ${String(r.id)}`);
    ids.add(r.id as string);
    if (typeof r.name !== 'string') fail(`${String(r.id)}.name`);
    if (typeof r.description !== 'string') fail(`${String(r.id)}.description`);
    if (typeof r.baseCost !== 'number' || r.baseCost <= 0) fail(`${String(r.id)}.baseCost`);
    if (typeof r.costGrowth !== 'number' || r.costGrowth < 1) fail(`${String(r.id)}.costGrowth`);
    if (typeof r.wheelsPerSecond !== 'number' || r.wheelsPerSecond < 0)
      fail(`${String(r.id)}.wheelsPerSecond`);
  }
  return raw as Era;
}
