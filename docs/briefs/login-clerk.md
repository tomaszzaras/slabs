# Brief: sign in with Google (Clerk), projects in the account, view/edit sharing

Owner's decision (2026-11-22): add login with Google using Clerk; keep projects in Upstash Redis (Vercel). Reverses the
earlier "no login" decision in part: login is optional — the app still works without it.

## Behaviour
- Top bar: "Zaloguj się" (Clerk, Google enabled; email as fallback if Clerk offers it by default). Signed in: avatar
  menu with name, "Moje projekty", "Wyloguj".
- Signed out: everything works as today (browser storage + secret project link). A quiet hint: "Zaloguj się, żeby mieć
  projekty na każdym urządzeniu".
- Signing in: projects in this browser and any cloud projects opened by link here are offered once to be added to the
  account ("Dodaj do konta: 3 projekty" with checkboxes); nothing is lost or duplicated silently.
- Signed in: project list = the account's projects (server), shown in the project switcher and on Przegląd's empty state;
  works on any device; offline cache + retry as today.
- Sharing per project ("Udostępnij" in the menu): a view-only link (carpenter) and an edit link; each can be turned off or
  regenerated (old link stops working). Opening a view-only link shows the project read-only (no edits, PDF/CSV export
  allowed) with a banner. Owner-only actions: delete, rename, sharing settings.
- Signing out keeps a local copy only if the user chooses it.

## Server (Vercel function, Upstash Redis)
- Verify Clerk session tokens in the function (Clerk backend SDK / JWKS, networkless verification where possible).
  Env: CLERK_SECRET_KEY (server), VITE_CLERK_PUBLISHABLE_KEY (client, build time). Never commit keys.
- Data: project record gets owner (Clerk user id), editToken, viewToken; user index set of project ids. Endpoints:
  list my projects, create, get/put by id with auth OR edit token; get with view token (read-only); claim (attach an
  existing link project to my account, requires its edit token); sharing settings (owner only).
- Existing link projects keep working via their current link (treated as edit token) until claimed.
- Netlify deployment: login disabled there (no Clerk keys) — app runs in today's link mode; both builds stay green.

## Quality
- Tests: token verification mocked, ownership/edit/view rules, claim, link regeneration, migration of existing records,
  e2e of signed-out flow unchanged and of read-only view; no secrets in repo; PL + EN strings; WCAG 2.2 AA.
- Update PRODUCT.md (Capabilities and Constraints: optional Google login via Clerk), docs/STATUS.md with the owner's
  setup steps.
