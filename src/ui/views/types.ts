import type { Era } from '../../core/eras';
import type { Action } from '../../core/mechanics/types';
import type { MechanicState } from '../../core/state';

export interface ViewApi {
  act(action: Action): void;
  /** light haptic tap for primary actions */
  tap(): void;
}

export interface View {
  update(state: MechanicState, bonus: number): void;
}

/** Builds an era's UI once into `root`; update() is then called every frame. */
export type MountView = (root: HTMLElement, era: Era, api: ViewApi) => View;
