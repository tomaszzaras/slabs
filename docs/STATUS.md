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
pnpm e2e            # Playwright smoke test (needs `pnpm build` first)
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

## Test results (last run)

* `pnpm test`: 669 tests passed (parity incl. 96 known-bug checks, property tests incl. trust-in-results, settings, render parity/snapshot).
  Property tests use a fixed seed (20260); try others with `FC_SEED=3 pnpm test`. Seeds 1-12 pass.
* `pnpm e2e`: all checks passed (5 tabs, per-room edit/shift/cut, shared cut = 35 plates with artifact settings, reload autosave, theme, share link, phone width, no console errors).
* `pnpm typecheck`, `pnpm lint`, `pnpm build`: clean.

## Undo / redo (item 2)

`state/store.ts`: every project change goes through `edit()` which keeps a history (200 steps); edits of the same field within 1.2 s are one step. Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y), Cofnij / Ponów buttons in the header. "Przywróć wymiary domyślne" is the one label for resetting (room page and project bar), it shows an undo toast; "Zeruj" is a single undoable step with a toast. Undo/redo clears what text fields are showing (`rev`). Tests: `state/store.test.ts` (7) and e2e.

## Polish + English (item 3)

* UI strings: `packages/web/src/i18n/pl.ts` and `en.ts` (same shape, `en: Strings` fails to compile when a key is missing). `i18n/index.ts` holds the current language (`s`, `lang`, `nf` for locale numbers: decimal comma in Polish); the language switch is in the project bar (PL | EN), stored in localStorage, default from the browser language. The app is re-keyed on change.
* Model text (titles, reference points, field limits): `core/src/messages.ts` has `MSG.pl` / `MSG.en`; `buildModel(id, input, lang)`. Room names, field groups/labels and start-point names are Polish in the room definitions (the artifact's wording) and translated by `core/src/texts.ts` (`tr(lang, text)`). Cut notes are language-neutral (`CutResult.notes`, `blocking`, `slivers`); the UI words them.
* Drawing text: `render/src/util.ts` `PL_LABELS` / `EN_LABELS`, every builder takes an optional `Labels` (default Polish, so the artifact parity tests are untouched).
* Tests (`web/src/i18n/i18n.test.ts`): every Polish key exists in English, nothing empty, same parameter counts; every Polish room text has a translation; English model and drawings contain no Polish text.

## Known gaps / notes

* Not done in this session: 3D view (M5), 2D surface editor (M5a), openings (M5b), optimise start (M5c), PDF + printable cutting sheets (M6), project list / PWA (M7). The core already carries what M6 needs (piece `edges`, `fitL/fitW`, guillotine `cuts`, `offcuts`, kerf/trim).
* New projects default to kerf 3 mm (PLAN §3.4), so the default shared cut is not the artifact's number by construction; "Jak w pierwowzorze" (kerf 0, no allowances) gives the artifact's 35 plates.
* The per-room cut in the app uses the shared MaxRects engine (not the artifact's shelf packer), so its plate counts can be lower than the artifact's per-room tab. The shelf packer is kept in core for parity tests.
* The artifact's shared-cut search is wall-clock limited; the app uses a fixed iteration count (2000), so results are identical on every device.
* Share links carry the whole project; very large projects could exceed browser URL limits (not hit with the four presets).
* Core `CutResult.warn` (artifact parity) stays Polish; the UI uses `CutResult.notes`.
| M5a, M5, M5b, M5c, M6, M7, M8 | not started (see gaps) |
