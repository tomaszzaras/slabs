// Templates for "+ Dodaj pomieszczenie": presets of the generic room (docs/domain/rooms-model.md, "Templates"). A template only pre-fills a spec; a room
// made from it is edited the same way as any other.
import { presetSpec, type RoomSpec } from './spec';
import { emptySpec } from './spec';

export type AddTemplateId = 'under-roof' | 'sloped' | 'bath' | 'flat' | 'empty' | 'band';

export interface RoomTemplate {
  id: AddTemplateId;
  /** the room it starts with; `band` is not a room but the running-metres item */
  spec: ((side?: 'left' | 'right') => RoomSpec) | null;
  /** the first measurement the user has to give (focused when the room opens): a field key of the Kształt form */
  focus: string;
  /** beside the house wall: the side has to be chosen */
  sides?: Array<'left' | 'right'>;
}

const flat = (walls: 'other' | 'wood'): RoomSpec => {
  const s = emptySpec();
  s.w = 300; s.l = 400; s.ceiling = { kind: 'flat', h: 250 }; s.join = false;
  const fin = walls === 'other' ? { kind: 'other' as const } : { kind: 'wood' as const };
  s.surf = { '2': { finish: fin }, '3': { finish: fin }, '4': { finish: fin }, '5': { finish: fin } };
  return s;
};

export const ROOM_TEMPLATES: RoomTemplate[] = [
  // the whole house width under the roof: a plain rectangle (the salon without its notches)
  { id: 'under-roof', spec: () => { const s = emptySpec(); s.l = 400; return s; }, focus: 'l' },
  // beside the house wall: from the left wall (the bedroom, with a flat cap) or from the right wall (the bathroom 1)
  { id: 'sloped', spec: (side) => presetSpec(side === 'right' ? 'lazienka-1' : 'sypialnia'), focus: 'w', sides: ['left', 'right'] },
  { id: 'bath', spec: () => presetSpec('lazienka-2'), focus: 'w' },
  { id: 'flat', spec: () => flat('other'), focus: 'w' },
  { id: 'empty', spec: () => flat('wood'), focus: 'w' },
  { id: 'band', spec: null, focus: 'len' },
];
export const templateById = (id: AddTemplateId): RoomTemplate => ROOM_TEMPLATES.find((t) => t.id === id)!;
