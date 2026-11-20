import type { MechanicState } from '../state';
import { assembly } from './assembly';
import { chisel } from './chisel';
import { cosmos } from './cosmos';
import { lab } from './lab';
import { producers } from './producers';
import { training } from './training';
import type { Mechanic } from './types';

/** Every era mechanic. An era's content JSON picks one by id. */
export const mechanics = { producers, chisel, assembly, lab, training, cosmos } as const;

export type MechanicId = keyof typeof mechanics;

/** Type-erased view used by the engine; each mechanic validates its own params and state. */
export type AnyMechanic = Mechanic<unknown, MechanicState>;

export function getMechanic(id: string): AnyMechanic | undefined {
  return (mechanics as Record<string, unknown>)[id] as AnyMechanic | undefined;
}
