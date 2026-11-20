import type { MechanicId } from '../../core/mechanics';
import { mountAssembly } from './assembly';
import { mountCosmos } from './cosmos';
import { mountLab } from './lab';
import { mountProducers } from './producers';
import { mountTraining } from './training';
import type { MountView } from './types';

/** One UI per mechanic. Typed so adding a mechanic without a view is a compile error. */
export const views: Record<MechanicId, MountView> = {
  producers: mountProducers,
  assembly: mountAssembly,
  lab: mountLab,
  training: mountTraining,
  cosmos: mountCosmos,
};
