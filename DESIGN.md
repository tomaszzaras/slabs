---
name: Slabs
description: Cladding plans drawn the way a carpenter marks boards, on workshop-drawing paper.
colors:
  drafting-paper: "#f3efe4"
  drawing-sheet: "#faf8f1"
  raised-sheet: "#fffdf7"
  blue-black-ink: "#1b2129"
  graphite-muted: "#4f5a66"
  pencil-line: "#cbc3b1"
  chalk-line-blue: "#2c64b8"
  saw-cut-red: "#b3261e"
  action-ink-blue: "#1c4a86"
  go-green: "#2f6a3b"
  tint-living-room: "#e6cfa6"
  tint-bedroom: "#c6d9b6"
  tint-bathroom-1: "#b6cfe6"
  tint-bathroom-2: "#e9c3d3"
  tint-band: "#f1e3a4"
  blueprint-paper: "#0d2646"
  blueprint-sheet: "#123058"
  blueprint-ink: "#e9f0fa"
  blueprint-chalk: "#9cc6ff"
  blueprint-red: "#ff9a90"
typography:
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.62rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0"
  heading:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.14rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  drawing-figure:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    fontFeature: "\"tnum\" 1"
  piece-number:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
rounded:
  sm: "3px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-default:
    backgroundColor: "{colors.raised-sheet}"
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.action-ink-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  tab-selected:
    backgroundColor: "{colors.blue-black-ink}"
    textColor: "{colors.drafting-paper}"
    rounded: "{rounded.md}"
    height: "44px"
  field:
    backgroundColor: "{colors.raised-sheet}"
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.md}"
    height: "44px"
  surface-chip:
    textColor: "{colors.blue-black-ink}"
    rounded: "{rounded.sm}"
---

# Design System: Slabs

## Overview

**Creative North Star: "The Carpenter's Marks"**

Slabs is a working drawing, not a dashboard. The page is drafting paper, the lines are ink, and the plan is marked the way a carpenter marks boards before sawing: chalk lines for plate joints, a start tick with an arrow for each start point, a pencil X through waste, a circled dot for the face side, a dashed fold where a board bends. Dimension lines with ticks are the main visual language; there is no decoration that does not also carry a measurement or a mark.

The interface itself is a standard Operate surface (top bar, left list, centre drawing, right inspector) in a quiet voice: one family of type with tabular figures, thin ink rules instead of cards, no shadows at rest. Colour is only ever meaning: ink for edges and text, chalk blue for joints, start lines and selection, red for errors and saw cuts, muted pencil tints plus a pattern for rooms. At night the same tokens turn into a blueprint: light lines on deep blue.

It refuses the CAD look (grey canvas, toolbar chrome), the sawmill costume (wood grain, saw and tape-measure icons), same-size cards of metrics, and anything that looks finished while a measurement is missing.

**Key Characteristics:**
- Paper-and-ink palette; colour only for meaning, never for decoration
- Marks that are also controls' vocabulary: chalk, tick-and-arrow, pencil X, face dot, fold line
- Tabular figures everywhere numbers are compared
- Dense but never cramped: 44 px touch targets, 1 px rules, generous gaps between groups
- Every state is explained in words next to the mark that shows it

## Colors

A warm paper ground with blue-black ink, one chalk blue and one red; everything else is a muted pencil tint.

