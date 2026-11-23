// The preset engine behind a room and its inputs, as a hook: components that still show engine inputs (start points, measurement list)
// read them through here, the room itself lives in `Room.spec`.
import { useMemo } from 'react';
import type { RoomType } from '@slabs/core';
import { roomEngine, roomRoof, type RoomRef } from './project';
import { useStore } from './store';

export function useRoomEngine(id: RoomRef): { type: RoomType; params: Record<string, number> } {
  const spec = useStore((st) => st.project.rooms[id]?.spec);
  const roof = useStore((st) => st.project.roof);
  const own = useStore((st) => st.project.rooms[id]?.roof);
  return useMemo(() => {
    const e = roomEngine({ roof, rooms: { [id]: { on: true, spec: spec!, roof: own } } }, id);
    return { type: e.type, params: e.params as Record<string, number> };
  }, [spec, roof, own, id]);
}
export { roomRoof };
