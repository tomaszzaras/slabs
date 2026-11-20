import { useState } from 'react';
import type { CutResult } from '@slabs/core';
import { cutSheets, piecesCsv } from '@slabs/render';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lang, roomNameByKey, roomPrefix, s } from '../i18n';
import { useStore } from '../state/store';

/** PDF cutting sheets and the piece list of a cut result (nothing is shown for a plan that cannot be built). */
export function ExportButtons({ R, title }: { R: CutResult; title: string }) {
  const project = useStore((st) => st.project);
  const [busy, setBusy] = useState(false);
  if (R.blocking.length || !R.plates.length) return null;
  const pdf = async () => {
    setBusy(true);
    try { const { exportPdf } = await import('../pdf/exportPdf'); await exportPdf({ R, project, s, lang, title, roomName: roomNameByKey, prefix: roomPrefix }); }
    finally { setBusy(false); }
  };
  const csv = () => {
    const blob = new Blob([piecesCsv(cutSheets(R, project.settings.minOffcutCm, s.pdf.bandWord, project.settings.minStripCm, roomPrefix))], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (project.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'slabs') + '-' + title.replace(/[^\p{L}\p{N}_-]+/gu, '-') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => void pdf()}><Download />{s.pdf.button}</Button>
      <Button variant="outline" onClick={csv}><FileSpreadsheet />{s.pdf.csv}</Button>
    </div>
  );
}
