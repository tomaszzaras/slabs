import { s } from '../i18n';
import { ARTIFACT_SETTINGS } from '../state/project';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/collapsible';
import { plateCover, type ProfileMode } from '@slabs/core';
import { nf } from '../i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckField, NumField } from './Fields';
import { HouseRoof } from './HouseRoof';

const Row = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="frow grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  </div>
);
const Unit = ({ t }: { t: string }) => <span className="min-w-6 text-sm text-muted-foreground">{t}</span>;

export function SettingsPanel() {
  const st = useStore((x) => x.project.settings);
  const { setSettings, setPlate, setAllowances, replaceSettings } = useStore.getState();
  const a = st.allowances;
  const pl = st.plate, cv = plateCover(pl);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="project-settings-h" id="project-settings">
      <h2 id="project-settings-h" className="text-base font-semibold">{s.settings.projectTitle}</h2>
      <p className="max-w-[66ch] text-sm text-muted-foreground">{s.settings.projectNote}</p>
      <HouseRoof />
      <Section title={s.settings.plateTitle} defaultOpen>
        <div className="flex flex-col gap-3" data-testid="plate-settings">
          <Row id="pl_len" label={s.settings.plateLen}><NumField id="pl_len" className="flex-1 basis-16" value={pl.L} onValue={(v) => setPlate({ L: Math.min(1000, Math.max(100, v)) })} /><Unit t={s.settings.cm} /></Row>
          <Row id="pl_wid" label={s.settings.plateWid}><NumField id="pl_wid" className="flex-1 basis-16" value={pl.W} onValue={(v) => setPlate({ W: Math.min(300, Math.max(20, v)) })} /><Unit t={s.settings.cm} /></Row>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="pl_prof">{s.settings.profile}</Label>
            <Select value={pl.profile} onValueChange={(v) => setPlate({ profile: v as ProfileMode })}>
              <SelectTrigger id="pl_prof" className="h-11 w-full min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{s.settings.profileAll}</SelectItem>
                <SelectItem value="long">{s.settings.profileLong}</SelectItem>
                <SelectItem value="none">{s.settings.profileNone}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pl.profile !== 'none' && <Row id="pl_tg" label={s.settings.tongue}><NumField id="pl_tg" className="flex-1 basis-16" value={pl.tongue} onValue={(v) => setPlate({ tongue: Math.min(5, Math.max(0, v)) })} /><Unit t={s.settings.cm} /></Row>}
          <p className="text-sm" role="status">{s.settings.covers(nf(cv.L, Number.isInteger(cv.L) ? 0 : 1), nf(cv.W, Number.isInteger(cv.W) ? 0 : 1))}</p>
          {pl.profile !== 'none' && <p className="max-w-[66ch] text-xs text-muted-foreground">{s.settings.plateNote}</p>}
          <Row id="price" label={s.settings.price}><NumField id="price" className="flex-1 basis-16" value={st.platePrice} onValue={(v) => setSettings({ platePrice: Math.max(0, v) })} /><Unit t={s.settings.priceUnit} /></Row>
        </div>
      </Section>
      <Section title={s.settings.details}>
        <div className="flex flex-col gap-3">
          <Row id="kerf" label={s.settings.kerf}><NumField id="kerf" className="flex-1 basis-16" value={st.kerfMm} onValue={(v) => setSettings({ kerfMm: Math.max(0, v) })} /><Unit t={s.settings.mm} /></Row>
          <Row id="trim" label={s.settings.trim}><NumField id="trim" className="flex-1 basis-16" value={st.trimMm} onValue={(v) => setSettings({ trimMm: Math.max(0, v) })} /><Unit t={s.settings.mm} /></Row>
          <Row id="minoff" label={s.settings.minOffcut}><NumField id="minoff" className="flex-1 basis-16" value={st.minOffcutCm} onValue={(v) => setSettings({ minOffcutCm: Math.max(0, v) })} /><Unit t={s.settings.cm} /></Row>
          <Row id="minstrip" label={s.settings.minStrip}><NumField id="minstrip" className="flex-1 basis-16" value={st.minStripCm} onValue={(v) => setSettings({ minStripCm: Math.max(0, v) })} /><Unit t={s.settings.cm} /></Row>
          <Row id="split" label={s.settings.split}><CheckField id="split" checked={st.splitAtBends} onChange={(v) => setSettings({ splitAtBends: v })} /></Row>
          <Row id="guil" label={s.settings.guillotine}><CheckField id="guil" checked={st.guillotine} onChange={(v) => setSettings({ guillotine: v })} /></Row>
          <h3 className="pt-2 text-sm font-semibold">{s.settings.allowances}</h3>
          <Row id="al_on" label={s.settings.allowancesOn}><CheckField id="al_on" checked={a.enabled} onChange={(v) => setAllowances({ enabled: v })} /></Row>
          <Row id="al_wall" label={s.settings.wall}><NumField id="al_wall" className="flex-1 basis-16" value={a.wall} onValue={(v) => setAllowances({ wall: v })} /><Unit t={s.settings.mm} /></Row>
          <Row id="al_bend" label={s.settings.bend}><NumField id="al_bend" className="flex-1 basis-16" value={a.bend} onValue={(v) => setAllowances({ bend: v })} /><Unit t={s.settings.mm} /></Row>
          <Row id="al_open" label={s.settings.opening}><NumField id="al_open" className="flex-1 basis-16" value={a.opening} onValue={(v) => setAllowances({ opening: v })} /><Unit t={s.settings.mm} /></Row>
          <Row id="al_gap" label={s.settings.gap}><NumField id="al_gap" className="flex-1 basis-16" value={a.gap} onValue={(v) => setAllowances({ gap: v })} /><Unit t={s.settings.mm} /></Row>
          <Row id="al_tol" label={s.settings.angleTol}><CheckField id="al_tol" checked={a.angleTolerance} onChange={(v) => setAllowances({ angleTolerance: v })} /></Row>
          <p className="text-xs text-muted-foreground">{s.settings.joint} {s.settings.note}</p>
          <Button variant="outline" className="self-start" onClick={() => replaceSettings(ARTIFACT_SETTINGS)}>{s.settings.asArtifact}</Button>
        </div>
      </Section>
    </section>
  );
}
