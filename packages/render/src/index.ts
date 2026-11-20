import { isAttic, type RoomModel } from '@slabs/core';
import { atticBoards, atticGables, atticPlan } from './attic';
import { flatBoards, flatGables, flatPlan } from './flat';
import type { Drawing } from './util';

export * from './util';
export * from './sheets';

/** View from above. */
export const svgPlan = (m: RoomModel): Drawing => (isAttic(m) ? atticPlan(m) : flatPlan(m));
/** Boards unrolled flat (roof + wall, or ceiling + wall, and the band boards). */
export const svgBoards = (m: RoomModel): Drawing => (isAttic(m) ? atticBoards(m) : flatBoards(m));
/** Gable walls (or the band on the four walls). */
export const svgGables = (m: RoomModel): Drawing => (isAttic(m) ? atticGables(m) : flatGables(m));
