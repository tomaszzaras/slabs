# Status

Working branch: `claude/implement-slabs`. The reference implementation is `fixtures/okladzina-domu.html` (never edited).

## Commands

```
pnpm install
pnpm typecheck      # tsc in every package
pnpm lint           # eslint
pnpm test           # vitest (unit, parity, property, snapshot)
pnpm build          # production build of packages/web
pnpm dev            # Vite dev server
pnpm goldens        # regenerate fixtures/golden/*.json from the artifact (M1)
pnpm e2e            # Playwright: smoke test (static server, no API) then the cloud-saving test (needs `pnpm build` first); `pnpm e2e:cloud` runs only the latter
```

## Milestones

| | State |
|---|---|
| M0 scaffold | done |
| M1 parity harness | done: `scripts/artifact.mjs` + `scripts/make-goldens.mjs`; goldens in `fixtures/golden/` (4 rooms × 24 cases, 16 shared-cut cases) |
| M2 core port | done: `packages/core` (attic-gable template with salon / sypialnia / łazienka 1 presets, flat-ceiling template, pieces as polygons, pairing + nesting, MaxRects search with seed 20260, band filling, kerf / edge trim / min. offcut / fitting allowances) |
| M2b guillotine mode | done: `settings.guillotine` in `computeCut`, cuts are numbered in cutting order, `verifyGuillotine` checks every plate |

### Core design notes

