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
- **Storage — no login (decided)**
  - Projects saved in the browser (IndexedDB via `idb-keyval`, several projects, autosave, undo history in memory).
  - **Export / import a `.slabs.json` file**: the way to back up or move a project to another device.
  - **Share link**: project JSON compressed with `lz-string` into the URL hash (`#p=…`). Nothing goes to a server;
    opening the link loads a copy. A note warns that browser data can be cleared, so export important projects.
  - Works offline after the first visit (PWA service worker), which helps on the building site.
  - Later, only if needed: Supabase (Postgres + auth via magic link) — tables `projects`, `rooms`, `cut_runs`;
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

### 3.4 Saw cut thickness (kerf)

Settings per project (the plate settings panel), all in mm:

| Setting | Default | Meaning |
|---|---|---|
| **Cut thickness (kerf)** | 3 mm (0 = artifact behaviour) | Material lost in every saw cut. |
| Edge trim | 0 mm | Strip cut off each plate edge first (damaged or uneven factory edge). |
| Min. usable offcut | 10 cm | Smaller leftovers are counted as waste, not kept as offcuts. |

How the kerf is used:
- **Nesting:** each piece is packed as if it were `l + kerf` × `w + kerf`, on a plate of
  `(PL − 2·trim + kerf)` × `(PW − 2·trim + kerf)`. This leaves exactly one kerf between neighbouring pieces and
  none at the plate edge. The drawn piece keeps its true size.
- **Nested trapezoids and pairs:** the second piece is moved away along the slanted cut by `kerf / cos(slope)`, so
  the diagonal cut also has a full kerf.
- **Long pieces split at PL and pieces split at bends:** the lost kerf is shown on the cutting sheet; piece lengths
  stay as measured on the wall.
- **Band from offcuts:** an offcut must be at least `band height + kerf` to be used.
- Kerf = 0 must reproduce the artifact exactly (part of the parity tests).
- Statistics show the area lost in saw cuts separately from offcut waste.

#### Fitting allowance (error buffer)

The kerf is lost material. The **allowance** is extra (or less) material deliberately left on a piece so it still
fits when the room isn't exactly as measured. Each piece has two sizes:

- **fit size**: from the model (what the wall needs)
- **cut size**: fit size + allowances (what goes onto the plate and onto the cutting sheet)

The allowance depends on what the edge touches, and the model already knows that for every edge:

| Edge type | Example | Default | Why |
|---|---|---|---|
| Against a wall, floor, ceiling or ridge | board end at the floor, gable strip at the slope | **+10 mm** | Walls are uneven; cut a bit long and trim or scribe on site. |
| Joint between neighbouring plates | long factory edges on the grid lines from R | **0 mm** | Must be exact and straight; keep the factory edge. |
| Bend line, when pieces are split there | roof/wall, ceiling/wall | **+5 mm** | Inside corner, trimmed on site. |
| Around windows, doors, pipes | edge of an opening | **−3 mm** (clearance) or +10 mm (trim on site) | Choose: precut with a gap, or cut long and fit. |
| Expansion gap | edge against masonry | **−5 mm** | Wood-based boards move; leave a gap to be covered by trim. |

- **Signs:** a positive value makes the piece bigger, a negative one smaller.
- **Where to set it:** project defaults → overridable per room → per surface → per single edge (click the edge in the
  2D editor). A quick "+ X mm on all outer edges" switch covers the simple case.
- **Angle tolerance (optional):** extra length on slanted ends so a ±1° roof-angle error still fits:
  `extra = width × tan(1°)` ≈ 2 mm per 125 mm. Added automatically when "angle tolerance" is on.
- **Joint grid stays put:** allowances never move the joints from R; they only change the cut outline.
- **Sheets and nesting:** nesting uses the cut size (plus kerf). The cutting sheet shows the cut size in bold and
  the fit size small (`cut 466 / fit 465`), and marks edges that carry an allowance with "+10, trim on site".
- **Statistics:** the area added by allowances is shown separately, so you can see what the safety margin costs.
- **Parity:** with all allowances at 0, the results match the artifact.

Optional **"guillotine cuts only"** mode for a table or panel saw, where every cut goes straight across the
current part. The packer then uses guillotine splits and the sheet shows the cut order. It is off by default,
like the artifact; with a track saw or jigsaw it isn't needed.

### 3.5 Printable cutting sheets

One sheet per plate, for the workshop, from the shared cut or a single room:
- **Format:** A4 landscape by default (A3 optional). The plate is drawn as large as fits, with the scale written
  on it (e.g. 1:5), vector PDF; also print directly from the browser (`@media print`, one plate per page).
- **On the drawing:**
  - Plate number and size, material, and an arrow showing the grain direction.
  - Each piece outlined, filled with its room colour, and labelled with its ID (e.g. `S12a`).
  - Dimensions: the piece's length × width, its distance from the plate corner, and every corner of slanted and
    polygon pieces given as coordinates from the plate corner.
  - Saw cuts shown with their kerf width; in guillotine mode they are numbered in cutting order.
  - Bend lines (roof/wall, ceiling/wall) dashed red with "zgięcie / cut here?" according to the split setting.
  - Window and cut-out holes inside pieces dashed, with dimensions.
  - Offcuts hatched and labelled with size, marked "keep" if over the minimum usable size.
  - "Face side up" mark, because pieces must not be flipped.
