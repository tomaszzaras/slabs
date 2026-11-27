import { useEffect, useState } from 'react';
import { lang, s } from '../i18n';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** "Dodaj do konta": the projects of this browser and of the old link just opened, with checkboxes (all ticked); asked once. */
export function ClaimDialog() {
  const open = useStore((st) => st.claimOpen);
  const items = useStore((st) => st.claimItems);
  const { closeClaim } = useStore.getState();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPicked(items.map((x) => x.key)); setBusy(false); } }, [open, items]);
  const toggle = (k: string, on: boolean) => setPicked((p) => (on ? [...new Set([...p, k])] : p.filter((x) => x !== k)));
  const date = (t: number) => (t ? new Date(t).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) void closeClaim(null); }}>
      <DialogContent closeLabel={s.rooms.picker.close} data-testid="claim-dialog">
        <DialogTitle className="pr-10 text-lg font-semibold tracking-tight">{s.claim.title}</DialogTitle>
        <DialogDescription className="max-w-[60ch] text-sm text-muted-foreground">{s.claim.intro}</DialogDescription>
        <ul className="flex flex-col gap-1" role="list">
          {items.map((x) => (
            <li key={x.key} className="flex items-center gap-1 rounded-lg border">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 p-2" htmlFor={`claim-${x.key}`}>
                <Checkbox id={`claim-${x.key}`} data-claim={x.key} checked={picked.includes(x.key)} onCheckedChange={(v) => toggle(x.key, v === true)} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{x.name || s.app.defaultProjectName}</span>
                  <span className="text-xs text-muted-foreground">{x.source === 'link' ? s.claim.fromLink : s.claim.fromBrowser}{x.updatedAt ? ` · ${s.claim.updated(date(x.updatedAt))}` : ''}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} data-a="claim-skip" onClick={() => void closeClaim(null)}>{s.claim.skip}</Button>
          <Button disabled={busy || !picked.length} data-a="claim-add" onClick={() => { setBusy(true); void closeClaim(picked).then(() => setBusy(false)); }}>{busy ? s.claim.adding : s.claim.add(picked.length)}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
