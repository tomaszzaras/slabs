// Runs the artifact's own code and writes golden JSON files for the parity tests (docs/PLAN.md, M1).
//   node scripts/make-goldens.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadArtifact } from './artifact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'fixtures', 'golden');
fs.mkdirSync(OUT, { recursive: true });

const art = loadArtifact();
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
const json = (v) => JSON.parse(JSON.stringify(v)); // drops functions, keeps data

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mk = (seed) => {
  const r = mulberry32(seed);
  const ri = (a, b) => Math.round(a + r() * (b - a));
  const rh = (a, b) => Math.round((a + r() * (b - a)) * 2) / 2;
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { r, ri, rh, pick };
};

function shifts(g, n) {
  const o = {};
  for (let i = 1; i <= 9; i++) o['o' + i] = i <= n ? (g.r() < 0.35 ? 0 : g.pick([g.ri(-60, 60), g.rh(-60, 60)])) : 0;
  return o;
}
function plateRand(g) {
  return { PL: g.r() < 0.6 ? 499 : g.ri(300, 600), PW: g.r() < 0.6 ? 125 : g.ri(80, 200) };
}

// Random inputs that are valid (inside the artifact's own limits) for each room.
const GEN = {
  salon(g) {
    const W = g.ri(400, 700), L = g.ri(500, 1300), hw = W / 2, niche = g.ri(0, 40), XR = hw - niche;
    const ZA = g.ri(150, L - 80), dA = g.ri(60, Math.min(220, XR - 20));
    const wB = g.ri(Math.ceil(hw) + 10, W - niche - 10), dB = g.ri(20, Math.min(150, L - ZA - 20));
    return {
      W, L, ang: g.ri(25, 55), HL: g.ri(60, 150), niche, dA, ZA, wB, dB, cutOn: g.r() < 0.5 ? 1 : 0, cutH: g.ri(20, 150),
      winOn: g.r() < 0.6 ? 1 : 0, winD: g.ri(20, 80), ...plateRand(g), ZO: g.ri(0, L), XO: g.ri(-150, 150), ...shifts(g, 9),
    };
  },
  sypialnia(g) {
    const W = g.ri(400, 700), hw = W / 2, ang = g.ri(25, 55), HL = g.ri(60, 150), RID = HL + hw * Math.tan((ang * Math.PI) / 180);
    const capOn = g.r() < 0.6 ? 1 : 0;
    return {
      W, Wb: g.ri(Math.ceil(hw) + 30, W - 1), L: g.ri(200, 600), ang, HL, capOn, capH: g.ri(HL + 10, Math.max(HL + 11, Math.floor(RID - 5))),
      ...plateRand(g), ZO: g.ri(0, 200), XO: g.ri(-150, 150), ...shifts(g, 9),
    };
  },
  'lazienka-1'(g) {
    const W = g.ri(400, 700), hw = W / 2;
    return { W, bw: g.ri(60, Math.floor(hw) - 12), L: g.ri(200, 500), ang: g.ri(25, 55), HL: g.ri(60, 150), ...plateRand(g), ZO: g.ri(0, 200), XO: g.ri(-100, 100), ...shifts(g, 9) };
  },
  'lazienka-2'(g) {
    const H = g.ri(200, 300);
    return { bx: g.ri(80, 400), bz: g.ri(120, 500), H, hb: g.ri(30, Math.min(100, H - 20)), dz: g.r() < 0.5 ? 1 : 0, ...plateRand(g), ZO: g.ri(0, 100), ...shifts(g, 3) };
  },
};
// A few deliberately out-of-range inputs, to check clamping and warnings.
const CLAMP = {
  salon: [{ W: 100, L: 5000, ang: 5, HL: 400 }, { dA: 900, ZA: 9999, wB: 5, dB: 1, winD: 999, niche: 500 }, { PL: 50, PW: 1000, ZO: -5, XO: 5000, o1: 5000, o9: -5000 }],
  sypialnia: [{ W: 100, Wb: 50, L: 5000, ang: 80 }, { capH: 20, HL: 100 }, { capH: 5000, PW: 5 }],
  'lazienka-1': [{ bw: 10 }, { bw: 5000, W: 300 }, { L: 10, ang: 3 }],
  'lazienka-2': [{ bx: 10, bz: 5000 }, { hb: 500, H: 120 }, { H: 50, PL: 5, o1: 3000 }],
};

function roomCase(slug, name, input) {
  const a = art[slug];
  const n = a.norm(input), m = a.model(input), pieces = a.cutPieces(m), plates = a.packCuts(pieces, m.p.PL, m.p.PW);
  const svgs = { plan: a.svgPlan(m), boards: a.svgBoards(m), gables: a.svgGables(m), sheets: a.sheetSvgs(m, plates) };
  const svgOut = {};
  for (const k of ['plan', 'boards', 'gables']) svgOut[k] = { w: svgs[k].w, h: svgs[k].h, sha: sha(svgs[k].svg) };
  svgOut.sheets = svgs.sheets.map(sha);
  return {
    name, input, norm: json(n), model: json(m), pieces: json(pieces),
    shelf: plates.map((pl) => ({ area: pl.area, use: pl.use, items: pl.items.map((it) => ({ x: it.x, y: it.y, ids: it.p.ids, kind: it.p.kind })) })),
    svg: svgOut,
    // full text only for the default case (snapshot tests); hashes for the rest
    svgText: name === 'default' ? { plan: svgs.plan.svg, boards: svgs.boards.svg, gables: svgs.gables.svg, sheets: svgs.sheets } : undefined,
  };
}

