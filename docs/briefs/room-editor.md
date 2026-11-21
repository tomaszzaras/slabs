# Room editor — design brief

Confirmed by the owner via `/impeccable shape room editor` (2026-11-20). Product truth lives in `PRODUCT.md`;
requirements in `docs/PLAN.md` §3.3–3.6. Direction roll ran degraded (no catalog challengers, no boards);
chosen with the structured question tool. Build path: code-led (Operate surface).

## 1. Job and audience
DIY homeowners and carpenters (equally), planning at a desk or measuring on site with a phone.
Mode: **Operate** — a working tool; the world shows in type, palette, density and one signature move only;
layout, navigation and controls are standard web components.

## 2. Outcome
Done when the room's shape is drawn, every measurement is entered, start points and openings are placed, and the
project total updates live (plates, zł, waste) with no blocked pieces and no unhandled slivers.
Product-specific truth: the drawing *is* the plan the carpenter will follow — joints, waste and piece numbers look
as they will on the real boards.

## 3. Direction: "carpenter's marks" on workshop-drawing paper
- Pinned world (owner): paper and ink, dimension lines as the main visual language, colour only for meaning,
  "blueprint" dark mode.
- **Signature move:** surfaces are marked the way carpenters mark boards:
  - plate joints = snapped **chalk-line blue** lines;
  - each start point R = a **start tick with an arrow** showing the direction plates run;
  - waste = a large pencil **X** (offcuts, window/door holes, slivers under the minimum);
  - each piece = **face-side mark** (never flip) and its **number** as written on the back;
  - roof/wall bend = dashed **fold line**.
- Colour jobs: ink = edges; chalk blue = joints and start lines; red = errors and saw cuts; muted pencil tints
  with patterns = rooms; one accent = actions.
- Type: one solid UI face with tabular figures; dimension figures in a drawing-figure character but readable.
  Not Inter, not Space Grotesk. Final face chosen when DESIGN.md is documented.
- Refuses: CAD look, grey canvas with toolbars, sawmill costume (wood textures, saw/tape-measure chrome).

## 4. Scope and boundaries
- In scope: drawing the room, measurements, start points, openings, warnings, project total.
- Separate briefs: cutting sheet, shared cut view.
- Untouchable: calculations (artifact parity), cladding rules (grain, never flip, kerf, allowances), PL + EN.
- Wrong even if polished: untrustworthy numbers; X marks or chalk lines as decoration without meaning; a drawing
  that looks finished while a measurement is missing.

## 5. Layout and interaction
**Desk**
- Top bar: project, room switcher, sticky total (plates · zł · waste · warnings), "Przelicz cięcie".
- Left: small floor plan of the room plus its list of surfaces with state (missing measurement / warning / OK).
- Centre: selected surface to scale, edited directly; also where the room is drawn.
- Right: details of the selection (measurements, start point, opening, allowances).

**Drawing the room**
- Click corners to draw the floor outline, type each wall length; mark which walls carry the roof (slope angle,
  knee-wall height); the ridge follows. Walls and slopes are generated from that.
- Templates (sloped-roof room, flat-ceiling room) are a quick start that produces an editable outline.

**Measuring**
- Every measurement is a dimension line on the drawing; a missing one is dashed with "?".
- Tap it → the line highlights where to put the tape, a number field opens (large number pad on phone);
  Tab/Enter jumps to the next missing measurement.

**Phone** (owner correction: dragging allowed)
- Measurement list (missing / entered) with a thumbnail showing where each is.
- The surface drawing with pinch-zoom, where **start points and openings can be dragged** (large handles ≥ 44 px,
  drag starts after a short hold so scrolling and zooming stay easy; numbers editable in a bottom sheet).
- Drawing the room outline remains a desk task.
- Total and warnings always reachable.

**Feedback**
- Out-of-range values explained under the field in plain words.
- Slivers get a red X with their width.
- After a change the old result stays visible, dimmed, marked "Nieaktualne".
- Everything undoable.

## 6. States and ranges
- 1–15 surfaces per room, 0–6 openings per surface, 1–10 rooms per project; measurements in cm.
- States: empty project (draw the first room); room with missing measurements; complete; warnings (sliver, piece
  larger than plate); stale result; long room names; narrow phone; black-and-white print.

## 7. Constraints and open decisions
- WCAG 2.2 AA; touch targets ≥ 44 px; never colour alone (X, ticks, marks double as shapes); PL + EN, decimal comma
  in Polish.
- Free drawing needs a general room geometry (floor polygon + roof planes) in core; templates keep artifact parity.
  Planned as milestone M4b.
- Open (builder must not invent): roof shapes beyond simple slopes (hip, dormers); openings across the roof/wall fold;
  final typeface.
