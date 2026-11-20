import { isAttic, type RoomModel } from '@slabs/core';
import { atticBoards, atticGables, atticPlan } from './attic';
import { flatBoards, flatGables, flatPlan } from './flat';
import type { Drawing, Labels } from './util';
import { PL_LABELS } from './util';

export * from './util';
export * from './sheets';
export * from './marks';

/** View from above. */
export const svgPlan = (m: RoomModel, L: Labels = PL_LABELS): Drawing => (isAttic(m) ? atticPlan(m, L) : flatPlan(m, L));
/** Boards unrolled flat (roof + wall, or ceiling + wall, and the band boards). */
export const svgBoards = (m: RoomModel, L: Labels = PL_LABELS): Drawing => (isAttic(m) ? atticBoards(m, L) : flatBoards(m, L));
/** Gable walls (or the band on the four walls). */
export const svgGables = (m: RoomModel, L: Labels = PL_LABELS): Drawing => (isAttic(m) ? atticGables(m, L) : flatGables(m, L));
export * from './cutsheet';
export * from './platemarks';