const rooms = {};
let seed = 1000;
for (const slug of ['salon', 'sypialnia', 'lazienka-1', 'lazienka-2']) {
  const g = mk(seed++);
  const cases = [roomCase(slug, 'default', json(art[slug].DEF))];
  for (let i = 0; i < 20; i++) {
    const input = GEN[slug](g);
    const n = art[slug].norm(input);
    cases.push(roomCase(slug, `rand${i + 1}` + (n.w.length ? '-warn' : ''), input));
  }
  CLAMP[slug].forEach((c, i) => cases.push(roomCase(slug, 'clamp' + (i + 1), c)));
  rooms[slug] = { defaults: json(art[slug].DEF), cases };
  fs.writeFileSync(path.join(OUT, slug + '.json'), JSON.stringify(rooms[slug]));
  console.log(slug, cases.length, 'cases', 'with warnings:', cases.filter((c) => c.norm.w.length).length);
}

// ---------------- shared cut ----------------
const sh = art.rozkroj;
const KEYS = { S: 'salon', Sy: 'sypialnia', 'Ł1': 'lazienka-1', 'Ł2': 'lazienka-2' };
const defaultPieces = {};
for (const k of Object.keys(KEYS)) defaultPieces[k] = { PL: sh.DEFAULTS[k].PL, PW: sh.DEFAULTS[k].PW, pieces: json(sh.DEFAULTS[k].pieces) };

function sharedCase(name, cfg) {
  // cfg: { rooms: {key:{on,PL,PW,pieces}}, band, price, split }
  for (const k of Object.keys(KEYS)) {
    const r = cfg.rooms[k];
    sh.S.rooms[k] = { on: r.on ? 1 : 0, src: 'golden', PL: r.PL, PW: r.PW, pieces: json(r.pieces).map((p) => sh.normPiece(p)) };
  }
  sh.S.band = { ...cfg.band };
  sh.S.price = cfg.price;
  sh.S.split = cfg.split;
  const t0 = Date.now();
  const R = sh.compute();
  const ms = Date.now() - t0;
  if (R.tried < 2000) throw new Error(`${name}: artifact search stopped by time limit after ${R.tried} tries (${ms} ms); regenerate on a faster machine or reduce the case`);
  const out = json({
    PL: R.PL, PW: R.PW, warn: R.warn, roomPlates: R.roomPlates, extraPlates: R.extraPlates, segs: R.segs, fromOff: R.fromOff,
    bandLen: R.bandLen, bandH: R.bandH, bandAlone: R.bandAlone, tried: R.tried, netto: R.netto,
    per: R.per.map((p) => ({ key: p.r.k, n: p.n, area: p.area, alone: p.alone })),
    plates: R.plates.map((pl, i) => ({ extra: !!pl.extra, area: pl.area, use: pl.use, items: pl.items, svgSha: sha(sh.plateSvg(pl, i, R).g) })),
  });
  return { name, config: json(cfg), result: out, ms };
}
const baseBand = { len: 1648, h: 65, min: 124, max: 124, use: 1 };
const cloneRooms = (extra = {}) => Object.fromEntries(Object.keys(KEYS).map((k) => [k, { on: 1, ...defaultPieces[k], ...(extra[k] || {}) }]));
const sharedCases = [];
sharedCases.push(sharedCase('defaults', { rooms: cloneRooms(), band: baseBand, price: 147.6, split: 1 }));
sharedCases.push(sharedCase('no-split', { rooms: cloneRooms(), band: baseBand, price: 147.6, split: 0 }));
sharedCases.push(sharedCase('band-no-offcuts', { rooms: cloneRooms(), band: { ...baseBand, use: 0 }, price: 100, split: 1 }));
sharedCases.push(sharedCase('no-band', { rooms: cloneRooms(), band: { ...baseBand, len: 0 }, price: 147.6, split: 1 }));
sharedCases.push(sharedCase('band-40-min30-max100', { rooms: cloneRooms(), band: { len: 900, h: 40, min: 30, max: 100, use: 1 }, price: 147.6, split: 1 }));
sharedCases.push(sharedCase('salon+syp-only', { rooms: cloneRooms({ 'Ł1': { on: 0 }, 'Ł2': { on: 0 } }), band: baseBand, price: 147.6, split: 1 }));
sharedCases.push(sharedCase('bathrooms-only', { rooms: cloneRooms({ S: { on: 0 }, Sy: { on: 0 } }), band: { ...baseBand, len: 500 }, price: 147.6, split: 0 }));
{
  const g = mk(777);
  for (let i = 0; i < 9; i++) {
    const rs = {};
    for (const k of Object.keys(KEYS)) {
      const cs = rooms[KEYS[k]].cases.filter((c) => !c.name.startsWith('clamp'));
      const c = g.pick(cs);
      rs[k] = { on: g.r() < 0.85 ? 1 : 0, PL: c.model.p.PL, PW: c.model.p.PW, pieces: c.pieces };
    }
    // keep one plate size so that results stay comparable between rooms
    if (g.r() < 0.7) for (const k of Object.keys(rs)) { rs[k].PL = 499; rs[k].PW = 125; }
    const band = g.r() < 0.2 ? { ...baseBand, len: 0 } : { len: g.ri(300, 2500), h: g.pick([40, 50, 65, 80]), min: g.pick([20, 60, 124]), max: g.pick([100, 124]), use: g.r() < 0.7 ? 1 : 0 };
    sharedCases.push(sharedCase('random' + (i + 1), { rooms: rs, band, price: g.pick([100, 147.6, 210]), split: g.r() < 0.6 ? 1 : 0 }));
  }
}
fs.writeFileSync(path.join(OUT, "shared.json"), JSON.stringify({ defaultPieces, cases: sharedCases.map(({ ms: _ms, ...c }) => c) }));
console.log('shared', sharedCases.length, 'cases; max artifact time', Math.max(...sharedCases.map((c) => c.ms)), 'ms');
for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB');
