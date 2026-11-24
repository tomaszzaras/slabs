# Header redesign

The squeezed single-row top bar is now two rows by job (`packages/web/src/components/TopBar.tsx`; the layout is described in `DESIGN.md`, section Layout):

* **Row 1, identity and account:** brand, project switcher (rename and new beside it from 768 px), a quiet save state, undo/redo as one joined pair, the menu, and the account avatar after a hairline.
* **Row 2, the work:** the project's pages as underline tabs (soft fade at the scroll edge), the add-room button pinned beside them (icon-only under 1280 px), the project total as a flat readout, and the calculate button.
* **Save state:** text with an icon from 768 px; on a phone a colour dot inside the project switcher. Only the error/offline state is loud (a retry button, full width on a phone). It is a plain element, not a disabled button, unless it is the retry action.
* The header is opaque, so page content no longer shows through it.
* Every id and class the e2e tests use is kept (`#undo`, `#redo`, `#calc`, `.total`, `.calcstate`, `.syncst`, `[data-sync]`, `.totalbar`, tab ids). The fresh "aktualne" label is screen-reader-only; it is shown only while stale or calculating.

Checks run before publishing: lint, typecheck and all five e2e suites (smoke, rooms, spec, auth, landing) pass.

Not done: the screenshots in `docs/screenshots` still show the old header, and the real Clerk avatar (needs a live key) was not seen in the new header; it is sized to 32 px in `auth/index.tsx`.
