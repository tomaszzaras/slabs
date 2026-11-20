import { ROOMS, ROOM_IDS, pieceLabel as label, type BlockingIssue, type RoomId } from '@slabs/core';
import { AlertTriangle } from 'lucide-react';
import { T_, roomNameByKey, roomPrefix, s } from '../i18n';

const keyToRoom = (key: string): RoomId | undefined => ROOM_IDS.find((id) => ROOMS[id].key === key);

/** Human name of an input that can fix a blocking problem (never an internal key). */
function fieldName(room: string, key: string): string {
  if (key === 'trim') return s.settings.trim;
  if (key === 'allowances') return s.settings.allowances;
  const id = keyToRoom(room);
  const label = id && ROOMS[id].fields.find((f) => f.key === key)?.label;
  return label ? T_(label) : key;
}

export const pieceLabel = (room: string, ids: number[], seg?: string) => label(roomPrefix(room), ids, seg);

/** Blocking problems of a cut: shown instead of plates. */
export function Blocking({ issues }: { issues: BlockingIssue[] }) {
  if (!issues.length) return null;
  return (
    <div className="blocked rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm" role="alert">
      <b className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-4" />{s.room.blocked}</b>
      <ul className="my-2 list-disc space-y-1 pl-5">
        {issues.slice(0, 6).map((b, i) => (
          <li key={i}>{s.room.blockedPiece(pieceLabel(b.room, b.ids, b.seg), roomNameByKey(b.room), b.dir, Math.round(b.size), Math.round(b.limit), b.fields.map((f) => fieldName(b.room, f)).join(', '))}</li>
        ))}
        {issues.length > 6 && <li>… +{issues.length - 6}</li>}
      </ul>
      <p className="text-muted-foreground">{s.room.blockedNoPlates}</p>
    </div>
  );
}
