# Brief: collapsible measurement panel, generic names, tongue and groove

Confirmed by the owner via `/impeccable shape` (2026-11-20). Extends the current room screen in its established
look (shadcn/ui + Tailwind, DESIGN.md); no new visual world. Mode: Operate.

## 1. Collapsible measurement panel
- Closed by default: a ~56 px rail on the right with labelled icons **Wymiary**, **Punkty startu**, **Otwory**,
  **Płyty**; the drawing gets the width.
- Clicking opens that section as a ~380 px panel over the drawing (overlay, not pushing). On ≥ 1440 px it can be
  pinned open. Open/pinned state remembered.
- Follows the selection: selecting a surface or tapping a dimension/opening on the drawing opens the panel at the
  matching fields with that field highlighted. Single quick edits stay in the popup on the drawing.
- Each group shows completeness ("Bryła 5/5", "Wycięcia 3/4 ⚠"); a missing measurement jumps to its field.
- Phone: the same sections as a bottom sheet (shadcn Sheet/Drawer).
- Esc closes and returns focus; a keyboard shortcut toggles the panel.
- Left column slims: floor plan as a small thumbnail, surface list stays.

## 2. Generic names, everything renamable
- Templates by shape: "Pomieszczenie pod skosem", "Pomieszczenie z płaskim sufitem". New rooms: "Pomieszczenie 1, 2…";
  rename in place (tab double-click or pencil).
- Surfaces by position: "Połać lewa", "Ściana kolankowa prawa", "Szczyt przedni", "Szczyt tylny"; coordinates only
  as small secondary detail.
- Features: "Wpust" → **"Wnęka"** (avoids clashing with *wpust* in tongue and groove), "Zabudowa" → "Wycięcie
  narożne", "Wnęka na zasłony" → "Odsunięcie ściany". Every room, surface and feature can be renamed (custom name
  stored in the project; generic name stays as fallback; PL + EN).
- The owner's house becomes an example project "Przykład: dom z poddaszem" with the owner's names (Salon,
  Sypialnia, Łazienka 1, Łazienka 2) as custom names. New projects start generic.

## 3. Tongue and groove (pióro-wpust)
- Plate settings: physical size 500 × 125 cm, tongue 1 cm, profile on all four edges (options: long edges only,
  none); covering size derived: 499 × 124 cm.
- Joint grid on surfaces uses the **covering** width (124) and length (499).
- Piece edges are typed: long joint (needs tongue or groove), end joint (where a strip is longer than a plate;
  tongue or groove), wall / fold / opening edge (plain cut). On each surface all strips have the tongue toward the
  arrow at start point R, groove on the other side.
- Nesting: an edge needing a tongue must lie on the plate's tongue edge, one needing a groove on the plate's groove
  edge; only 0°/180° rotation (face never flipped; rotation swaps which side carries the tongue). A piece occupies
  its covering size plus 1 cm for each tongue it keeps. Narrow first/last strips must lie along a plate edge with
  the right profile; the summary shows the plate count difference vs tongue-and-groove off.
- Cutting sheets mark each piece edge: **P** (pióro), **W** (wpust), plain = cut.
- Tongue-and-groove off ("Jak w pierwowzorze") keeps exact artifact parity.
- Out of scope: special corner/edge trim; at wall corners the profile is simply cut off.
