# Slabs — plan for an online version of "Okładzina domu"

Source: the claude.ai artifact **Okładzina domu** (https://claude.ai/artifact/2vqt5iV8KutjGA9MK6rS3m),
a single 205 KB HTML page with five tabs: Salon, Sypialnia, Łazienka 1, Łazienka 2, Wspólny rozkrój.
Goal: a standalone web app that produces the same results (geometry, drawings, 3D, cut plans, PDF)
without depending on the claude.ai artifact runtime, and that is easier to extend to new rooms.

---

## 1. What the artifact does today (scope to reproduce)

### 1.1 Room tabs (parametric, all dimensions in cm)

Each room tab has: a dimension panel → summary stats → reference-point table (R1…R9) → 3D model →
per-room cut proposal → plan view → unfolded boards → gable walls. Everything recomputes on input.

| Room | Geometry | Key defaults |
|---|---|---|
| **Salon** | Gable roof, ridge in house axis. Boards run ridge → roof slope → knee wall → floor (one continuous board, bent at the roof/wall line). Gable walls covered with vertical strips. Cut-outs: recess ("wpust"), built-in ("zabudowa"), cut at the far wall, window in wall z=0, curtain niche. | W 548, L 980, roof 40°, knee wall HL 107, niche 17, wpust 140×415, zabudowa 349×60, cut height 56, window margin 50 |
| **Sypialnia** | Same roof, room starts at left wall, right wall vertical and lower than ridge; optional flat ceiling cap. | W 548, Wb 396, L 330, cap at 300 |
| **Łazienka 1** | Remaining part of the right slope next to the bedroom; boards go from the partition wall down the slope and the 107 cm knee wall; partition covered separately. | bw 200, L 274 |
| **Łazienka 2** | Rectangular room, flat ceiling. Boards go across the ceiling and wrap onto two opposite walls; the two other walls get a 66 cm band with vertical boards. Option to run boards along x or z. | 149 × 278, band 66, H 250 |

Common inputs: plate length **PL = 499**, plate width **PW = 125**, default start lines (ZO on roof,
XO on gables) and per-surface shifts **o1…o9** with ◀ ▶ step buttons (1/5/10/25 cm) and "Zeruj".
Inputs are clamped to sane ranges; corrections are listed under the summary. Values persist in the browser.

### 1.2 Domain rules (must be preserved exactly)

- The grid of plate joints on each surface is anchored at a **reference point R**; plates go both ways
  from it every PW cm. On the roof R is the board top at the ridge; on gables the bottom of a strip.
- Roof boards are one piece roof+wall with a **bend line** (red dashed) at `hw/cos(angle)`; pieces longer
  than PL are split into PL lengths.
- Grain runs **along the plate**. Pieces are **never mirrored** (visible face on one side only);
  only 180° rotation is allowed.
- Gable strips become trapezoids (or a pentagon if a strip straddles the ridge). Two neighbouring equal-width
  trapezoids are **paired** head-to-tail after 180° rotation when the sum fits in PL.
- Band ("opaska"): height e.g. 65 cm along the plate, segment length ≤ plate width (124) across the plate,
  so grain is vertical on the wall; min/max segment length; total length (default 1648 cm).
- Price per m² (default 147.6 zł) gives plate cost.

### 1.3 Shared cutting ("Wspólny rozkrój")

- Pulls pieces live from all four room tabs (`window.OKL[room]()`), each with on/off toggle;
  also accepts pasted JSON (`{room, PL, PW, pieces:[…]}`) for offline exchange.
- Piece kinds: `rect` (with optional bend `cut`/`cuts`), `pair`, `trap` (with a height profile `prof`),
  and computed `nest` (several trapezoids slid into each other).
- Option: split pieces at bends (roof/wall, ceiling/wall) to get smaller, easier-to-nest parts.
- Nesting: **MaxRects** free-rectangle packer with 3 heuristics × 4 sort keys × best/first fit, then random
  perturbations with a seeded PRNG (mulberry32, seed 20260); up to 2000 tries / 1.5 s; picks fewest plates,
  then highest Σ(utilisation²).
- Band segments are first placed into offcuts ("tnij ze ścinek"), the rest go onto extra plates.
- Output: total plates, gross m², utilisation %, cost, plates for rooms vs. extra for band, plates if each room
  were cut separately, cm of band from offcuts; colour-coded plate drawings (S, Sy, Ł1, Ł2, band).
- PDF (A4 landscape): summary page + 6 plates per page; per-room PDFs with all drawings.

### 1.4 Weaknesses to fix while porting

- The attic-room code is copied 3× (salon / sypialnia / łazienka 1) with small edits; Ł2 is a 4th variant.
- Rooms talk to the shared cut through a global (`window.OKL`), and the HTML depends on the claude.ai
  `downloads` capability for PDF.
- Per-room packer is a simple shelf packer, different from the shared MaxRects one → numbers differ between tabs.
- Data lives only in one browser's localStorage; no projects, no sharing, no history.

---

## 2. Target product

A web app (desktop + phone) where a user creates a **project** (a house), adds **rooms** from room
templates, enters measured dimensions, and gets drawings, a 3D view, a shared cut plan and a PDF/shop list.
Polish UI first (i18n-ready), metric units.

Non-goals for v1: true optimal nesting, free-form polygon rooms, CAD import, multi-user live editing.

---

## 3. Architecture

```
slabs/
  packages/
    core/        pure TypeScript, no DOM: geometry, pieces, nesting, band, costs
    render/      SVG builders (plan, unfolded boards, gables, plates) + PDF assembly
    web/         Vite + React app (UI, 3D, storage, routing)
  fixtures/      artifact snapshots + expected outputs for parity tests
```

- **Language**: TypeScript, strict.
- **Frontend**: React 18 + Vite; state with Zustand; forms with plain controlled inputs (the artifact's
  field table is data-driven — keep that: `FIELDS` → generated form).
- **3D**: three.js via `@react-three/fiber` + `drei` OrbitControls (replaces the hand-written orbit loop).
- **Drawings**: same SVG approach as the artifact (string or JSX), CSS variables for light/dark.
- **Heavy compute**: nesting runs in a **Web Worker** (Comlink), with progress and a cancel button;
  deterministic seed so the same input gives the same plan.
- **PDF**: jsPDF + svg2pdf.js (vector, sharper and smaller than the artifact's SVG→PNG route).
- **Storage**
  - Phase 1: localStorage + JSON export/import + share link (project JSON compressed into the URL hash).
  - Phase 2: Supabase (Postgres + auth via magic link) — tables `projects`, `rooms`, `cut_runs`;
    row-level security per owner; read-only public share links.
- **Hosting**: static build on Cloudflare Pages / Netlify / GitHub Pages; Supabase for phase 2.
- **CI**: GitHub Actions — typecheck, unit + parity tests, Playwright smoke test, deploy preview per PR.

### 3.1 Core data model

```ts
type Plate = { length: number; width: number; pricePerM2?: number };

type RoomTemplate<P> = {
  id: 'attic-gable' | 'flat-ceiling';
  fields: FieldDef[];                 // drives the dimension form
  defaults: P;
  normalize(p: P): { p: P; warnings: string[] };
  model(p: P, plate: Plate): RoomModel;   // surfaces, refs, area, 3D primitives
};

type RoomModel = {
  surfaces: Surface[];      // boards (roof+wall, ceiling+walls) and strip walls
  refs: RefPoint[];         // R1..Rn with coordinates and description
  areaCm2: number;
  mesh: Mesh3D;             // polygons/lines/labels for the 3D view
};

type Piece =
  | { kind: 'rect'; l: number; w: number; ids: number[]; cuts: number[] }
  | { kind: 'trap'; l: number; w: number; ids: number[]; prof: [t: number, h: number][] }
  | { kind: 'pair' | 'nest'; l: number; w: number; parts: PlacedPart[]; ids: number[] };

type CutRequest = { plate: Plate; pieces: (Piece & { room: string })[]; band?: BandSpec;
                    splitAtBends: boolean; seed: number; maxIters: number; timeMs: number };
type CutResult  = { plates: PlateLayout[]; stats: CutStats; warnings: string[] };
```

Every surface (roof slope, knee wall, gable wall, ceiling, band wall) also gets its own **2D coordinate
system (u, v)**: u along the joints, v across them, origin at a fixed corner. Openings and start points are stored
in these local coordinates, measured from the nearest edge, so they stay in place when the room's dimensions change
(see §3.3).

```ts
type Surface = {
  id: string; outline: Polygon;          // in local (u, v) cm
  toWorld: Mat4;                         // local → 3D, for the 3D view and picking
  anchor: { u: number; v: number };      // reference point R (draggable)
  openings: Opening[];                   // windows, doors, cut-outs (draggable)
};
type Opening = { id: string; kind: 'window' | 'door' | 'cutout' | 'pipe';
                 shape: { type: 'rect'; u: number; v: number; w: number; h: number }
                      | { type: 'polygon'; pts: [number, number][] }
                      | { type: 'circle'; u: number; v: number; r: number };
                 anchorEdge?: 'left' | 'right' | 'top' | 'bottom' };   // keeps the distance to that edge
```

Because of this, pieces are **general polygons** from the start (`kind: 'poly'`, with the bend lines kept).
The artifact's `rect`/`trap` become special cases, so adding openings later does not mean rewriting the core.

### 3.2 Room templates (de-duplicating the artifact)

- **attic-gable**: one parametric model for salon, sypialnia and łazienka 1. Parameters: house width,
  roof angle, knee wall height, room span `[xFrom, xTo]` across the house, length, optional flat ceiling
  cap, optional cut-outs (recess, built-in, end-wall cut, window, niche), which gable walls exist,
  partition walls. Salon / Sypialnia / Łazienka 1 become **presets** of this template.
- **flat-ceiling**: Ł2 — width, length, height, band height, board direction.
- Both expose `pieces()` so the shared cut no longer needs globals.

### 3.3 Direct manipulation: drag start points, windows and cut-outs

The artifact only lets you move start points with ◀ ▶ buttons and number fields, and windows are fixed by formula.
The app adds editing with the mouse, finger or pen.

**Where you edit**
- **2D surface editor (main way):** click a surface in the plan view, the unfolded boards or the 3D view, and it
  opens flat, true to scale, with the plate joint grid on top. All dragging happens here, because 2D is precise and
  works on a phone.
- **3D view (secondary way):** the same handles, dragged on the surface's own plane (raycast onto that plane, so
  a handle can't leave its wall). Good for checking things in context; precise edits stay in 2D.

**What you can drag**
| Handle | Behaviour |
|---|---|
| **Start point R** | Moves along the axis across the joints (the joint lines follow live). Dragging along the joints does nothing, because only that one offset matters. Replaces the o1…o9 fields; the numbers stay visible and editable. |
| **Window / door** | Drag the body to move it, the corner and edge handles to resize. Add one from a toolbar (rectangle, polygon, circle for pipes) or by drawing a rectangle. |
| **Cut-out** (recess, built-in, sloped cut) | Same as windows. Polygon mode: click to add vertices, drag vertices, double-click an edge to add one. |
| **Surface outline** (later) | Drag the corners of the room outline for non-standard measurements. |

**Help while dragging**
- Snapping (Shift turns it off): to 1/5/10 cm steps, to joint lines, to surface edges, to other openings' edges, and to
  the bend line. Snap guides are shown as thin lines.
- Live dimension lines from the handle to the nearest edges, editable inline: click the number and type 50.
- **Sliver warning:** any strip narrower than a set minimum (e.g. 10 cm) or any thin bridge left next to a window is
  marked in red while dragging.
- **"Optimise start"** button per surface: tries every R offset in 1 cm steps (in a worker) and suggests the one
  with the fewest plates, then the fewest slivers. Shown as a ghost line you can accept.
- Arrow keys nudge the selected handle (Shift = 10 cm); Delete removes an opening; undo/redo (Ctrl+Z / Ctrl+Y) uses a
  command history over the project state.

**How it changes the calculations**
- Each board strip's polygon minus the openings (polygon clipping with `clipper2-js`, accurate to 0.1 mm) gives the
  pieces. A window can split one strip into two or three pieces, or leave an L-shaped or U-shaped piece; all of
  these are `poly` pieces.
- Geometry and drawings recompute on every pointer move (fast, in the main thread). The shared cut recomputes
  automatically once dragging stops for 400 ms, in the worker; the previous result can be cancelled.
- Nesting of polygon pieces: phase 1 places them by their bounding rectangle (safe and simple; rectangles and
  trapezoid pairs stay as in the artifact). Phase 2 can use true shape nesting (no-fit polygons) to fit small parts
  into the window holes of other pieces.

**Implementation**
- Plain SVG with pointer events (`setPointerCapture`) and a small drag/snap module in `render/`. This keeps it
  consistent with the existing drawings, and handles get large hit areas (≥ 44 px) for touch.
- 3D: `@react-three/fiber` raycasting on the surface mesh, with the drag projected onto the surface plane.
- State: openings and anchors live in the project (Zustand + `immer` patches → undo stack, autosave).

---

## 4. Milestones

| # | Deliverable | Done when |
|---|---|---|
| **M0** | Repo scaffold (pnpm workspaces, Vite, Vitest, ESLint, CI). Save the artifact HTML into `fixtures/`. | CI green on empty app. |
| **M1** | **Parity harness.** Node script loads each room's `model`/`cutPieces` and the shared `compute` from the artifact fixture (the shared-cut code already has a `module.exports` path) and dumps JSON for a set of inputs (defaults + ~20 random valid inputs per room). | Golden JSON files committed. |
| **M2** | `core`: port attic-gable + flat-ceiling models, `normalize`, pieces, trapezoid pairing, nesting (MaxRects + search with same seed), band filling. | Parity tests: same pieces, areas within 0.01 cm², same plate count and utilisation for every golden case. |
| **M3** | `render`: plan view, unfolded boards, gable walls, plate sheets as SVG. | Visual snapshot tests match the artifact's SVG (normalised). |
| **M4** | `web`: project with 4 preset rooms, generated forms, R-point shift controls, summary, ref table, drawings, per-room cut, shared cut tab in a worker, localStorage autosave, light/dark. | Feature checklist in §1 ticked; Playwright smoke test on desktop + phone width. |
| **M5** | 3D view (r3f): roof/ceiling toggle, joint grid, field numbers, red reference balls and start lines. | Same views as the artifact. |
| **M5a** | **Interactive editor, part 1:** 2D surface editor, drag start points R with snapping, live dimensions, sliver warnings, undo/redo, keyboard nudge. | Dragging R on every surface gives the same result as typing the offset into the artifact. |
| **M5b** | **Interactive editor, part 2:** add, move and resize windows, doors and rectangle/polygon cut-outs; polygon clipping into pieces; automatic re-cut after dragging; the same handles in 3D. Salon's fixed window, recess and built-in become normal editable openings. | Salon defaults reproduced with editable openings; parity goldens still pass. |
| **M5c** | "Optimise start" per surface; pieces cut by windows go into the shared cut. | Suggested R never needs more plates than the current one. |
| **M6** | PDF export (per room + shared cut), JSON export/import, share link, piece list/CSV for the workshop. | PDF opens, 1 page summary + plates. |
| **M7** | Accounts + cloud projects (Supabase), add/remove rooms from templates, duplicate project. | Two devices see the same project. |
| **M8** | Improvements beyond the artifact: better nesting (e.g. guillotine-aware, saw-kerf setting), offcut inventory, shopping list, i18n (EN). | Fewer or equal plates than the artifact on all goldens. |

M1–M4 are the core; M5–M6 complete the parity with the artifact; M5a–M5c add editing with the mouse (start
points, windows, cut-outs); M7–M8 make it an online product. Order of work: M0 → M4, then M5a right away
(it is the most visible improvement), then M5 (3D), M5b, M6, M5c.

---

## 5. Testing strategy

- **Parity first**: the artifact is the specification. Every core function is checked against goldens produced
  by running the original code, so the port cannot silently change plate counts.
- Property tests (fast-check): pieces never overlap on a plate, never exceed plate bounds, total piece area
  equals room net area, no piece is mirrored, band segments respect min/max.
- Playwright: open each room, change a dimension, run shared cut, export PDF.
- Editor tests: simulated pointer drags (mouse and touch) move R and openings by the expected cm with snapping;
  undo restores the exact previous state; a window that crosses a joint splits the strip into the right pieces
  (area of pieces = surface area − openings).

## 6. Open questions for the owner

1. Hosting/account preference: static only (no login) first, or accounts from day one?
2. Keep Polish-only UI, or Polish + English?
3. Saw kerf (blade width) — the artifact assumes 0 mm; should the app add a setting?
4. Are new room shapes expected (hip roof, dormers, L-shaped rooms)? This decides how general the
   attic template must be.
5. Should cut plans be printable per plate at 1:10 for the workshop, in addition to the A4 overview?
