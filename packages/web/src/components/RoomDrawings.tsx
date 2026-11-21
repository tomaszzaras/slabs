import type { AddTemplateId, RoofSpec } from '@slabs/core';
import { nf, s } from '../i18n';

const wood = { fill: 'var(--r0)', stroke: 'currentColor', strokeWidth: 1.2 } as const;
const ghost = { fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.55 } as const;
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round' } as const;

/** Small section drawings of the room templates (picker): the part of the house the room covers is drawn in wood colour. Decorative; the card has the words. */
export function TemplateDrawing({ id }: { id: AddTemplateId }) {
  return (
    <svg viewBox="0 0 120 72" className="h-[72px] w-[120px] shrink-0 text-foreground" aria-hidden="true" focusable="false">
      {id === 'under-roof' && (<>
        <polygon points="14,62 14,46 60,12 106,46 106,62" {...wood} />
        <line x1="60" y1="12" x2="60" y2="62" {...ghost} />
      </>)}
      {id === 'sloped' && (<>
        <polygon points="14,62 14,46 60,12 106,46 106,62" {...ghost} />
        <polygon points="14,62 14,46 49,20 49,62" {...wood} />
      </>)}
      {id === 'flat' && (<>
        <rect x="22" y="12" width="76" height="50" {...line} />
        <polygon points="22,12 98,12 98,22 22,22" {...wood} />
        <polygon points="22,22 22,36 30,36 30,22" {...wood} />
        <polygon points="98,22 98,36 90,36 90,22" {...wood} />
        <line x1="22" y1="36" x2="98" y2="36" {...ghost} />
      </>)}
      {id === 'band' && (<>
        <rect x="8" y="22" width="104" height="22" {...wood} strokeDasharray="5 3" />
        <line x1="8" y1="56" x2="112" y2="56" {...line} />
        <path d="M8 52v8M112 52v8" {...line} />
      </>)}
    </svg>
  );
}

/** Section of the house roof ("Dach domu"): walls, knee walls, the two slopes and the ridge in the middle, with the measures written on. */
export function RoofDrawing({ roof }: { roof: RoofSpec }) {
  const W = Math.max(1, roof.W), HL = Math.max(0, roof.HL), ang = Math.min(80, Math.max(1, roof.ang));
  const rid = HL + (W / 2) * Math.tan((ang * Math.PI) / 180);
  const k = Math.min(200 / W, 92 / rid);
  const x0 = 50, ground = 118, wpx = W * k, hl = HL * k, rp = rid * k;
  const xm = x0 + wpx / 2;
  const yk = ground - hl, yr = ground - rp;
  const ridgeX = nf(W / 2);
  const arc = 26, rad = (ang * Math.PI) / 180;
  return (
    <svg viewBox="0 0 300 150" role="img" aria-label={s.rooms.roof.drawing(nf(roof.W), nf(roof.ang), nf(roof.HL))} className="w-full max-w-[22rem] text-foreground">
      <polygon points={`${x0},${ground} ${x0},${yk} ${xm},${yr} ${x0 + wpx},${yk} ${x0 + wpx},${ground}`} {...wood} />
      <line x1={xm} y1={yr} x2={xm} y2={ground} {...ghost} />
      <line x1={x0 - 14} y1={ground} x2={x0 + wpx + 14} y2={ground} {...line} />
      {/* width */}
      <path d={`M${x0} ${ground + 12}H${x0 + wpx}M${x0} ${ground + 8}v8M${x0 + wpx} ${ground + 8}v8`} {...line} strokeWidth={1} />
      <text x={xm} y={ground + 29} textAnchor="middle" fontSize="12" fill="currentColor">{nf(roof.W)} cm</text>
      {/* knee wall */}
      {HL > 0 && <>
        <path d={`M${x0 - 10} ${ground}V${yk}M${x0 - 14} ${ground}h8M${x0 - 14} ${yk}h8`} {...line} strokeWidth={1} />
        <text x={x0 - 15} y={(ground + yk) / 2 + 4} textAnchor="end" fontSize="12" fill="currentColor">{nf(roof.HL)}</text>
      </>}
      {/* angle */}
      <path d={`M${x0 + arc} ${yk}A${arc} ${arc} 0 0 0 ${x0 + arc * Math.cos(rad)} ${yk - arc * Math.sin(rad)}`} {...line} strokeWidth={1} />
      <text x={x0 + arc + 6} y={yk - 6} fontSize="12" fill="currentColor">{nf(roof.ang)}°</text>
      {/* ridge */}
      <text x={xm + 6} y={yr + 4} fontSize="12" fill="currentColor">{s.rooms.roof.ridge.toLowerCase()} {ridgeX}</text>
    </svg>
  );
}
