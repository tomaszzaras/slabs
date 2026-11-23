import { ArrowLeft, ArrowRight, Copy, EyeOff, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { roomName, s } from '../i18n';
import { roomHasData, type RoomRef } from '../state/project';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** The menu of one room: rename, duplicate, move, leave out of the calculation, delete (asks first only when the room holds data). */
export function RoomMenu({ id, onRename, className }: { id: RoomRef; onRename?: () => void; className?: string }) {
  const on = useStore((st) => st.project.rooms[id]?.on ?? true);
  const index = useStore((st) => st.project.roomOrder.indexOf(id));
  const count = useStore((st) => st.project.roomOrder.length);
  const name = roomName(id);
  const { duplicateRoom, moveRoom, setRoomOn, removeRoom, showToast } = useStore.getState();
  const remove = () => {
    if (roomHasData(useStore.getState().project, id) && !confirm(s.rooms.confirmRemove(name))) return;
    removeRoom(id);
  };
  const duplicate = () => { if (!duplicateRoom(id)) showToast(s.rooms.full(40)); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} data-room-menu={id} aria-label={s.rooms.menuOf(name)} title={s.rooms.menuOf(name)}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {onRename && <DropdownMenuItem data-a="room-rename" onSelect={onRename}><Pencil />{s.rooms.rename}</DropdownMenuItem>}
        <DropdownMenuItem data-a="room-duplicate" onSelect={duplicate}><Copy />{s.rooms.duplicate}</DropdownMenuItem>
        <DropdownMenuItem data-a="room-left" disabled={index <= 0} onSelect={() => moveRoom(id, -1)}><ArrowLeft />{s.rooms.moveLeft}</DropdownMenuItem>
        <DropdownMenuItem data-a="room-right" disabled={index < 0 || index >= count - 1} onSelect={() => moveRoom(id, 1)}><ArrowRight />{s.rooms.moveRight}</DropdownMenuItem>
        <DropdownMenuItem data-a="room-toggle" onSelect={() => setRoomOn(id, !on)}><EyeOff />{on ? s.rooms.disable : s.rooms.enable}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-a="room-remove" className="text-destructive" onSelect={remove}><Trash2 />{s.rooms.remove}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
