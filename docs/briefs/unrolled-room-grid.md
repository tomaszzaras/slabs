# Brief: one unrolled roof grid per room, splits chosen by clicking

Owner's request (2026-11-21): "I don't see reason to have R2, R3, R4 — one right slope is enough. Ideally when I define
all the dimensions I would like to have one flat grid, and decide by clicking which ones I would like to split; even
combining both slopes into one is best." Confirmed: one grid across both slopes with pieces cut at the ridge by default;
the room unrolled into one flat sheet; gable walls stay separate with their own start points.

## 1. One roof sheet per room
- The roof-and-knee-wall cladding of a room is ONE surface, the "roof sheet", with ONE start point R and one joint grid.
  It replaces today's per-segment surfaces (salon R1–R5: left slope, right slope at the recess, right slope wall,
  right slope at the corner cut-out, cut-out wall).
- Unrolling: for each z (along the ridge) take the room's cross-section path floor → knee wall → slope → ridge → slope →
  knee wall → floor and lay it flat by arc length, u = 0 at the ridge (negative = left). Where a cross-section has no
  ridge (e.g. behind a corner cut-out that passes the ridge) the path starts at the fold of the cut-out wall, which
  unrolls as part of the sheet. Recesses, cut-outs, wall offsets and windows change the sheet's outline or are holes.
- Strips run across the sheet (ridge → floor); joints are at constant z, every covering width (124 cm with tongue and
  groove), positioned by R. Joints therefore line up over the ridge automatically.
- Gable walls stay separate surfaces with their own grid (vertical strips) and their own start point, as now.

## 2. Flat grid with clickable splits
- The 2D view of the roof sheet shows the whole unrolled room: strips, outline, holes, fold lines (labelled
  "kalenica", "zgięcie dach/ściana", "ściana wycięcia"), plate-length limits.
- Every place a strip can be split is a clickable line: the ridge, each roof/wall fold, the fold at a cut-out wall,
  and any point along a strip (click to add a cross-cut there; drag to move it; click again to remove).
- Click toggles split/join for that strip; a header action applies the same choice to the whole line across all strips
  ("Dziel wszystkie na kalenicy" etc.).
- Defaults: split at the ridge ON; split at roof/wall folds per the project setting "Dziel kawałki na zgięciach";
  automatic cross-cuts only where a piece would exceed the plate's covering length (placed at the best position, shown
  dashed, movable).
- A joined piece longer than the plate's covering length is blocked with a clear message on that strip. Joining across
  a fold is allowed (the user knows their material) but shown with the fold mark.
- Tongue and groove: user cross-cuts inside a flat part are end joints (tongue/groove); splits at the ridge, folds and
  outline are plain cuts.
- Pieces, nesting, cutting sheets and 3D all use the resulting pieces; piece numbers follow strip order.

## 3. Start points and data
- Per room: one R for the roof sheet + one per gable wall. Existing projects migrate: the roof sheet's R takes the
  default start (ZO + o1); other roof-segment offsets are dropped (listed in the migration note).
- Split choices are stored in the project (per strip: set of split positions/types), survive dimension changes where
  possible (re-snapped to the nearest fold; free cross-cuts kept by distance from the ridge), and are undoable.
- Parity: the artifact-parity tests keep running on the legacy per-segment model in core ("Jak w pierwowzorze");
  with all artifact offsets equal, the new sheet must produce the same joints and the same pieces as the legacy model
  (test). The UI only uses the sheet.

## Out of scope now
Hip roofs and dormers; aligning gable strips to the roof grid.
