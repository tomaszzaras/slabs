/// <reference types="vite/client" />

/** true in the single-file build (SINGLEFILE=1): there is no server, saving stays in the browser */
declare const __SINGLEFILE__: boolean;
/** true only in the test build (AUTH_STUB=1 -> dist-stub): sign-in is a stub, see src/auth/index.tsx. Never set in a deployed build. */
declare const __AUTH_STUB__: boolean;

interface ImportMetaEnv {
  /** Clerk publishable key (pk_…); login is shown only when it is set at build time */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
