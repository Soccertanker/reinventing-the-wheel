export const CURRENT_SCHEMA_VERSION = 1;

export interface GameState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  wheels: number;
  totalWheels: number;
  /** producer id -> owned count */
  owned: Record<string, number>;
  /** epoch ms of the last simulated moment; used for offline progress */
  lastTickAt: number;
}

export function newGame(now: number): GameState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    wheels: 0,
    totalWheels: 0,
    owned: {},
    lastTickAt: now,
  };
}
