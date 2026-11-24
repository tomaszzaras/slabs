# Brief: Slabs landing page; projects only when signed in

Confirmed by the owner via `/impeccable shape` (2026-11-23). Replaces the "optional login" plan of
docs/briefs/login-clerk.md. Landing = Persuade mode inside the established look (DESIGN.md: shadcn/ui, Geist).
Surface roll ran degraded (no catalog, no comps), chosen structure: "Live sample wall". Build path: code-led.
Name: **Slabs**. Price: free for now ("Bezpłatnie"); no other pricing statement.

## Access
- Signed out: only the landing page. No projects, no editor, no "try without account".
- Signed in (Clerk, Google): straight to the app; projects are stored in the account (server), visible on every device.
- First sign-in: projects found in this browser or previously opened by link are offered once ("Dodaj do konta") with
  checkboxes; nothing lost or duplicated silently.
- Sharing is opt-in per project: view-only link (and edit link); the recipient must sign in; view-only opens read-only
  with a banner, export allowed. Owner-only: delete, rename, sharing settings; links can be turned off / regenerated.
- Server: every /api/projects call requires a valid Clerk session (verified in the Vercel function with
  @clerk/backend, CLERK_SECRET_KEY); records get owner, viewToken, editToken; per-user project index; old link-only
  records become claimable by the user who opens them with the edit token, then require sign-in.
- Login code stays behind packages/web/src/auth (client) and one server module (token check), so a later provider
  change touches only those.

## Landing page ("Live sample wall")
- First viewport: "Slabs" wordmark; a one-line headline (measurements → plate count and cutting plan); primary button
  "Zaloguj się przez Google" with "Bezpłatnie" next to it; language switch.
- Beside it (below on phone): a small live wall — one roof slope drawn exactly as in the app (chalk joints, start
  point R, slivers marked). The visitor drags the start point; joints move; plate count and waste update live from
  the real core engine (lightweight: no 3D, no worker needed for one surface). Caption: example wall, nothing saved.
- Below, three short sections, each with a real app drawing: (1) any number of rooms in one project, cut together;
  (2) tongue and groove, grain direction and saw kerf respected; (3) PDF cutting sheets for the saw. Final sign-in
  button at the end. Footer: language switch.
- Truth: no testimonials, user counts, ratings or prices beyond "Bezpłatnie". PL + EN. WCAG 2.2 AA. Fast first load
  (landing must not load three.js, jsPDF or the editor); good on 390 px.
- After building: Impeccable critique of the landing page (two sub-agents) and fix P0/P1 once.
