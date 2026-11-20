import { ROOMS, ROOM_IDS, type BlockingIssue, type RoomId } from '@slabs/core';
import { s } from '../i18n';

const keyToRoom = (key: string): RoomId | undefined => ROOM_IDS.find((id) => ROOMS[id].key === key);

/** Human name of an input that can fix a blocking problem (never an internal key). */
function fieldName(room: string, key: string): string {
  if (key === 'trim') return s.settings.trim;
  if (key === 'allowances') return s.settings.allowances;
  const id = keyToRoom(room);
  return (id && ROOMS[id].fields.find((f) => f.key === key)?.label) ?? key;
}

export const pieceLabel = (room: string, ids: number[], seg?: string) => `${room}${ids.join('+')}${seg ?? ''}`;

/** Blocking problems of a cut: shown instead of plates. */
export function Blocking({ issues }: { issues: BlockingIssue[] }) {
  if (!issues.length) return null;
  return (
    <div className="blocked" role="alert">
      <b>{s.room.blocked}</b>
      <ul>
        {issues.slice(0, 6).map((b, i) => (
          <li key={i}>{s.room.blockedPiece(pieceLabel(b.room, b.ids, b.seg), b.roomName, b.dir, Math.round(b.size), Math.round(b.limit), b.fields.map((f) => fieldName(b.room, f)).join(', '))}</li>
        ))}
        {issues.length > 6 && <li>… +{issues.length - 6}</li>}
      </ul>
      <p>{s.room.blockedNoPlates}</p>
    </div>
  );
}
