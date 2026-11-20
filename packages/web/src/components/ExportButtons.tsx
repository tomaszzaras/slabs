import { useState } from 'react';
import type { CutResult } from '@slabs/core';
import { cutSheets, piecesCsv } from '@slabs/render';
import { lang, roomNameByKey, s } from '../i18n';
import { useStore } from '../state/store';

/** PDF cutting sheets and the piece list of a cut result (nothing is shown for a plan that cannot be built). */
export function ExportButtons({ R, title }: { R: CutResult; title: string }) {
  const project = useStore((st) => st.project);
  const [busy, setBusy] = useState(false);
  if (R.blocking.length || !R.plates.length) return null;
  const pdf = async () => {
    setBusy(true);
    try { const { exportPdf } = await import('../pdf/exportPdf'); await exportPdf({ R, project, s, lang, title, roomName: roomNameByKey }); }
    finally { setBusy(false); }
  };
  const csv = () => {
    const blob = new Blob([piecesCsv(cutSheets(R, project.settings.minOffcutCm, s.pdf.bandWord))], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (project.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'slabs') + '-' + title.replace(/[^\p{L}\p{N}_-]+/gu, '-') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="opts">
      <button type="button" className="pri" disabled={busy} onClick={() => void pdf()}>{s.pdf.button}</button>
      <button type="button" onClick={csv}>{s.pdf.csv}</button>
    </div>
  );
}
