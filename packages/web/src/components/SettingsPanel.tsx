import { s } from '../i18n';
import { ARTIFACT_SETTINGS } from '../state/project';
import { useStore } from '../state/store';
import { CheckField, NumField } from './Fields';

export function SettingsPanel() {
  const st = useStore((x) => x.project.settings);
  const { setSettings, setAllowances, replaceSettings } = useStore.getState();
  const a = st.allowances;
  return (
    <details className="card settings">
      <summary>{s.settings.title}</summary>
      <div className="fields wide">
        <div className="frow"><label htmlFor="kerf">{s.settings.kerf}</label><div className="in"><NumField id="kerf" value={st.kerfMm} onValue={(v) => setSettings({ kerfMm: Math.max(0, v) })} /><span className="unit">{s.settings.mm}</span></div></div>
        <div className="frow"><label htmlFor="trim">{s.settings.trim}</label><div className="in"><NumField id="trim" value={st.trimMm} onValue={(v) => setSettings({ trimMm: Math.max(0, v) })} /><span className="unit">{s.settings.mm}</span></div></div>
        <div className="frow"><label htmlFor="minoff">{s.settings.minOffcut}</label><div className="in"><NumField id="minoff" value={st.minOffcutCm} onValue={(v) => setSettings({ minOffcutCm: Math.max(0, v) })} /><span className="unit">{s.settings.cm}</span></div></div>
        <div className="frow"><label htmlFor="minstrip">{s.settings.minStrip}</label><div className="in"><NumField id="minstrip" value={st.minStripCm} onValue={(v) => setSettings({ minStripCm: Math.max(0, v) })} /><span className="unit">{s.settings.cm}</span></div></div>
        <div className="frow"><label htmlFor="guil">{s.settings.guillotine}</label><div className="in"><CheckField id="guil" checked={st.guillotine} onChange={(v) => setSettings({ guillotine: v })} /></div></div>
      </div>
      <h3>{s.settings.allowances}</h3>
      <div className="fields wide">
        <div className="frow"><label htmlFor="al_on">{s.settings.allowancesOn}</label><div className="in"><CheckField id="al_on" checked={a.enabled} onChange={(v) => setAllowances({ enabled: v })} /></div></div>
        <div className="frow"><label htmlFor="al_wall">{s.settings.wall}</label><div className="in"><NumField id="al_wall" value={a.wall} onValue={(v) => setAllowances({ wall: v })} /><span className="unit">{s.settings.mm}</span></div></div>
        <div className="frow"><label htmlFor="al_bend">{s.settings.bend}</label><div className="in"><NumField id="al_bend" value={a.bend} onValue={(v) => setAllowances({ bend: v })} /><span className="unit">{s.settings.mm}</span></div></div>
        <div className="frow"><label htmlFor="al_open">{s.settings.opening}</label><div className="in"><NumField id="al_open" value={a.opening} onValue={(v) => setAllowances({ opening: v })} /><span className="unit">{s.settings.mm}</span></div></div>
        <div className="frow"><label htmlFor="al_gap">{s.settings.gap}</label><div className="in"><NumField id="al_gap" value={a.gap} onValue={(v) => setAllowances({ gap: v })} /><span className="unit">{s.settings.mm}</span></div></div>
        <div className="frow"><label htmlFor="al_tol">{s.settings.angleTol}</label><div className="in"><CheckField id="al_tol" checked={a.angleTolerance} onChange={(v) => setAllowances({ angleTolerance: v })} /></div></div>
      </div>
      <p className="note">{s.settings.joint} {s.settings.note}</p>
      <div className="opts"><button type="button" onClick={() => replaceSettings(ARTIFACT_SETTINGS)}>{s.settings.asArtifact}</button></div>
    </details>
  );
}