* One attic implementation (`attic.ts`) serves three presets; norm functions keep each preset's quirks (warning texts, forced flags) so the artifact's output is reproduced exactly.
* `computeCut(request)` in `nest.ts` is the shared cut; per-room cut uses the same engine with one room (the artifact's shelf packer is kept as `packShelf`, parity only).
* **Edge trim** is applied in two places: the room models take `trim` as an optional parameter and use `PW - 2*trim` as the board grid pitch and `PL - 2*trim` as the longest piece, and the nesting uses the trimmed plate. Without that, a full-width board (PW) could never be cut from a plate that lost `trim` on each edge.
* **Kerf**: MaxRects packs boxes inflated by the kerf onto a plate inflated by one kerf. Nested trapezoids and ready-made pairs are moved apart so that the slanted cut also has a full kerf (found numerically, because the artifact accepts slopes that differ by up to 0.5 cm). The guillotine packer works in real sizes and gives each cut a kerf-wide band.
* **Allowances** (`applyAllowances`): pieces carry `edges` (what each edge touches); cut size = fit size + allowance per edge type; `fitL/fitW` keep the fit size. Interior joint edges stay at 0.
* **Pieces longer than the usable plate** (gable strips taller than PL − 2·trim) are split like boards (`splitLong`): equal rules for rect and trapezoid, the profile is clipped, each part keeps `splits: [{edge, at}]` (where the split line is) and a `seg` letter, split edges become `joint` edges. Fitting allowances that would push a piece past the plate are reduced (`clampAllowances`, listed in `CutResult.clamped`). A piece that still cannot fit (wider than the plate; pairs/polygons longer) makes `computeCut` return `blocking: BlockingIssue[]` (room, piece, direction, size, limit, fields to change) with no plates and zero statistics. Utilisation can never exceed 100% (property test).

### Parity result

* All four rooms × 24 golden cases (defaults, 20 random, 3 clamping cases): norm + warnings, full model, pieces, per-room shelf packing: equal (tolerance 1e-7 relative; areas within 0.01 cm²).
* Shared cut: 16 golden cases, same plate count, same per-plate utilisation and the same piece positions at kerf 0, trim 0, allowances 0.
* Known difference from the artifact: none found at kerf 0. The artifact's shared-cut search is time boxed (1.5 s); core stops after `maxIters` (2000) and only uses the time box if `timeMs` is finite. The goldens were generated only where the artifact finished all 2000 tries.
| M3 render | done: `packages/render` (SVG string builders for plan, boards, gables, per-room sheets, shared-cut plates); output is character-for-character equal to the artifact's SVG for all 96 golden room cases + 8 shared-cut cases; 16 file snapshots of the default rooms |
| M4 web app | done: `packages/web` (Vite + React + zustand). Four preset rooms with generated dimension forms, R shift controls (◀ ▶, step 1/5/10/25, Zeruj), summary, reference table, plan / boards / gables drawings, per-room cut, shared cut in a Web Worker (cancel button), settings panel (kerf, trim, min. offcut, guillotine, allowances), autosave (IndexedDB, localStorage fallback), file export/import (`.slabs.json`), share link (`#p=` lz-string), light/dark/auto theme, phone width (no horizontal page scroll). UI strings in `packages/web/src/i18n/pl.ts`. Playwright smoke test `pnpm e2e` (desktop + 390 px phone). Screenshots in `docs/screenshots/` |

### Known artifact bugs (parity exceptions)

The artifact places gable strips taller than the plate sticking out of it (and counts plates over 100%). Golden cases where that happens are listed in `packages/core/src/golden.ts` (`KNOWN_ARTIFACT_BUG`, `KNOWN_SHARED_BUG`) and a test asserts the list equals the set of cases where the artifact overflows. For them the tests assert the corrected behaviour (same total area, nothing outside the plate, never over 100%, pieces valid in the artifact unchanged) instead of equality. salon: rand13, rand17, rand20, clamp3; sypialnia: rand2, rand6; shared cut: random5, random7. Every other golden case and every other assertion is exact.
| M5a surface editor | done earlier: drag start points with snapping, typed measurements on the drawing, undo/redo |
| M5 3D view | done: `packages/web/src/components/View3D.tsx` (react-three-fiber, lazy chunk `View3D-*.js`, loaded only when "Pokaż model 3D" is pressed), scene built by `roomMesh` in `packages/core/src/mesh3d.ts`: roof/ceiling toggle, joint grid per surface, field numbers, red balls and red start lines, keyboard orbit (arrows, +/−, 0), text summary for screen readers |
| M5b openings | done: `packages/core/src/openings.ts` + `OpeningsPanel` + drag handles in `SurfaceEditor` (see below) |
| M6 PDF | done earlier, saw-ready since critique fix A1 |
| M5c optimise start, M7 project list/PWA, M8 | not started. M4b (draw the room) deliberately not started |

### Critique fixes (Impeccable critique of 75b9bad scored 24/40, target >= 32/40)

* **A1 cutting sheet**: plain slant instructions ("skos: góra …, dół … (cm od lewej krawędzi)"), dimension lines on every piece and offcut, origin mark 0 ; 0 and a corner tick on every piece, "Na ścianie" column only when an allowance changed a size, slivers crossed out with "wąski pasek – dociąć na miejscu", plate drawn at the full page width, band pieces grouped ("13× 65×124"), cover footnote only when a plate was bought for the band.
* **A2 phone**: the bottom bar shows total + status (aktualne / liczę… / nieaktualne) and a 44 px recalculate icon button; drawing first, floor plan collapsed below; measurement list with thumbnails and a bottom sheet for number entry; pinch zoom (two-finger touch handler on the drawing frame).
* **A3 empty/invalid input**: an emptied field stays empty (flag `empty` in the store, no project change, no undo step), shows "Wpisz …", `aria-invalid`, dashed "?" on the drawing, the total says "brak wymiaru". Dependent limits explain the reason (`FieldIssue.because` found by perturbing the other inputs). The drawing popover validates before moving to the next measurement. No double colons.
* **A4 marks**: holes with paper fill and X clipped to the polygon; sliver marks >= 6 px with labels inside the drawing; shared-cut plates use `plateMarks` (face dot, X on offcuts, collision-free labels, 1 unit = 1 px so text is never below 12 px). The artifact-parity plate renderers stay for the parity tests only.
* **A5 accessibility**: disclosure markers, WAI-ARIA tabs (roving tabindex, arrows, Home/End), specific handle names, chalk focus ring, contrast on the selected row, drawn icons, `styles.css` on the DESIGN.md ramp (detector: no advisories).
* **A6 copy**: plurals, surface names in user language with coordinates as secondary `detail`, bedroom length label, English prefixes (LR/BD/B1/B2) and default project name, piece labels with a hyphen after a digit (Ł1-10), "?" help popovers with what to measure, 66ch captions.

### Openings (M5b) and the known artifact difference

* Openings are polygons in the coordinates of their surface (boards: u along the plate, z across; gable walls: x, height). `applyOpenings` clips pieces with `polygon-clipping`. A hole that stays inside a piece keeps the piece kind and gets `holes` (nesting and pairing unchanged); an opening that cuts through an edge turns the piece into polygon pieces (nested by bounding box, labelled a, b, …). Pairs of gable strips are split back into two trapezoids where an opening touches them.
* **Known artifact difference** (asserted in `packages/core/src/openings.test.ts`): the artifact counted the salon window's area inside the gable pieces. Here the window is cut out of the pieces, so piece area = net area exactly (the old parity property needed "+ window"). The goldens still pass because `roomPieces(m)` without openings is exactly the artifact's output; the app always passes the project's openings, so the app's default salon needs fewer/other plates than the artifact's 35 where the window splits strips.
* The salon's window is now an editable opening with the artifact's polygon as default; the model is built with `winOn: 0` and the fields "Okno w ścianie z=0" / "Odstęp okna…" are hidden (old project files get the window as an opening on load). Doors, windows, rectangle and polygon cut-outs can be added on any surface (max. 6 per room); move/resize by drag (snapping to whole cm, joint lines, surface edges and other openings; Shift = free; touch needs a short hold), arrow keys (Shift = 10 cm), Delete, and numeric fields.
* **Assumption (owner not available):** the salon's recess ("wpust"), built-in ("zabudowa") and end-wall cut-out are footprint changes (they decide which surfaces exist and how long they are), not holes in one surface. They stay parametric (fields in "Wycięcia") and appear on the drawings as before; making them free openings belongs to M4b (general room geometry). Pieces with openings get no fitting allowances (allowances are skipped for polygon pieces and the rest keep theirs).
* Limits: openings are not clipped on gable strips taller than the plate (split pieces); the 3D view cuts openings out of gable walls only.

## Assumptions made without the owner
* Surface names in user language: "Ściana przy wpuście", "Ściana z oknem", … with `z=415` as secondary detail (model `title` is kept untouched for parity).
* English piece prefixes LR / BD / B1 / B2; a hyphen follows any prefix that ends in a digit, in both languages.
* Phone input font stays at 15 px (DESIGN ramp) although iOS may zoom on focus.
* "Przelicz" is a secondary action now (the cut recalculates ~700 ms after every edit); DESIGN.md updated accordingly.

## Final Impeccable critique of the room screen (after A, B, C)

* **Score 30/40** (design review; target was >= 32, **not reached**). Detector (A/B isolated sub-agents): no source findings; browser: no overflow, no text < 12 px, no contrast failures; open items were 22 px checkboxes, 42 px skip links, text-occlusion warnings that come from transparent hit layers over the drawing.
* P1 findings fixed once: (1) 3D toggles had no visible on/off difference, now a check icon when on; (2) opening linework lacked dimension lines, rectangle openings now carry width and height dimension lines. Detector P2/P3 fixed: 44 px checkboxes and skip links, 66ch notes.
* **Not fixed (open, for the next pass):** warnings count does not link to the first problem or say how to fix a sliver; the default salon window is a non-rectangular polygon, so it has no dimension lines (only vertex handles); the inspector is still a long flat field list and surface-specific data (openings) sits under the drawing rather than beside it; 12+ controls in the top bar on desktop; jargon ("Wnęka na zasłony", coordinates in list rows).

## Brief: panel, names, tongue and groove (docs/briefs/panel-names-tongue-groove.md)

Order of work: (3) tongue and groove, (2) generic names, (1) collapsible measurement panel. One commit per part.

### (3) Tongue and groove (pióro-wpust): done

* **Plate model** (`core/src/plate.ts`): physical L x W (default 500 x 125), tongue (1 cm), profile `all | long | none`. Covering size = physical minus the tongue in each profiled direction (499 x 124). The project holds it in `settings.plate`; the room models are planned in covering sizes (the web `roomInput` injects `PL`, `PW`, `pf`, `trim`, `trimL`; the room forms no longer show the plate fields). Cut result `PL x PW` is the physical plate (gross area and price use it).
* **Migration**: a project without `settings.plate` and with rooms at 499 x 125 becomes 500 x 125 with profile `all` (the owner's product); any other old plate size is kept as a plain plate (`profile none`), so it cuts what it cut before. "Jak w pierwowzorze" = plate 499 x 125, profile none, kerf 0, no allowances: 35 plates, all parity goldens unchanged (the whole parity suite passes untouched).
* **Typed edges**: `Piece.tg` (`l0,l1,w0,w1` = `T` tongue | `G` groove; an edge that is not listed is a plain cut: wall, fold, opening, split made by the user). Derived from the edge kinds (`deriveTg`): a `joint` is profiled; bend, wall, opening, gap are plain. Long joints: `w0` tongue, `w1` groove. End joints (strip longer than a plate, `splitLong`): `l1` tongue, `l0` groove. Openings that cut a piece keep a profile only where the new piece still touches the old edge. Splits at fold lines drop the profile at the fold.
* **Assumption (owner unavailable): direction of the tongue.** The arrow at R points in the direction the plates run (along `l`), so end tongues face it (`l1`). A plate has the tongue on its top long and right short edge, so with the end tongue at `l1` the long-joint tongue must be on `w0` (low field numbers). This one convention holds on every surface and means every piece is placed at 0°. The nesting still supports 180° turns (`orientations`, `rotate180`: a turned piece swaps its profile sides; unit-tested with hand-made pieces) for any piece whose sides ask for it. Only 0° and 180°, never a flip.
* **Nesting** (MaxRects and guillotine share it): an item occupies its covering size plus the tongue on each edge where it keeps one; an edge with a profile must lie on the plate edge with the same profile (placement is anchored to that plate edge: `mrFind` with anchors, `gPlace` can sit in the right/bottom corner of a free rectangle, cut `pos` stays the start of the kerf band so `verifyGuillotine` is unchanged). Pieces with only plain edges are free. Pairs and nested trapezoids are only made when the whole nest can lie on a plate edge with the right profiles (`NestFrame`, `fitsFrame`): head to tail turns one strip by 180°, so with tongue and groove gable strips pair rarely (the model no longer emits ready-made pairs when the profile is on). A piece that cannot be placed with its profile gets it dropped and is counted in `CutResult.tgDropped` (0 in all tests).
* **Trim**: edge trim is not applied to profiled edges (the profile is the edge); `profile long` trims the short edges, `none` all four. Kerf only between pieces.
* **Summary**: the shared cut also runs with the same physical plate without profile (slot `rozkroj:plain`, automatic) and the summary shows "N płyt, gdyby płyty były gładkie" with "pióro i wpust: K płyt więcej/mniej". Default project: 39 plates with tongue and groove, 35 with plain 500 x 125 plates (kerf 3 mm).
* **Marking**: every piece edge is P (pióro) / W (wpust) / nothing = plain cut, on screen (plates: tongue strip drawn outside the edge, letters inside, legend under the plates) and in the cutting-sheet PDF (letters, black tongue strip, legend line, cover lists the profile). English uses T / G.
* **Tests**: `core/src/tongue.test.ts` (12: plate model, typed edges, orientations and 180° turn, constraints on default rooms in both cutting modes, long-only with trim, profile none identical to no plate model, no piece lost, fast-check property: every required profile edge lies on a matching plate edge, no overlaps, never above 100 %, guillotine verification, random rooms/kerf/trim/modes) and `web/src/state/plate.test.ts` (6: defaults, migration, round trip, artifact 35 plates). e2e: P/W letters, legend, comparison stat, plate settings text.
* Limits: pieces made by an opening that cuts through an edge take the profile only where they still touch the old edge; the 3D view and the room drawings do not show tongue/groove (only the plates and PDF do).

## Test results (last run)

* `pnpm test`: 724 tests passed (parity, properties, settings, render snapshots, cut sheets, marks/plates, openings, 3D scene, editing helpers, store, i18n). `pnpm e2e`: all checks passed (desktop and 390 px: tabs pattern, empty field, dependent limit reason, openings add/drag/delete with auto re-cut, 3D lazy chunk, phone status bar and bottom sheet, PDF, CSV). `pnpm typecheck`, `pnpm lint`, `pnpm build`: clean. Screenshots in `docs/screenshots/` (1280 px and 390 px) refreshed after A, B and C.

## Known gaps / notes

* Not done: M4b (draw the room), M5c (optimise start), M7 project list / PWA / duplicate project, M8; openings on gable walls are cut out of the 3D walls (openings on roof/board surfaces are not drawn in 3D) and not dragged in 3D; recess/built-in stay parametric (see above); A3 sheets, sticker labels, tick-off workshop view.
* New projects default to kerf 3 mm, so the default shared cut is not the artifact's number by construction ("Jak w pierwowzorze" = kerf 0, no allowances, and the window cut out of the pieces, which is a known artifact difference).
* The per-room cut uses the shared MaxRects engine; the shelf packer stays for parity only. The shared-cut search uses a fixed iteration count (2000) so results are identical on every device.
* Share links carry the whole project (incl. openings); very large projects may exceed URL limits.
* Build base is `./` and there is no service worker, so the build also works as a claude.ai artifact from a sub-path.

## Undo / redo (item 2)

`state/store.ts`: every project change goes through `edit()` which keeps a history (200 steps); edits of the same field within 1.2 s are one step. Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y), Cofnij / Ponów buttons in the header. "Przywróć wymiary domyślne" is the one label for resetting (room page and project bar), it shows an undo toast; "Zeruj" is a single undoable step with a toast. Undo/redo clears what text fields are showing (`rev`). Tests: `state/store.test.ts` (7) and e2e.

## Polish + English (item 3)

* UI strings: `packages/web/src/i18n/pl.ts` and `en.ts` (same shape, `en: Strings` fails to compile when a key is missing). `i18n/index.ts` holds the current language (`s`, `lang`, `nf` for locale numbers: decimal comma in Polish); the language switch is in the project bar (PL | EN), stored in localStorage, default from the browser language. The app is re-keyed on change.
* Model text (titles, reference points, field limits): `core/src/messages.ts` has `MSG.pl` / `MSG.en`; `buildModel(id, input, lang)`. Room names, field groups/labels and start-point names are Polish in the room definitions (the artifact's wording) and translated by `core/src/texts.ts` (`tr(lang, text)`). Cut notes are language-neutral (`CutResult.notes`, `blocking`, `slivers`); the UI words them.
* Drawing text: `render/src/util.ts` `PL_LABELS` / `EN_LABELS`, every builder takes an optional `Labels` (default Polish, so the artifact parity tests are untouched).
* Tests (`web/src/i18n/i18n.test.ts`): every Polish key exists in English, nothing empty, same parameter counts; every Polish room text has a translation; English model and drawings contain no Polish text.

## UI migration to shadcn/ui + Tailwind (latest change)

At the owner's request the whole UI was rebuilt on **shadcn/ui (Radix) + Tailwind CSS v4**, in a clean modern style (the paper-and-ink / blueprint direction below was dropped; `DESIGN.md` describes the new system). Components in `packages/web/src/components/ui` (Button, Input, Label, Checkbox, Select, Tabs, DropdownMenu, Tooltip, Collapsible `Section`, Badge, Card, Sonner toasts); icons lucide-react; font Geist Variable (self-hosted); tokens in `src/index.css` with a `.dark` class for dark mode. `styles.css` and the hand-drawn icons were removed. All behaviour, state, i18n, drawings (`render/marks.ts`, recoloured through theme tokens) and the PDF export are unchanged; the PDF keeps its embedded Barlow subset. Gotcha recorded: Radix `asChild` triggers need `forwardRef` components (Button), otherwise menus never position. e2e updated for the new controls and still passes (desktop + phone, 44 px targets, 12 px drawing text, PDF). The older "Design (item 4)" notes below describe the previous look; the layout and the surface editor are unchanged. The migration was rebased onto the other session's work (3D view, openings, measurement list, accessibility fixes): their components keep their logic; the shell, top bar, forms, cards, settings, shared page, buttons and inputs use the shadcn primitives, and a compatibility layer in `index.css` styles the remaining legacy class names (`.ml-*`, `.ol`, `.v3-*`, `.meas-edit`) with the same tokens.

## Design (item 4) and surface editor (item 5)

* **Layout** (docs/briefs/room-editor.md): sticky top bar (project switcher with several projects kept in the browser, room tabs, live project total "plates · zł · waste · warnings" with a stale badge, "Przelicz cięcie", undo/redo, menu); left: room plan + surface list with state in words; centre: selected surface at scale, summary, per-room cut; right: inspector (dimensions first, start point of the selected surface, settings). The shared cut recalculates itself 0.7 s after a change (worker). Phone: one column, room tabs scroll sideways, total + main action in a fixed bottom bar, drawings scroll inside a frame with a hint. `DESIGN.md` + `.impeccable/design.json` document the system.
* **Drawings** (`render/src/marks.ts`, the artifact-parity builders are untouched): chalk-blue joints (start line heavier), start tick + arrow in a labelled box at every R, circled face dot + number per field, red dashed fold, dotted chalk split line where a strip is taller than a plate, pencil X over windows/cut-outs/slivers with their width, dimension lines with ticks, pattern + tint per room (distinguishable in black and white), blueprint dark mode. Labels never overlap (`LabelPlacer`), only R points that exist in the room are drawn, text is 1 unit = 1 px and ≥ 12 px.
* **Typeface: Barlow** (self-hosted in `packages/web/public/fonts`, latin + latin-ext). Why: DIN-style engineering lettering fits "workshop drawing", narrow enough for dense dimension figures, real tabular figures (`tnum`, checked in the font file), full Polish diacritics, one family for UI and drawings. Not Inter / Space Grotesk.
* **Assumptions made without the owner** (Impeccable questions decided from PRODUCT.md + brief): the room-screen layout above; the action accent is a deep ink-blue close to chalk blue (primary buttons only); the project switcher is a minimal list of projects in the browser (full project management is M7); "missing measurement" is shown when the user empties a field (templates always have defaults); Creative North Star "The Carpenter's Marks".
* **Impeccable critique of the room screen: 27/40 (Acceptable)** before fixes. P1 fixed once: dimensions first in the inspector (only the selected start point shown, "all" on demand), the drawing now takes input (below), out-of-range message says which value the plan uses; also one calculate verb (room cut renamed "Przelicz tylko to pomieszczenie"), skip link to dimensions, separator for screen readers, selected surface scrolls into view on phone. Not re-scored (one fix pass as instructed); the P1s were the lowest-scoring heuristics (recognition, flexibility), so the target of ≥ 32/40 is likely met but **unverified**. Snapshot in `.impeccable/critique/`. Detector: 17 advisory style-drift findings (font sizes/colours in styles.css off the documented ramp), 1 `cream-palette` note (the paper ground is intentional).
* **M5a surface editor** (`SurfaceEditor.tsx`): draggable start point on every surface (handle 48 px hit area; mouse drags at once, touch/pen after a 280 ms hold so scrolling and pinching stay easy; arrow keys nudge ±1, Shift ±10), snapping to whole cm (Shift = tenths) with a magnet that puts a joint exactly on a surface edge, live readout (shift, widths of first/last field) while dragging, one undo step per drag. Dimension lines that are one input of the room (flat-ceiling room: all; attic: knee-wall height and room length of R1) are tappable/Enter-able, open a number field on the drawing and Enter jumps to the next; an emptied field shows its dimension dashed with "?". Tests: `SurfaceEditor.test.ts`, e2e (nudge, drag, typed measurement). Not done: dragging openings (M5b), measurement lines for the remaining derived attic dimensions (need M4b room geometry).

## Cutting sheets and PDF (item 6, M6)

`render/src/cutsheet.ts` builds the sheet data (one per plate: pieces with label, cut size, wall/fit size when an allowance changed it, position from the plate corner, corner coordinates for slanted pieces, fold and split lines, offcuts keep/waste, guillotine cuts in order); `web/src/pdf/exportPdf.ts` writes a vector PDF with jsPDF (lazy-loaded, Barlow subset embedded for Polish letters): cover page (project, date, plates, size, area, cost, utilisation, kerf, trim, allowances, method, plate list with rooms and utilisation, band pieces) and one A4 landscape sheet per plate at 1:20 or the nearest scale that fits: plate outline, pieces in room-specific greys with labels, circled face dot, grain arrow, dashed bend lines, dotted split lines, hatched offcuts with size and "keep/waste", kerf (black numbered bands in guillotine mode, the gap otherwise, plus a 1:1 kerf sample), and a table with a checkbox per piece (cut size, size on the wall, position, notes). Black-and-white readable (greys + text, no colour). Buttons on the shared cut and on each room's cut; CSV piece list. Tests: `cutsheet.test.ts`, e2e downloads the PDF and checks it has 1 + plates pages. Not done: A3 option, sticker labels, the workshop (tick-off) view on the phone, browser `@media print` of the on-screen drawings.

## Known gaps / notes

* Not done in this session: 3D view (M5), 2D surface editor (M5a), openings (M5b), optimise start (M5c), PDF + printable cutting sheets (M6), project list / PWA (M7). The core already carries what M6 needs (piece `edges`, `fitL/fitW`, guillotine `cuts`, `offcuts`, kerf/trim).
* New projects default to kerf 3 mm (PLAN §3.4), so the default shared cut is not the artifact's number by construction; "Jak w pierwowzorze" (kerf 0, no allowances) gives the artifact's 35 plates.
* The per-room cut in the app uses the shared MaxRects engine (not the artifact's shelf packer), so its plate counts can be lower than the artifact's per-room tab. The shelf packer is kept in core for parity tests.
* The artifact's shared-cut search is wall-clock limited; the app uses a fixed iteration count (2000), so results are identical on every device.
* Share links carry the whole project; very large projects could exceed browser URL limits (not hit with the four presets).
* Core `CutResult.warn` (artifact parity) stays Polish; the UI uses `CutResult.notes`.
| M5a | done (see above), except measurement lines for derived attic dimensions |
| M6 | done (see above), except A3, stickers, workshop view |
| M5 (3D), M5b, M5c, M7 (full project list/PWA), M8 | not started |

## Cloud saving (projects stored online under a secret link)

Requirement: the whole project is stored in a file on a server and updated on every change, so it can be opened from any device. No login.

**How it works**

* Server: Netlify Function `netlify/functions/projects.ts` (route set in code: `/api/projects`, `/api/projects/*`) over Netlify Blobs, store `projects`. Request logic is in `netlify/lib/projects-api.ts` (pure `Request -> Response`, unit tested with an in-memory store, `netlify/lib/memory-store.ts`).
  * `POST /api/projects` (body = project JSON) -> `201 {id, revision, updatedAt}`. `GET /api/projects/:id` -> project JSON, headers `x-revision`, `x-updated-at`. `PUT /api/projects/:id` (body = project JSON, header `x-base-revision`) -> `200 {revision, updatedAt}`, or `409` with the server copy as body when the server revision differs from the base revision.
  * Blob value = exactly the `.slabs.json` format, normalised by `sanitizeProject` (same function on client and server). Revision and updatedAt are blob metadata. Writes are conditional on the blob's etag, so two concurrent saves cannot both win (the loser gets 409).
  * ids: 32 random URL-safe characters (192 bits, `crypto.getRandomValues`). The link is the key. Bodies over 2 MB: 413. Bad JSON / not a project: 400.
* Client: `state/cloudApi.ts` (fetch wrapper, typed results), `state/sync.ts` (`Syncer`: debounce 800 ms, retry with back-off 3/10/30/60 s, conflict handling, page-hide save with `fetch keepalive`), `state/open.ts` (which project to open), wiring in `state/store.ts`; `state/storage.ts` keeps the bookkeeping per local project (`slabs:cloud:v2`: cloud id, revision, unsynced flag).
  * Open: `?p=<id>` loads from the server; otherwise the most recent local project is opened with the cloud id remembered for it; a local project without a cloud id is uploaded as a new cloud project (migration; the URL becomes `?p=<id>`). Every local project of the project list has its own cloud id (`ProjectInfo.cloudId`); projects other than the newest are uploaded the first time they are opened from the list. A first-time visitor creates the project on the first edit; "Nowy projekt" starts a new cloud project. `#p=` share links still open a copy (with a new local id), which becomes its own cloud project on the first edit. Importing a file replaces the content of the open project (same project, same link).
  * IndexedDB stays as the offline cache. Unsynced edits are marked `dirty` and pushed on the next open / when back online. If the server has a newer revision (409) the server copy is shown and the local one is offered by the toast button "Kopia z tego urządzenia"; it is also kept in IndexedDB until restored or dismissed, so nothing is lost. Restoring is an ordinary edit on top of the server copy.
  * Top-bar status: `Zapisano ✓` / `Zapisuję…` / `Offline – zapiszę później` / `Błąd zapisu – spróbuj ponownie` (click to retry) / `Zapis tylko w tej przeglądarce`. Strings: `i18n/pl.ts` and `i18n/en.ts`, section `cloud` (+ `project.copyProjectLink` etc.).
  * Menu: "Kopiuj link do projektu" (with the note that anyone with the link can edit). `navigator.storage.persist()` is requested once at start.
  * Without the API (plain `pnpm dev`, any static host, `file://`, or the `SINGLEFILE=1` build) the first response lacks the `x-slabs-api` header, the app switches to browser-only saving for the session and shows the quiet status. The single-file build (and `file://`) never calls the API at all (`__SINGLEFILE__` flag set in `vite.config.ts`).

**Limits and caveats**

* Anyone with the link can read and edit the project; there is no login, no list of projects on the server and no way to delete one from the UI. Do not post the link publicly.
* 2 MB per project. No rate limiting. Last-writer-wins only through the explicit conflict choice (no merging of edits).
* Edits made in two tabs of the same browser at once go through the same conflict path.
* Deleting a project from the list removes it from this browser only; the online copy and its link keep working.

**Running it locally**

* `pnpm dev` runs without the API (browser-only mode). `pnpm e2e:cloud` runs the real handler (bundled with esbuild, in-memory store) behind a small Node server and drives Chromium through create / reload / second browser context / conflict / offline / share link.
* `netlify dev` (netlify-cli) would run the real function with Blobs emulation. It could not be run in the development container: `netlify dev` needs to download Deno for edge functions, and `functions:serve` loads the TypeScript unbundled and fails to resolve the extensionless imports of `@slabs/core`. The production build bundles with esbuild (`netlify.toml`, `node_bundler = "esbuild"`); the same esbuild bundling is what `e2e:cloud` verifies, but the deployed function on real Blobs has not been exercised yet.

**Owner: please check on the live site after the deploy**

1. Open the site: the status in the top bar should reach `Zapisano ✓`, and the address should turn into `...?p=<long id>` (an existing browser project is uploaded automatically on the first open).
2. Change a dimension, wait ~1 s, open the `?p=` link in a private window or on another device: the change must be there.
3. If the status shows `Zapis tylko w tej przeglądarce` on the live site, the function is not being served (check Netlify > Functions for `projects` and the deploy log) or Blobs is not available for the site.
4. "Kopiuj link do projektu" copies the link. Bookmark it: it is the only key to the project.

## Test results (cloud saving)

* `pnpm test`: all pass (new: 6 API handler tests and 16 sync / client tests: create/get/put, 409, race, size limit, invalid JSON, API-missing fallback, retry after offline, migration, per-project cloud ids, page-hide save, status texts).
* `pnpm e2e`: smoke (static server, i.e. the fallback path) and cloud e2e (create, reload, second browser context, copy link, conflict + restore, offline, share link copy, migration of a local project, unknown link, single-file build when `dist-single` exists) both pass.
