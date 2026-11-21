import { Scissors } from 'lucide-react';
import { joinTooLong, setLineSplit, setStripSplit, type RoofSheet, type RoofSplits, type SplitId } from '@slabs/core';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { s } from '../i18n';

/** Applies "split" or "join" to a whole fold line. Strips where a join would give a piece longer than a plate stay split; their count is returned. */
export function applyLine(sheet: RoofSheet, splits: RoofSplits, id: SplitId, on: boolean, splitAtBends: boolean): { splits: RoofSplits; refused: number } {
  let next = setLineSplit(splits, id, on, splitAtBends);
  let refused = 0;
  if (!on) {
    sheet.strips.forEach((st) => {
      if (!st.cells.some((c) => sheet.bands[c.band]!.folds.some((f) => f.id === id))) return;
      // the join is checked against the state after the line change, one strip at a time
      if (joinTooLong(sheet, setStripSplit(next, st.k, id, true, splitAtBends), st.k, id, splitAtBends) !== null) { next = setStripSplit(next, st.k, id, true, splitAtBends); refused++; }
    });
  }
  return { splits: next, refused };
}

interface Props {
  sheet: RoofSheet;
  splits: RoofSplits;
  splitAtBends: boolean;
  foldName: (id: SplitId) => string;
  onChange: (next: RoofSplits, message?: string) => void;
}

/** Header action of the roof sheet: choose split / join for a whole line at once. */
export function SplitMenu({ sheet, splits, splitAtBends, foldName, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" className="h-11 max-sm:w-11 max-sm:px-0" data-split-menu aria-label={s.sheet.actions} title={s.sheet.actions}><Scissors aria-hidden="true" /><span className="max-sm:sr-only">{s.sheet.actions}</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {sheet.present.map((id) => (
          <div key={id}>
            <DropdownMenuItem data-split-all={id} onSelect={() => onChange(applyLine(sheet, splits, id, true, splitAtBends).splits)}>{s.sheet.splitAll(foldName(id))}</DropdownMenuItem>
            <DropdownMenuItem data-join-all={id} onSelect={() => { const r = applyLine(sheet, splits, id, false, splitAtBends); onChange(r.splits, r.refused ? s.sheet.joinAllRefused(foldName(id), r.refused) : undefined); }}>{s.sheet.joinAll(foldName(id))}</DropdownMenuItem>
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-split-reset onSelect={() => onChange({}, s.sheet.resetDone)}>{s.sheet.reset}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
