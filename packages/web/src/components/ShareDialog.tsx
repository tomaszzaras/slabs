import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { s } from '../i18n';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { LinkOp } from '../state/cloudApi';

const linkOf = (id: string, token: string) => `${location.origin}${location.pathname}?p=${id}&k=${token}`;

/** One share link: off / on, the address, copy, turn off, new link (the old one stops working). */
function LinkRow({ kind, token, id, title, help }: { kind: 'view' | 'edit'; token: string | null; id: string | null; title: string; help: string }) {
  const { changeSharing } = useStore.getState();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = token && id ? linkOf(id, token) : null;
  const run = async (op: LinkOp) => { setBusy(true); await changeSharing({ [kind]: op }); setBusy(false); setCopied(false); };
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* the address is shown and can be selected */ }
  };
  const hid = `share-${kind}-h`;
  return (
    <section aria-labelledby={hid} data-link={kind} data-on={token ? 'true' : 'false'} className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={hid} className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="size-4" aria-hidden="true" />{title}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${token ? 'border-success/60 text-success' : 'text-muted-foreground'}`}>{token ? s.share.on : s.share.off}</span>
      </div>
      <p className="max-w-[60ch] text-[13px] leading-snug text-muted-foreground">{help}</p>
      {url && (
        <input readOnly aria-label={s.share.linkLabel(title)} value={url} data-a={`${kind}-url`} onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full rounded-md border bg-background px-3 font-mono text-xs" />
      )}
      <div className="flex flex-wrap gap-2">
        {url ? (
          <>
            <Button variant="outline" data-a={`${kind}-copy`} onClick={() => void copy()}>{copied ? <Check /> : <Copy />}{copied ? s.share.copied : s.share.copy}</Button>
            <Button variant="outline" data-a={`${kind}-regen`} disabled={busy} onClick={() => { if (confirm(s.share.regenerateConfirm)) void run('regenerate'); }}>{s.share.regenerate}</Button>
            <Button variant="outline" data-a={`${kind}-off`} disabled={busy} onClick={() => void run('off')}>{s.share.disable}</Button>
          </>
        ) : (
          <Button data-a={`${kind}-on`} disabled={busy || !id} onClick={() => void run('create')}>{s.share.enable}</Button>
        )}
      </div>
    </section>
  );
}

/** Sharing settings of the open project (owner only): a view-only link and an edit link, each can be turned off or regenerated. */
export function ShareDialog() {
  const open = useStore((st) => st.shareOpen);
  const sharing = useStore((st) => st.sharing);
  const failed = useStore((st) => st.sharingError);
  const id = useStore((st) => st.cloudId);
  const { closeShare } = useStore.getState();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeShare(); }}>
      <DialogContent closeLabel={s.rooms.picker.close} data-testid="share-dialog">
        <DialogTitle className="pr-10 text-lg font-semibold tracking-tight">{s.share.title}</DialogTitle>
        <DialogDescription className="max-w-[60ch] text-sm text-muted-foreground">{s.share.intro}</DialogDescription>
        {failed && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{s.share.error}</p>}
        {!sharing && !failed && <p role="status" className="text-sm text-muted-foreground">{s.share.loading}</p>}
        {sharing && (
          <div className="flex flex-col gap-3">
            <LinkRow kind="view" token={sharing.viewToken} id={id} title={s.share.viewTitle} help={s.share.viewHelp} />
            <LinkRow kind="edit" token={sharing.editToken} id={id} title={s.share.editTitle} help={s.share.editHelp} />
          </div>
        )}
        <div className="flex justify-end"><Button variant="outline" onClick={closeShare}>{s.share.done}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
