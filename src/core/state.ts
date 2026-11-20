export const CURRENT_SCHEMA_VERSION = 3;

/** Every mechanic's per-era state has at least these. Everything else is mechanic-specific. */
export interface MechanicState {
  /** spendable wheels in this era */
  wheels: number;
  /** wheels ever made in this era (drives the era goal) */
  made: number;
}

export interface LogEntry {
  seq: number;
  era: string;
  msg: string;
}

export interface GameState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  /** epoch ms of the last simulated moment; used for offline progress */
  lastTickAt: number;
  /** simulated time not yet consumed by a fixed tick */
  pendingMs: number;
  rngSeed: number;
  currentEra: string;
  unlocked: string[];
  completed: string[];
  /** era id -> that era's mechanic state */
  eras: Record<string, MechanicState>;
  log: LogEntry[];
  logSeq: number;
  /** completed full playthroughs (New Game+ loops) */
  reinventions: number;
  /** wheels made in earlier loops (so the all-time total survives a reinvention) */
  pastWheels: number;
}
