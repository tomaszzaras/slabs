import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roomName, s, T_ } from '../i18n';
import { useStore } from '../state/store';

/** One-time note after an older project was moved to the roof sheet: which start offsets of the old roof parts could not be kept. */
export function MigrationNote() {
  const note = useStore((st) => st.project.migration);
  const dismiss = useStore((st) => st.dismissMigration);
  if (!note) return null;
  return (
    <aside className="mx-auto mt-3 flex max-w-[1760px] flex-wrap items-start gap-3 rounded-lg border bg-card p-4 text-sm max-md:mx-4" role="note" aria-labelledby="mig-h" data-migration>
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <b id="mig-h" className="block">{s.sheet.migrationTitle}</b>
        <p>{s.sheet.migration(note.dropped.length)}</p>
        {note.dropped.length > 0 && <ul className="my-1 list-disc pl-5">{note.dropped.map((d, i) => <li key={i}>{s.sheet.migrationItem(roomName(d.room), T_(d.name), d.cm)}</li>)}</ul>}
        {note.renamed > 0 && <p>{s.sheet.migrationNames(note.renamed)}</p>}
        <p className="text-muted-foreground">{s.sheet.migrationHint}</p>
      </div>
      <Button variant="outline" onClick={dismiss}>{s.sheet.migrationOk}</Button>
    </aside>
  );
}
