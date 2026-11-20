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

Sticky top bar (project, rename, new, live project total, main action, undo/redo, menu) with the room tabs below it. Room screen: surface list and floor plan | drawing and cards | inspector (dimensions, start points, settings). Under 1024 px the inspector moves below; under 768 px it is one column, the total and main action live in a fixed bottom bar. Controls are 44 px high everywhere.

## Elevation & Depth

Flat with 1 px borders; `shadow-xs` on inputs and cards, a normal popover shadow on menus. No decorative shadows.

## Shapes

Rounded rectangles (6-14 px). Drawing marks keep their own geometry (ticks, X, dashed fold, dimension lines with 45° slashes).

## Components

shadcn/ui primitives in `packages/web/src/components/ui`: Button (forwardRef, 44 px sizes), Input, Label, Checkbox (24 px box, 44 px hit area), Select, Tabs, DropdownMenu, Tooltip, Collapsible `Section`, Badge, Card, Separator, Sonner toaster. App components compose them (`TopBar`, `RoomScreen`, `SharedPage`, `ParamForm`, `SettingsPanel`, `SurfaceEditor`). Icons are lucide-react.

## Do's and Don'ts

### Do:
- **Do** use the existing `ui/` primitives and theme tokens; add new shadcn components there.
- **Do** keep 44 px targets, visible focus rings (`ring-ring/50`), and meaning beyond colour (icon + words, pattern + tint).
- **Do** keep text in drawings at 12 px or more; large drawings scroll inside their frame.

### Don't:
- **Don't** hard-code colours; use the tokens so dark mode and drawings follow.
- **Don't** pass a function component without `forwardRef` to a Radix `asChild` trigger (menus and tooltips will not position).
- **Don't** draw plates for a plan that cannot be built.
