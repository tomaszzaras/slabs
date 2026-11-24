import { edgesOf, area, notch, roomKind } from '@slabs/core';
import { Pencil } from 'lucide-react';
import { nf, s } from '../i18n';
import { roofOverrides, roomRoof } from '../state/project';
import { useStore } from '../state/store';
import type { RoomRef } from '../state/project';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumField } from './Fields';
import { OutlineEditor } from './OutlineEditor';
import { ShapeForm } from './ShapeForm';

/** Kształt as the page shows it: read-only values and the plan, until "Edytuj" opens the editor. */
export function ShapeBlock({ id, plan, editing, onEditing }: { id: RoomRef; plan: string; editing: boolean; onEditing: (e: boolean) => void }) {
  const room = useStore((st) => st.project.rooms[id]!);
  const roofP = useStore((st) => st.project.roof);
  const { setOutline, setParam, setSpec } = useStore.getState();
  const spec = room.spec;
  const roof = roomRoof({ roof: roofP, rooms: { [id]: room } }, id);
  if (editing) {
    return (
      <div className="flex flex-col gap-4" data-shape-edit>
        {spec.outline ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`p_${id}_h`}>{s.spec.height}</Label>
              {spec.ceiling.kind === 'flat' ? (
                <div className="flex items-center gap-2"><NumField id={`p_${id}_h`} className="w-28 flex-none" value={spec.ceiling.h} label={s.spec.height} onValue={(v) => setParam(id, 'H', v)} /><span className="text-sm text-muted-foreground">cm</span></div>
              ) : (
                <>
                  <Label htmlFor={`p_${id}_ox`}>{s.shapeView.fromLeft}</Label>
                  <div className="flex items-center gap-2"><NumField id={`p_${id}_ox`} className="w-28 flex-none" value={spec.outlineX ?? 0} label={s.shapeView.fromLeft} onValue={(v) => setSpec(id, (x) => ({ ...x, outlineX: Math.max(0, v) }), 'ox')} /><span className="text-sm text-muted-foreground">cm</span></div>
                  {(spec.outlineX ?? 0) + spec.w > roof.W && <p className="text-sm text-destructive" role="alert" data-ox-warn>{s.shapeView.outsideHouse(nf(roof.W))}</p>}
                  <Label htmlFor={`p_${id}_HL`}>{s.spec.roofLabels.HL}</Label>
                  <div className="flex flex-wrap items-center gap-2"><NumField id={`p_${id}_HL`} className="w-28 flex-none" value={roof.HL} label={s.spec.roofLabels.HL} onValue={(v) => setParam(id, 'HL', v)} /><span className="text-sm text-muted-foreground">cm</span>{roofOverrides(room).includes('HL') && <Button variant="link" size="sm" className="h-auto min-h-11 px-1 underline" data-reset-roof="HL" onClick={() => useStore.getState().resetRoomRoof(id, 'HL')}>{s.spec.roofReset(`${nf(roofP.HL)} cm`)}</Button>}</div>
                  <p className="text-[13px] text-muted-foreground">{s.shapeView.roofFromProject}</p>
                </>
              )}
              <p className="max-w-[56ch] pt-2 text-sm text-muted-foreground">{s.wiz.dimsHelp}</p>
            </div>
            <OutlineEditor outline={spec.outline} onChange={(o) => setOutline(id, o)} />
          </div>
        ) : <ShapeForm id={id} plan={plan} />}
        <div><Button data-a="shape-done" onClick={() => onEditing(false)}>{s.shapeView.done}</Button></div>
      </div>
    );
  }
  const own = roofOverrides(room);
  const rows: Array<[string, string]> = [];
  rows.push([s.spec.ceiling, spec.ceiling.kind === 'flat' ? s.spec.ceilFlat : s.spec.ceilRoof]);
  if (spec.ceiling.kind === 'roof' && spec.outline) rows.push([s.shapeView.fromLeft, `${nf(spec.outlineX ?? 0)} cm`]);
  else if (spec.ceiling.kind === 'roof') rows.push([s.spec.position, spec.pos === 'full' ? s.spec.posFull : spec.pos === 'left' ? s.spec.posLeft : s.spec.posRight]);
  if (spec.ceiling.kind === 'roof' && spec.pos === 'full' && !spec.outline) rows.push([s.spec.width, `${nf(roof.W)} cm`]); else if (!spec.outline) rows.push([s.spec.width, `${nf(spec.w)} cm`]);
  if (!spec.outline) rows.push([s.spec.length, `${nf(spec.l)} cm`]);
  if (spec.ceiling.kind === 'flat') rows.push([s.spec.height, `${nf(spec.ceiling.h)} cm`]);
  if (spec.ceiling.kind === 'roof' && spec.ceiling.cap > 0) rows.push([s.spec.capH, `${nf(spec.ceiling.cap)} cm`]);
  if (spec.ceiling.kind === 'roof') for (const k of ['W', 'ang', 'HL'] as const) rows.push([s.spec.roofLabels[k], `${nf(roof[k])} ${k === 'ang' ? '°' : 'cm'}${own.includes(k) ? ` (${s.spec.roofOwn})` : ''}`]);
  (['corner', 'recess', 'offset'] as const).forEach((k) => { const n = notch(spec, k); if (n) rows.push([s.spec.notchKinds[k], k === 'offset' ? `${nf(n.a)} cm` : `${nf(n.a)} × ${nf(n.b)} cm`]); });
  if (spec.outline) rows.push([s.shapeView.floorArea, `${nf(area(spec.outline) / 1e4, 2)} m²`]);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]" data-shape-view data-kind={roomKind(spec)}>
      <div className="flex flex-col gap-3">
        <dl className="grid max-w-xl grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 text-sm" data-testid="shape-values">
          {rows.map(([k, v]) => <div key={k} className="col-span-2 grid grid-cols-subgrid border-b py-1"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>)}
        </dl>
        {spec.outline && (
          <div>
            <h3 className="mb-1 text-sm font-medium">{s.shapeView.walls}</h3>
            <p className="text-sm tabular-nums text-muted-foreground" data-testid="wall-lengths">{edgesOf(spec.outline).map((e) => `${e.i + 1}: ${nf(Math.round(e.len))}`).join(' · ')} cm</p>
          </div>
        )}
        <p className="text-[13px] text-muted-foreground">{s.shapeView.readOnlyNote}</p>
        <div><Button variant="outline" data-a="edit-shape" onClick={() => onEditing(true)}><Pencil />{s.shapeView.edit}</Button></div>
      </div>
      <div className="flex flex-col gap-2 max-lg:order-first">
        <span className="text-sm font-medium">{s.spec.plan}</span>
        <div className="minimap overflow-auto rounded-lg border bg-card p-2" dangerouslySetInnerHTML={{ __html: plan }} />
      </div>
    </div>
  );
}
