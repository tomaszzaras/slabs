import { s } from '../i18n';
import { ARTIFACT_SETTINGS } from '../state/project';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/collapsible';
import { CheckField, NumField } from './Fields';

const Row = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="frow grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  </div>
);
const Unit = ({ t }: { t: string }) => <span className="min-w-6 text-sm text-muted-foreground">{t}</span>;

export function SettingsPanel() {
  const st = useStore((x) => x.project.settings);
  const { setSettings, setAllowances, replaceSettings } = useStore.getState();
  const a = st.allowances;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{s.settings.title}</h2>
      <Section title={s.settings.details}>
        <div className="flex flex-col gap-3">
          <Row id="kerf" label={s.settings.kerf}><NumField id="kerf" className="flex-1 basis-16" value={st.kerfMm} onValue={(v) => setSettings({ kerfMm: Math.max(0, v) })} /><Unit t={s.settings.mm} /></Row>
          <Row id="trim" label={s.settings.trim}><NumField id="trim" className="flex-1 basis-16" value={st.trimMm} onValue={(v) => setSettings({ trimMm: Math.max(0, v) })} /><Unit t={s.settings.mm} /></Row>
          <Row id="minoff" label={s.settings.minOffcut}><NumField id="minoff" className="flex-1 basis-16" value={st.minOffcutCm} onValue={(v) => setSettings({ minOffcutCm: Math.max(0, v) })} /><Unit t={s.settings.cm} /></Row>
          <Row id="minstrip" label={s.settings.minStrip}><NumField id="minstrip" className="flex-1 basis-16" value={st.minStripCm} onValue={(v) => setSettings({ minStripCm: Math.max(0, v) })} /><Unit t={s.settings.cm} /></Row>
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
