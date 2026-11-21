# Brief: project overview as home, band as its own item

Owner's request (2026-11-21): "Opaska should be another item on the list next to Salon, Łazienka. Shared cut should
be project level view, kind of Home or Overview." Also: plate price and "split pieces at bends" are not band settings.
Extends the current room screen design (DESIGN.md); Operate mode.

## 1. "Przegląd" (project home)
- First navigation item, opened by default: Przegląd · <rooms…> · Opaska · + Dodaj.
- Shows: project total (plates · zł · waste · warnings); table of items (rooms and band) with pieces, net area,
  plates if cut separately, warnings — each row opens the item; the shared cut plates; PDF and CSV export.
- "Ustawienia projektu" section: plate (physical size, tongue and groove), kerf, edge trim, minimum offcut,
  allowances, guillotine-only, plate price per m², split pieces at bends. These are project-wide (one plate for
  all rooms); any per-room plate settings move here (migrate existing projects).
- The former "Wspólny rozkrój" tab is removed; its content lives here.

## 2. "Opaska" (band) as an item
- Listed with the rooms; renamable; on/off in the cut like a room.
- Its page: total length, height, min/max segment length, "Tnij opaskę ze ścinek"; a drawing of its segments
  (grain vertical); its result: cm from offcuts vs new plates.
- Price and "split at bends" are not on this page.
- Data model: band becomes an item in the project (migrate from project.shared.band); one band per project for now,
  structure ready for more later.

## 3. 3D as a view of the drawing (owner's decision, 2026-11-21)
- Remove the separate "Model 3D" card.
- The room drawing's header gets a "2D | 3D" switch (segmented control); 3D replaces the drawing in the same frame
  (same size, same position), no extra scrolling.
- The 3D options (roof and ceiling, joint grid, field numbers, start points R) become compact toggles in that
  header while 3D is shown.
- Clicking a surface in 3D selects it (same as the surface list and the drawing); the selected surface is
  highlighted in 3D.
- The choice (2D or 3D) is remembered; three.js stays lazy-loaded on first switch to 3D; keyboard orbit and the
  text summary for screen readers stay.