### Primary
- **Chalk-Line Blue** (#2c64b8): plate joints, start lines, selection outline, focus ring. The only colour that says "this is the plan".
- **Action Ink Blue** (#1c4a86): filled primary buttons only. Close to chalk blue in hue on purpose, so actions and plan share one family.

### Secondary
- **Saw-Cut Red** (#b3261e): errors, fold/bend lines, warnings and the word "stale". Never a room colour.

### Tertiary
- **Go Green** (#2f6a3b): reserved for a confirmed OK state when a status needs more than a check mark.

### Neutral
- **Drafting Paper** (#f3efe4): page ground.
- **Drawing Sheet** (#faf8f1) and **Raised Sheet** (#fffdf7): panels and the surface drawing itself.
- **Blue-Black Ink** (#1b2129): text, edges, selected tab and list row.
- **Graphite Muted** (#4f5a66): secondary text and dimension lines (4.5:1 on paper).
- **Pencil Line** (#cbc3b1): rules and dividers.
- Room tints (living room #e6cfa6, bedroom #c6d9b6, bathroom 1 #b6cfe6, bathroom 2 #e9c3d3, band #f1e3a4) always come with a pattern (diagonal, dots, reverse diagonal, grid, dashes) so rooms differ in black and white.
- Blueprint dark mode: paper #0d2646, sheet #123058, ink #e9f0fa, chalk #9cc6ff, red #ff9a90.

### Named Rules
**The Colour-Is-Meaning Rule.** A colour that does not answer "what is this?" is removed. Chalk blue = joint or start line, red = error or cut, tint + pattern = room, ink = everything else.

**The Not-By-Colour-Alone Rule.** Every colour has a second carrier: a shape, a pattern, a word or a mark (X, tick, dot, dashed line).

## Typography

**Display / Body / Label Font:** Barlow (system-ui fallback), self-hosted, latin and latin-ext.

**Character:** A DIN-style engineering sans: narrow enough for dense dimension figures, plain enough for long labels, with real tabular figures (`tnum`) and full Polish diacritics. One family carries headings, buttons, labels and drawing figures.

### Hierarchy
- **Title** (600, 1.62rem, 1.15): the room name, one per view.
- **Heading** (600, 1.14rem): section heads, ruled with a 1 px ink line, not decorated.
- **Body** (400, 15px, 1.45): labels, descriptions; prose capped at 66ch.
- **Label** (500, 13px): units, hints, state text beside marks.
- **Drawing figure** (500, 12px, tabular): every dimension in the drawing; never below 12 px on screen.
- **Piece number** (700, 18px): the field number written on each board.

### Named Rules
**The Tabular Rule.** Numbers that are compared sit in tabular figures (`font-variant-numeric: tabular-nums`) so columns of lengths line up.

**The 12-Pixel Floor.** Text in drawings is drawn at 1 unit = 1 px and is never smaller than 12 px; a larger drawing scrolls inside its frame instead of shrinking its text.

## Layout

Desk: a sticky top bar, then three columns (290 px list and floor plan, fluid drawing, 360 px inspector) up to a 1760 px container. Under 1180 px the inspector drops below; under 760 px everything is one column, the room switcher scrolls sideways, and the project total plus the main action live in a fixed bottom bar (thumb reach, always visible). Spacing runs on a 4/8/16/24 rhythm: tight inside a group, 18 px between sections. Drawings fit the available width down to 0.3 px per cm, then scroll inside their frame with a visible hint.

## Elevation & Depth

Flat by default. Depth comes from 1 px ink rules and paper-versus-sheet tone, not from shadows. The only shadows are the open menu and the undo toast (offset 4–6 px with a soft blur), because they float above the sheet.

### Named Rules
**The Flat-On-Paper Rule.** Nothing at rest casts a shadow. A thing that floats (menu, toast) is the only thing that does.

## Shapes

Square-ish and drafted: 3–4 px corners, 1 px ink borders on controls, no pills, no circles except the face-side dot and start dots. Drawn marks keep their own geometry: straight ticks, 45° dimension slashes, an X, a dashed fold.

## Components

### Buttons
- **Shape:** 4 px corners, 1 px ink border, 44 px minimum height and width.
- **Primary:** Action Ink Blue fill, white text, weight 600; one per bar or section ("Przelicz cięcie").
- **Hover / Focus:** hover lightens a primary and tints a default to paper; focus is a 3 px chalk-blue outline with 2 px offset. Selected tabs and list rows invert to ink on paper.
- **Icon buttons:** drawn SVG icons (one 1.8 px stroke), always with an accessible name.

### Inputs / Fields
- **Style:** raised sheet, 1 px ink border, 44 px high, tabular figures, unit beside the field.
- **Error:** red border plus a 2 px red ring and a sentence under the field naming the field and its limit; the value is corrected on blur.

### Navigation
- **Room switcher:** tabs in the top bar; the selected tab is ink on paper with a chalk-blue underline. The surface list on the left uses the same inversion for the selected row; each row has an R chip, a name and a state in words.

### Surface drawing (signature)
The selected surface at true scale: room-patterned fill, ink outline, chalk-blue joints (start line heavier), start tick and arrow at the R point inside a labelled box, field numbers with a circled face dot, dimension lines with ticks, red dashed fold, dotted chalk split line where a strip is taller than a plate, pencil X over windows, cut-outs and slivers with their width in red.

### Toast
Ink pill at the bottom, one sentence and an undo button; polite live region.

## Do's and Don'ts

### Do:
- **Do** mark every measured thing with a dimension line and its figure; a missing measurement is dashed with "?".
- **Do** give every colour a second carrier (pattern, shape, word).
- **Do** keep text in drawings at 12 px or more and let big drawings scroll in their frame.
- **Do** keep controls at 44 px or more, including on desk.
- **Do** show a stale result dimmed with "Nieaktualne – przelicz" instead of blanking it.

### Don't:
- **Don't** use grey CAD canvases, toolbar chrome, wood textures, or saw and tape-measure icons.
- **Don't** put a card around every block or build a row of same-size metric tiles.
- **Don't** use text glyphs for icons; draw them.
- **Don't** use red for room names, and never let a chalk line or X stand as decoration without meaning.
- **Don't** draw plates for a plan that cannot be built; show the blocking message instead.
