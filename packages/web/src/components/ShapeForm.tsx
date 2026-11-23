import { useMemo } from 'react';
import { ROOF_KEYS, ROOMS, fieldIssues, notch, notchesAllowed, presetSpec, type NotchKind, type RoofKey, type RoomSpec } from '@slabs/core';
import { Plus, X } from 'lucide-react';
import { T_, nf, s } from '../i18n';
import { roofOverrides, roomRoof } from '../state/project';
import { useRoomEngine } from '../state/engine';
import { setNotch } from '../state/specEdit';
import { useStore } from '../state/store';
import type { RoomRef } from '../state/project';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { becauseOf } from './ParamForm';
import { NumField } from './Fields';
import { Segmented } from './Segmented';

type Ceil = 'roof' | 'flat';

/** Start sizes of a notch that is added (inside what the model accepts for a typical room). */
function newNotch(kind: NotchKind, spec: RoomSpec, W: number, L: number): { a: number; b: number } {
  if (kind === 'corner') return { a: Math.round(W * 0.64), b: 60 };
  if (kind === 'recess') return { a: 140, b: Math.min(415, Math.max(40, Math.round(L * 0.4))) };
  return { a: 17, b: 0 };
}

/** Changing the ceiling or the position resets what does not exist any more (notches, the flat cap, the wrap) and gives the new case sensible start values. */
function withCeiling(s0: RoomSpec, c: Ceil): RoomSpec {
  if (c === 'flat') return s0.ceiling.kind === 'flat' ? s0 : { ...s0, ceiling: { kind: 'flat', h: 250 }, notches: [], pos: 'full', join: false };
  return s0.ceiling.kind === 'roof' ? s0 : { ...s0, ceiling: { kind: 'roof', cap: 0 }, notches: [], pos: 'full', join: false };
}
function withPos(s0: RoomSpec, pos: RoomSpec['pos']): RoomSpec {
  if (pos === s0.pos) return s0;
  const w = pos === 'left' ? presetSpec('sypialnia').w : pos === 'right' ? presetSpec('lazienka-1').w : s0.w;
  return { ...s0, pos, w: s0.pos === 'full' ? w : s0.w, notches: [], ceiling: pos === 'left' ? s0.ceiling : { kind: 'roof', cap: 0 } };
}

/**
 * "Kształt": the one definition every room has - floor plan (width x length + notches), position under the roof, ceiling. The preset engines'
 * limits are reported under the field that broke them, in plain words.
 */
