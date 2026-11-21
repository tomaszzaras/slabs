import { ROOF_KEYS, underRoof } from '@slabs/core';
import { nf, s } from '../i18n';
import { useStore } from '../state/store';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/collapsible';
import { NumField } from './Fields';
import { RoofDrawing } from './RoomDrawings';

const Row = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="frow grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  </div>
);

/** "Dach domu": the roof shared by the rooms under the slope (project default), with a small section drawing. Rooms may override single values. */
export function HouseRoof() {
  const roof = useStore((st) => st.project.roof);
  const rooms = useStore((st) => st.project.rooms);
  const setRoof = useStore((st) => st.setRoof);
  const under = Object.values(rooms).filter((r) => underRoof(r.type));
  const own = under.filter((r) => ROOF_KEYS.some((k) => r.over?.includes(k))).length;
  return (
    <Section title={s.rooms.roof.title} defaultOpen>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" data-testid="house-roof">
        <div className="flex flex-col gap-3">
          <p className="max-w-[66ch] text-sm text-muted-foreground">{s.rooms.roof.note}</p>
          <Row id="roof_W" label={s.rooms.roof.width}><NumField id="roof_W" className="flex-1 basis-16" value={roof.W} onValue={(v) => setRoof({ W: v })} /><span className="min-w-6 text-sm text-muted-foreground">cm</span></Row>
          <p className="text-sm"><span className="font-medium">{s.rooms.roof.ridge}:</span> <span id="roof_ridge" className="text-muted-foreground">{s.rooms.roof.ridgeValue(nf(roof.W / 2, Number.isInteger(roof.W / 2) ? 0 : 1))}</span></p>
          <Row id="roof_ang" label={s.rooms.roof.angle}><NumField id="roof_ang" className="flex-1 basis-16" value={roof.ang} onValue={(v) => setRoof({ ang: v })} /><span className="min-w-6 text-sm text-muted-foreground">°</span></Row>
          <Row id="roof_HL" label={s.rooms.roof.knee}><NumField id="roof_HL" className="flex-1 basis-16" value={roof.HL} onValue={(v) => setRoof({ HL: v })} /><span className="min-w-6 text-sm text-muted-foreground">cm</span></Row>
          <p className="text-xs text-muted-foreground" role="status" data-testid="roof-overrides">{under.length ? s.rooms.roof.overridden(own) : s.rooms.roof.none}</p>
        </div>
        <RoofDrawing roof={roof} />
      </div>
    </Section>
  );
}
