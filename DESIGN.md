---
name: Slabs
description: A clean, modern planning tool for cladding rooms with wooden plates, built on shadcn/ui and Tailwind.
colors:
  background: "oklch(0.985 0 0)"
  card: "oklch(1 0 0)"
  foreground: "oklch(0.21 0.02 265)"
  muted-foreground: "oklch(0.47 0.02 265)"
  border: "oklch(0.915 0.005 265)"
  primary: "oklch(0.52 0.19 262)"
  destructive: "oklch(0.55 0.22 27)"
  success: "oklch(0.52 0.14 150)"
  warning: "oklch(0.62 0.15 70)"
  dark-background: "oklch(0.16 0.012 265)"
  dark-primary: "oklch(0.72 0.14 262)"
typography:
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "44px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
---

# Design System: Slabs

## Overview

**Creative North Star: "The Quiet Workbench"**

A neutral, modern application shell (shadcn/ui on Radix, styled with Tailwind v4) that gets out of the way of the drawings. Surfaces are white cards on a very light grey ground (a deep blue-grey in dark mode), borders are hairlines, shadows are almost absent, and one blue carries every action, selection and plan line. The earlier paper-and-ink / blueprint look was dropped at the owner's request.

## Colors

Neutral surfaces plus a single blue. **Primary blue** marks actions, selection, the plate joints and start lines in drawings; **destructive red** marks errors and bend/cut lines; **warning amber** and **success green** appear only on warnings and OK states, always next to an icon and words. Rooms are told apart by a soft tint *and* a pattern, so they stay distinct in black and white. Tokens live in `packages/web/src/index.css` (`:root` and `.dark`).

## Typography

Geist Variable (self-hosted through `@fontsource-variable/geist`, latin + latin-ext) with tabular figures switched on globally. Page title 24 px / 600, section titles 16 px / 600, body 14 px, helper text 12-13 px. Drawing text is 12 px or more.

## Layout

Sticky top bar (project, rename, new, live project total, main action, undo/redo, menu) with the project's pages as tabs below it: **Przegląd** (home, first, opened by default) · the rooms · the band (Opaska) · a "+ Dodaj" button beside the tab list (not a tab, so roving tabindex stays inside the tablist; disabled while the one allowed band exists). Przegląd and the band page are single-column pages (max 1760 / 1100 px) with no measurement rail or panel; only room pages carry the panel. Room screen: surface list and floor plan | drawing and cards | inspector (dimensions, start points, settings). Under 1024 px the inspector moves below; under 768 px it is one column, the total and main action live in a fixed bottom bar. Controls are 44 px high everywhere.

## Elevation & Depth

Flat with 1 px borders; `shadow-xs` on inputs and cards, a normal popover shadow on menus. No decorative shadows.

## Shapes

Rounded rectangles (6-14 px). Drawing marks keep their own geometry (ticks, X, dashed fold, dimension lines with 45° slashes).

## Components

shadcn/ui primitives in `packages/web/src/components/ui`: Button (forwardRef, 44 px sizes), Input, Label, Checkbox (24 px box, 44 px hit area), Select, Tabs, DropdownMenu, Tooltip, Collapsible `Section`, Badge, Card, Separator, Sonner toaster. App components compose them (`TopBar`, `RoomScreen`, `SharedPage`, `ParamForm`, `SettingsPanel`, `SurfaceEditor`). Icons are lucide-react.

**View switch (2D | 3D)**: a segmented control in a card header (`role=group`, two `aria-pressed` 44 px buttons; the active one is filled primary). The alternative view replaces the content in the same frame (same position and size, no extra scrolling) and the header swaps the view-specific tools in place (2D: zoom; 3D: option toggles, icon-only below 640 px with the name in `aria-label`). The switch keeps its place, the choice is remembered, and the heavy view loads on first use. Use it when two views show the same object and share one selection.

**Clickable split lines (roof sheet)**: a drawing whose lines are choices, not only marks. Every place a strip can be cut is a focusable `role=switch` with a 24 px wide hit area (`aria-checked` = split; Enter or Space toggles); the dashed red fold stays visible, a split is drawn solid and heavy on top of it. A click on the strip body adds a cross-cut (drawn blue), a cross-cut is a focusable slider (arrows move it, Delete removes it; mouse drags at once, touch needs the same short press-and-hold as the start-point handle so scrolling stays easy; a click without moving removes it). A header menu with the same words applies one choice to a whole line ("Dziel wszystkie: kalenica" / "Połącz wszystkie: ..."). A choice that cannot be made (a joined piece longer than the plate) is refused in words on the strip and in a status line, never silently. Below 640 px the header menu is an icon button like the 3D toggles, so the drawing frame does not move between 2D and 3D.

**Room page = four sections (every room)**: **Kształt** (a collapsible card: ceiling and position as `Segmented` controls, width / length / height fields, the roof fields as greyed project values with "Zmień dla tego pomieszczenia", notches as cards with their sizes, the floor plan beside it), **Powierzchnie** (the surface list, each with its state: wood / other / split / boards horizontal), **Okładzina** (the selected surface: finish strip *Drewno | Inne | Podział wysokością*, direction with drawn icons, start field, then the drawing), **Wynik** (summary with m² of wood and of other finish, the room cut). On a phone the sections stack in this order and the surface list sits between Kształt and Okładzina.

**Segmented control** (`Segmented.tsx`): a row of `aria-pressed` buttons, 44 px high, the chosen one filled primary; used for ceiling, position, finish, direction, which part of a wall is wood.

**Non-wood zones**: hatched grey (`--other-bg` / `--other-ink` with a 45° line pattern, so it reads in black and white), with the name of the finish (default "Inne") and its area in m² written on it (`mk-other-t`, paper-coloured halo); no joint lines, number or start mark on it, and it produces no pieces.

**Room list and add-room flow**: tabs are Przegląd · rooms · a ghost "+ Dodaj pomieszczenie" button (opens a `Dialog`: centred on wide screens, bottom sheet on a phone). The picker is a grid of 44 px+ template cards (small section drawing in wood colour + name + one line); step two is the name. A room's menu ("..." icon button, `DropdownMenu`) lives in its page header and on Przegląd rows. "Dach domu" is a collapsible section of the project settings with a section drawing; a room value that differs from it is marked with a pill and a "Przywróć z projektu" link.

## Do's and Don'ts

### Do:
- **Do** use the existing `ui/` primitives and theme tokens; add new shadcn components there.
- **Do** keep 44 px targets, visible focus rings (`ring-ring/50`), and meaning beyond colour (icon + words, pattern + tint).
- **Do** keep text in drawings at 12 px or more; large drawings scroll inside their frame.

### Don't:
- **Don't** hard-code colours; use the tokens so dark mode and drawings follow.
- **Don't** pass a function component without `forwardRef` to a Radix `asChild` trigger (menus and tooltips will not position).
- **Don't** draw plates for a plan that cannot be built.