export function ShapeForm({ id, plan }: { id: RoomRef; plan: string }) {
  const spec = useStore((st) => st.project.rooms[id]!.spec);
  const room = useStore((st) => st.project.rooms[id]!);
  const roofP = useStore((st) => st.project.roof);
  const { setSpec, setParam, resetRoomRoof, startRoofOverride, resetRoom } = useStore.getState();
  const { type, params } = useRoomEngine(id);
  const issues = useMemo(() => fieldIssues(type, params), [type, params]);
  const roof = roomRoof({ roof: roofP, rooms: { [id]: room } }, id);
  const own = roofOverrides(room);
  const flat = spec.ceiling.kind === 'flat';
  const under = !flat;
  const wKey = type === 'lazienka-2' ? 'bx' : type === 'sypialnia' ? 'Wb' : type === 'lazienka-1' ? 'bw' : 'W';
  const lKey = type === 'lazienka-2' ? 'bz' : 'L';
  const def = ROOMS[type];
  const err = (ek: string, value: number): string | undefined => {
    const i = issues.find((q) => q.key === ek);
    if (!i) return undefined;
    const fd = def.fields.find((x) => x.key === ek);
    return s.room.issue(fd ? T_(fd.label) : ek, i.kind, i.bound, fd?.unit ?? 'cm', becauseOf(i, id, { ...params, [ek]: value }));
  };
  const field = (key: string, ek: string, label: string, value: number, set: (v: number) => void, unit = 'cm') => (
    <div className="flex flex-col gap-1" key={key}>
      <Label htmlFor={`p_${id}_${key}`}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <NumField id={`p_${id}_${key}`} className="w-28 flex-none" value={value} label={label} name={label} onValue={set} error={err(ek, value)} correctTo={issues.find((q) => q.key === ek)?.bound} track={`${id}.${ek}`} />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
  const capOn = spec.ceiling.kind === 'roof' && spec.ceiling.cap > 0;
  const notchOn = (k: NotchKind) => notch(spec, k);
  const canNotch = notchesAllowed(spec);
  const missingKinds = (['corner', 'recess', 'offset'] as NotchKind[]).filter((k) => !notchOn(k));
  const roofLimitsText = (k: RoofKey) => s.spec.roofLabels[k];
  const joinPossible = flat && (spec.surf['4']?.finish?.kind ?? 'wood') !== 'other';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]" data-shape>
      <div className="flex flex-col gap-5">
        <p className="max-w-[66ch] text-sm text-muted-foreground">{s.spec.shapeIntro}</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium" id={`ceil_${id}_l`}>{s.spec.ceiling}</span>
          <Segmented label={s.spec.ceiling} testid="ceiling" value={spec.ceiling.kind as Ceil} options={[{ value: 'roof', label: s.spec.ceilRoof }, { value: 'flat', label: s.spec.ceilFlat }]} onChange={(c) => setSpec(id, (x) => withCeiling(x, c))} />
        </div>
        {under && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{s.spec.position}</span>
            <Segmented label={s.spec.position} testid="pos" value={spec.pos} options={[{ value: 'full', label: s.spec.posFull }, { value: 'left', label: s.spec.posLeft }, { value: 'right', label: s.spec.posRight }]} onChange={(p) => setSpec(id, (x) => withPos(x, p))} />
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {under && spec.pos === 'full'
            ? <div className="flex flex-col gap-1"><span className="text-sm font-medium">{s.spec.width}</span><p className="text-sm text-muted-foreground" data-testid="width-house">{nf(roof.W)} cm · {s.spec.widthHouseNote}</p></div>
            : field('w', wKey, s.spec.width, spec.w, (v) => setParam(id, wKey, v))}
          {field('l', lKey, s.spec.length, spec.l, (v) => setParam(id, lKey, v))}
          {flat && spec.ceiling.kind === 'flat' && field('h', 'H', s.spec.height, spec.ceiling.h, (v) => setParam(id, 'H', v))}
        </div>
        {under && spec.pos === 'left' && (
          <div className="flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-5" checked={capOn} data-testid="cap" onChange={(e) => setSpec(id, (x) => ({ ...x, ceiling: { kind: 'roof', cap: e.target.checked ? 300 : 0 } }))} />{s.spec.cap}</label>
            {capOn && spec.ceiling.kind === 'roof' && field('capH', 'capH', s.spec.capH, spec.ceiling.cap, (v) => setParam(id, 'capH', v))}
          </div>
        )}
        {flat && (
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-5" checked={spec.join && joinPossible} disabled={!joinPossible} data-testid="join" onChange={(e) => setSpec(id, (x) => ({ ...x, join: e.target.checked }))} />{s.spec.join}</label>
            <p className="max-w-[66ch] text-[13px] text-muted-foreground">{joinPossible ? s.spec.joinNote : s.spec.joinOff}</p>
          </div>
        )}
        {under && (
          <fieldset className="flex flex-col gap-2 rounded-lg border p-3" data-testid="roof-fields">
            <legend className="px-1 text-sm font-medium">{s.spec.roofTitle}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {ROOF_KEYS.map((k) => {
                const isOwn = own.includes(k), unit = k === 'ang' ? '°' : 'cm';
                return (
                  <div className="flex min-w-40 flex-col gap-1" key={k}>
                    <Label htmlFor={`p_${id}_${k}`}>{roofLimitsText(k)}</Label>
                    {isOwn ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <NumField id={`p_${id}_${k}`} className="w-24 flex-none" value={roof[k]} label={roofLimitsText(k)} name={roofLimitsText(k)} onValue={(v) => setParam(id, k, v)} error={err(k, roof[k])} correctTo={issues.find((q) => q.key === k)?.bound} track={`${id}.${k}`} />
                          <span className="text-sm text-muted-foreground">{unit}</span>
                          <Badge variant="secondary" className="text-xs font-normal" data-own={k}>{s.spec.roofOwn}</Badge>
                        </div>
                        <Button variant="link" size="sm" className="h-auto min-h-11 justify-start px-0 underline" data-reset-roof={k} onClick={() => resetRoomRoof(id, k)}>{s.spec.roofReset(`${nf(roofP[k])} ${unit}`)}</Button>
                      </>
                    ) : (
                      <>
                        <p className="min-h-9 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-grey={k}>{nf(roofP[k])} {unit} <span className="text-xs">({s.spec.roofFromProject})</span></p>
                        <Button variant="link" size="sm" className="h-auto min-h-11 justify-start px-0 underline" data-change-roof={k} onClick={() => startRoofOverride(id, k)}>{s.spec.roofChange}</Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-3 rounded-lg border p-3" data-testid="notches">
          <legend className="px-1 text-sm font-medium">{s.spec.notches}</legend>
          {!canNotch && <p className="text-sm text-muted-foreground">{s.spec.notchesOnlyFull}</p>}
          {canNotch && spec.notches.length === 0 && <p className="text-sm text-muted-foreground">{s.spec.notchesNone}</p>}
          {canNotch && spec.notches.map((n) => {
            const name = s.spec.notchKinds[n.kind];
            const [la, lb] = s.spec.notchFields[n.kind];
            const [ea, eb] = n.kind === 'corner' ? ['wB', 'dB'] : n.kind === 'recess' ? ['dA', 'ZA'] : ['niche', ''];
            return (
              <div key={n.kind} className="flex flex-wrap items-end gap-x-5 gap-y-2 rounded-md bg-muted/40 p-2" data-notch={n.kind}>
                <div className="flex min-w-40 flex-col"><span className="text-sm font-semibold">{name}</span><span className="text-xs text-muted-foreground">{s.spec.notchWhere[n.kind]}</span></div>
                {field(`n_${n.kind}_a`, ea, `${name}: ${la.toLowerCase()}`, n.a, (v) => setParam(id, ea, v))}
                {lb && field(`n_${n.kind}_b`, eb, `${name}: ${lb.toLowerCase()}`, n.b, (v) => setParam(id, eb, v))}
                <Button variant="ghost" size="icon" className="size-11" aria-label={s.spec.removeNotch(name)} onClick={() => setSpec(id, (x) => setNotch(x, n.kind, null))}><X /></Button>
              </div>
            );
          })}
          {canNotch && missingKinds.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={s.spec.addNotch}>
              {missingKinds.map((k) => <Button key={k} variant="outline" data-add-notch={k} onClick={() => setSpec(id, (x) => setNotch(x, k, newNotch(k, x, roof.W, x.l)))}><Plus />{s.spec.notchKinds[k]}</Button>)}
            </div>
          )}
        </fieldset>
        <div><Button variant="outline" data-a="reset-room" onClick={() => resetRoom(id)}>{s.history.resetBtn}</Button></div>
      </div>
      <div className="flex flex-col gap-2 max-lg:order-first">
        <span className="text-sm font-medium">{s.spec.plan}</span>
        <div className="minimap overflow-auto rounded-lg border bg-card p-2" dangerouslySetInnerHTML={{ __html: plan }} />
      </div>
    </div>
  );
}