- **Table under the drawing:** piece ID, room, surface and field number (where it goes on the wall, matching the
  reference points R), size, and a ☐ checkbox to tick off when cut.
- **Cover page:** project name, date, settings (plate, kerf, trim), plate count, total cost, list of all
  plates, and the band pieces list.
- **Labels (optional):** a sheet of small stickers with piece IDs to stick on cut pieces.
- In the app, the same sheet is a "Workshop" view per plate, usable on a phone at the saw: tap a piece to see its
  dimensions large and mark it as cut (saved with the project).

## 4. Milestones

| # | Deliverable | Done when |
|---|---|---|
| **M0** | Repo scaffold (pnpm workspaces, Vite, Vitest, ESLint, CI). Save the artifact HTML into `fixtures/`. | CI green on empty app. |
| **M1** | **Parity harness.** Node script loads each room's `model`/`cutPieces` and the shared `compute` from the artifact fixture (the shared-cut code already has a `module.exports` path) and dumps JSON for a set of inputs (defaults + ~20 random valid inputs per room). | Golden JSON files committed. |
| **M2** | `core`: port attic-gable + flat-ceiling models, `normalize`, pieces, trapezoid pairing, nesting (MaxRects + search with same seed), band filling; **kerf, edge trim and min. offcut settings** (§3.4). | Parity tests at kerf 0: same pieces, areas within 0.01 cm², same plate count and utilisation for every golden case. Kerf > 0: no two pieces closer than the kerf. |
| **M2b** | Guillotine-only packing mode with cut order. | Every layout can be cut with straight through-cuts in the listed order. |
| **M3** | `render`: plan view, unfolded boards, gable walls, plate sheets as SVG. | Visual snapshot tests match the artifact's SVG (normalised). |
| **M4** | `web`: project with 4 preset rooms, generated forms, R-point shift controls, summary, ref table, drawings, per-room cut, shared cut tab in a worker, localStorage autosave, light/dark. | Feature checklist in §1 ticked; Playwright smoke test on desktop + phone width. |
| **M5** | 3D view (r3f): roof/ceiling toggle, joint grid, field numbers, red reference balls and start lines. | Same views as the artifact. |
| **M5a** | **Interactive editor, part 1:** 2D surface editor, drag start points R with snapping, live dimensions, sliver warnings, undo/redo, keyboard nudge. | Dragging R on every surface gives the same result as typing the offset into the artifact. |
| **M5b** | **Interactive editor, part 2:** add, move and resize windows, doors and rectangle/polygon cut-outs; polygon clipping into pieces; automatic re-cut after dragging; the same handles in 3D. Salon's fixed window, recess and built-in become normal editable openings. | Salon defaults reproduced with editable openings; parity goldens still pass. |
| **M5c** | "Optimise start" per surface; pieces cut by windows go into the shared cut. | Suggested R never needs more plates than the current one. |
| **M6** | PDF export (per room + shared cut) and **printable cutting sheets** (§3.5): one plate per page, scale, dimensions, piece table with checkboxes, cover page; browser print; piece list CSV; workshop view. | Every piece on every sheet can be cut from the sheet alone without the app. |
| **M7** | Project list in the browser, add/remove rooms from templates, duplicate project, file export/import, share link, offline (PWA). *(Accounts + cloud sync postponed; only if needed.)* | A project exported on one device opens identically on another. |
| **M8** | Improvements beyond the artifact: better nesting (e.g. guillotine-aware, saw-kerf setting), offcut inventory, shopping list, i18n (EN). | Fewer or equal plates than the artifact on all goldens. |

M1–M4 are the core; M5–M6 complete the parity with the artifact; M5a–M5c add editing with the mouse (start
points, windows, cut-outs); M7–M8 make it an online product. Order of work: M0 → M4, then M5a right away
(it is the most visible improvement), then M5 (3D), M5b, M6, M5c.

---

## 5. Testing strategy

- **Parity first**: the artifact is the specification. Every core function is checked against goldens produced
  by running the original code, so the port cannot silently change plate counts.
- Property tests (fast-check): pieces never overlap and keep at least one kerf apart on a plate, never exceed plate bounds, total piece area
  equals room net area, no piece is mirrored, band segments respect min/max.
- Playwright: open each room, change a dimension, run shared cut, export PDF.
- Editor tests: simulated pointer drags (mouse and touch) move R and openings by the expected cm with snapping;
  undo restores the exact previous state; a window that crosses a joint splits the strip into the right pieces
  (area of pieces = surface area − openings).

## 6. Open questions for the owner

1. ~~Hosting/account preference~~ **Decided: start without login.** Static site; projects in the browser
   (IndexedDB) + JSON file export/import + share link. Accounts (M7) only if needed later.
2. Keep Polish-only UI, or Polish + English?
3. ~~Saw kerf~~ **Decided: kerf is a setting** (§3.4), plus edge trim; printable cutting sheets (§3.5).
4. Are new room shapes expected (hip roof, dormers, L-shaped rooms)? This decides how general the
   attic template must be.
5. ~~Printable sheets per plate~~ **Decided: yes** (§3.5). Still open: which saw you use (table/panel saw →
   guillotine mode on by default; track saw/jigsaw → off), and your usual kerf.
