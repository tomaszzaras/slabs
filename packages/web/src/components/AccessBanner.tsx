import { Copy, Eye, Pencil } from 'lucide-react';
import { s } from '../i18n';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';

/** Shown above the project when it is somebody else's: read-only (view link) or editable by link. */
export function AccessBanner() {
  const access = useStore((st) => st.access);
  const { copyToAccount } = useStore.getState();
  if (access === 'owner') return null;
  const view = access === 'view';
  return (
    <div role="status" data-access={access} className="border-b bg-accent/60">
      <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        {view ? <Eye className="size-4 shrink-0" aria-hidden="true" /> : <Pencil className="size-4 shrink-0" aria-hidden="true" />}
        <p className="min-w-0 flex-1 basis-80 max-w-[70ch] leading-snug">{view ? s.access.bannerView : s.access.bannerEdit}</p>
        <Button variant="outline" data-a="copy-mine" onClick={() => void copyToAccount()}><Copy />{s.access.copyMine}</Button>
      </div>
    </div>
  );
}
