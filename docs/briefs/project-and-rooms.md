# Brief: project with any rooms; one generic room definition

Owner's request (2026-11-21), in phases: (1) project with any number of rooms — slabs configured on project level,
each room covers its chosen space; (2) one unified way to define every room's dimensions, including slab direction
(horizontal / vertical) and start point; (3) how to add a new room; (4) a whole room where part of the walls is wood
and the rest e.g. ceramic tiles. Domain: docs/domain/rooms-model.md. Extends the current design (DESIGN.md), Operate
mode. Assumed (owner may correct): house roof defined once per project; floor plan = rectangle + notches for now;
direction per surface.

## Phase 1 — project organisation
- Navigation: **Przegląd** always first and fixed; then the project's rooms in the user's order; a "+ Dodaj
  pomieszczenie" button at the end. Each room tab has a menu: Zmień nazwę, Duplikuj, Przesuń w lewo/prawo,
  Wyłącz z obliczeń, Usuń (with undo toast; confirm only if the room has entered data).
- Przegląd: total plates, cost, waste, warnings; a list of rooms (name, type, wood area, pieces, warnings; click opens
  the room; drag or arrows to reorder; add button); "Ustawienia projektu": plate and cutting settings, and "Dach domu"
  (house width, ridge position, angle, knee wall) with a small section drawing.
- Empty project: Przegląd explains the flow in three steps (set plate → add a room → read the result) with the add
  button as the main action.

## Phase 2 — one room definition
- A room page has the same structure for every room: **Kształt** (floor plan + position under the roof + ceiling),
  **Powierzchnie** (derived surface list with a wood/not-wood state), **Okładzina** (per surface: zones, direction,
  start point, splits), **Wynik** (pieces, room cut).
- Floor plan editor: width × length fields + notches added from a menu (Wycięcie narożne, Wnęka, Odsunięcie ściany),
  each with its size and position fields and shown live on a small plan; position under the roof by a segmented
  choice (Cała szerokość | Od lewej ściany | Od prawej ściany) + width.
- Ceiling: segmented choice (Pod dachem domu | Płaski sufit) + flat-cap height option for "under the roof".
- Direction per surface: segmented control with drawn icons — walls: Pionowo | Poziomo; roof/ceiling: Wzdłuż spadku |
  Wzdłuż kalenicy. Start point R as today (drag + fields).
- Existing four rooms migrate to this definition exactly (same pieces at default settings; parity tests stay).

## Phase 3 — adding a room
- "+ Dodaj pomieszczenie" opens a picker of templates with small section drawings and a one-line description each:
  Pod dachem (cała szerokość), Pod skosem (od ściany), Płaski sufit, Łazienka (sufit + pas), Pas na ścianach (metry
  bieżące), and Pusty (start from width × length only). Then name → the room opens on Kształt with the first missing
  measurement focused. Duplicate any room from its menu.

## Phase 4 — wood and other finishes in one room
- In Okładzina each surface shows a strip control: Drewno | Inne (np. płytki) | Podział wysokością; with "Podział",
  a height field and which part is wood (dół / góra). The drawing shows non-wood zones hatched grey with their label
  and area; only wood zones produce pieces; the room summary shows m² of wood and m² of other finish.
- Quick actions: "Wszystkie ściany: drewno do wysokości …" for bathrooms.
- Today's Opaska migrates to a running-metres item; new bands are wall zones in rooms.

## Constraints
Calculations unchanged for migrated data; PL + EN; WCAG 2.2 AA; phone: room list, add, rename, delete, zones and
direction all usable at 390 px; cloud saving file format versioned with migration.
