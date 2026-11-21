// Templates for "+ Dodaj pomieszczenie": a template only pre-fills a room's fields (type + start values); nothing else differs from a
// room made any other way. The room types behind them are the existing models (docs/domain/rooms-model.md, "Templates").
import type { RoomType } from './rooms';
import type { Params } from './util';

export type AddTemplateId = 'under-roof' | 'sloped' | 'flat' | 'band';

export interface RoomTemplate {
  id: AddTemplateId;
  /** the model behind it; `band` is not a room but the running-metres item */
  type: RoomType | 'band';
  /** values that replace the type's defaults */
  params: Params;
  /** the first measurement the user has to give (focused when the room opens) */
  focus: string;
  /** side of the house the room sits on: the template picks the type by it ('sloped' only) */
  sides?: Array<{ side: 'left' | 'right'; type: RoomType; focus: string }>;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  // the salon model with its notches switched off: the whole width under the roof, a plain rectangle
  { id: 'under-roof', type: 'salon', params: { niche: 0, cA: 0, cB: 0, cutOn: 0, winOn: 0, ZO: 0, L: 400 }, focus: 'L' },
  // beside the house wall: the bedroom model (from the left wall, with an optional flat cap) or the bathroom-1 model (from the right wall)
  { id: 'sloped', type: 'sypialnia', params: {}, focus: 'Wb', sides: [{ side: 'left', type: 'sypialnia', focus: 'Wb' }, { side: 'right', type: 'lazienka-1', focus: 'bw' }] },
  { id: 'flat', type: 'lazienka-2', params: {}, focus: 'bx' },
  { id: 'band', type: 'band', params: {}, focus: 'len' },
];
export const templateById = (id: AddTemplateId): RoomTemplate => ROOM_TEMPLATES.find((t) => t.id === id)!;
