# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided in docs/PLAN.md: TypeScript, pnpm workspaces (`packages/core`, `packages/render`, `packages/web`),
React + Vite, three.js via @react-three/fiber, nesting in a Web Worker, jsPDF + svg2pdf.js, static hosting,
installable PWA (offline). No backend and no login in the first versions.

## Users

Two groups, equally important:

- **DIY homeowners** cladding their own attic rooms (the owner is the first of them). They measure on site, plan at
  a desk, and often cut themselves. They need guidance on what to measure and where to start, in plain language.
- **Carpenters / fitters** doing the work for clients. They need speed, several projects, and cutting sheets they
  can hand to a helper at the saw.

Default is simple for DIY, with faster paths (keyboard, bulk settings, project duplication) for professionals.

## Product Purpose

Turn the measurements of attic rooms (sloped roof, knee walls, gable walls, flat ceilings, windows and cut-outs)
into a buildable plan for cladding them with large wooden panels: where each plate joint falls, which piece goes
where, and how to cut every piece out of as few plates as possible, with the plate count and cost.

Success: the user buys the right number of plates, every piece fits on the wall, nothing is cut twice, and waste
is visibly lower than cutting room by room.

## Positioning

Generic cut-list optimisers know rectangles; drawing tools know rooms. This product derives the pieces from the
room itself: roof-and-knee-wall boards bent at the roof line, gable strips as trapezoids, start points that anchor
the joint grid on each surface, and windows cut out of real strips. It then nests the pieces of all rooms together,
fills offcuts with the wall band, and respects the material (grain direction, face side never flipped, saw kerf,
fitting allowances).

## Operating Context

- **Desk planning** (computer): entering and correcting measurements, moving start points, comparing cut plans,
  checking cost.
- **On site measuring** (phone in the room): typing measurements as they are taken, often one-handed, in poor
  light, in dust.
- **At the saw** (printed cutting sheets, or a phone/tablet next to the saw): reading piece sizes, cutting in order,
  ticking off cut pieces.
- Projects are kept in the browser and moved between devices or people with a project file or share link.
- Measurements in centimetres; saw kerf, trim and allowances in millimetres.

## Capabilities and Constraints

- Room templates: sloped-roof attic room (presets: living room, bedroom, bathroom under the slope) and flat-ceiling
  room with wall band. Other people's houses must fit, so templates are parametric and new shapes will be needed
  (open: which ones — hip roofs, dormers, L-shaped rooms are candidates).
- Material: **solid-wood panels** (e.g. 3-layer spruce/pine), default 499 × 125 cm, with a visible face and grain
  along the length. Pieces may be rotated 180° but never flipped. Wood moves: expansion gaps at masonry.
- Start points (R) per surface, editable by number and by dragging; windows, doors and cut-outs on any surface.
- Saw kerf, edge trim, minimum usable offcut, per-edge fitting allowances; optional guillotine-only cutting.
- Shared cut across all rooms with the wall band filled from offcuts; plate count, utilisation, waste, cost.
- Printable per-plate cutting sheets (A4/A3), PDF export, workshop view on a phone.
- No login: browser storage, project file export/import, share link, works offline.
- Interface languages: **Polish and English** from the first public version; all strings in one place.
- Results must never be physically impossible (no piece larger than the plate, utilisation never over 100%).
- The original claude.ai artifact (fixtures/okladzina-domu.html) is the reference for the calculations.

## Brand Commitments

None yet: no product name, logo or voice has been decided. Working name in the repository: "slabs"; the original
artifact was called "Okładzina domu".

## Evidence on Hand

- fixtures/okladzina-domu.html: the working prototype with the owner's real house (four rooms, real dimensions).
- .impeccable/critique snapshot of that prototype (20/40), summarised in docs/PLAN.md §3.6.
- No users other than the owner yet, no testimonials, no supplier prices other than the owner's 147.6 zł/m²,
  no benchmarks. Do not invent any.

## Product Principles

1. **The numbers must be trustworthy.** A plan that cannot be built is worse than no plan; impossible results are
   blocked and explained, never drawn.
2. **The wall is the interface.** Users act on drawings of their own surfaces (drag the start line, place the
   window) rather than on abstract parameters; numbers stay available for precision.
3. **From measuring tape to saw.** Every screen serves one stage — measure, plan, cut — and works where that stage
   happens: phone on site, desk, printed sheet at the saw.
4. **Respect the material.** Grain, face side, kerf and fitting allowances are first-class, so what is cut fits
   on the first try.
5. **Guide the beginner, don't slow the professional.** Plain explanations and safe defaults, with shortcuts and
   bulk actions for people who do this every week.

## Accessibility & Inclusion

- WCAG 2.2 AA for the web app.
- Readable in poor light and on dusty phone screens on site: high contrast, large touch targets (≥ 44 px),
  one-handed number entry.
- Meaning never by colour alone (R points, rooms, bend lines, errors); cutting sheets must read when printed in
  black and white.
- Polish and English; units and number formats per locale (decimal comma in Polish).
