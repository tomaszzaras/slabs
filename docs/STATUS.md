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
* Pieces larger than the usable plate (e.g. a gable taller than the plate length) are placed alone and listed in `CutResult.oversize`; the artifact placed them silently.

### Parity result

* All four rooms × 24 golden cases (defaults, 20 random, 3 clamping cases): norm + warnings, full model, pieces, per-room shelf packing: equal (tolerance 1e-7 relative; areas within 0.01 cm²).
* Shared cut: 16 golden cases, same plate count, same per-plate utilisation and the same piece positions at kerf 0, trim 0, allowances 0.
* Known difference from the artifact: none found at kerf 0. The artifact's shared-cut search is time boxed (1.5 s); core stops after `maxIters` (2000) and only uses the time box if `timeMs` is finite. The goldens were generated only where the artifact finished all 2000 tries.
| M3 render | done: `packages/render` (SVG string builders for plan, boards, gables, per-room sheets, shared-cut plates); output is character-for-character equal to the artifact's SVG for all 96 golden room cases + 8 shared-cut cases; 16 file snapshots of the default rooms |
