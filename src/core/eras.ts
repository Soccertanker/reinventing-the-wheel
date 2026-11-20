import stoneJson from '../../content/stone.json';
import { validateEra, type Era } from './content';

/** Bundled at build time (offline-first). Add new eras here as content drops. */
export const eras: readonly Era[] = [validateEra(stoneJson)];
