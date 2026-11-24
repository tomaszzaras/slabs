// The app's only contact with the login provider (Clerk). Everything else asks this module (or auth/token.ts), so a later
// move to another provider (e.g. Supabase Auth) replaces this file and the server check, nothing else.
//
// Login is required for projects, but only when the build knows a Clerk key (VITE_CLERK_PUBLISHABLE_KEY): without it (local
// dev without keys, tests, the single-file build) there is no login and the app saves in the browser and by project link, as
// before. Tests of the signed-in flows use a build-time stub (AUTH_STUB=1 pnpm build -> dist-stub): sign-in is then one
// click, the "session" is the localStorage key slabs-stub-user and the token is "test:<user>", which only the test server
// accepts. The stub code is removed from every normal build.
import { cloneElement, useEffect, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { ClerkProvider, SignInButton, UserButton, useAuth } from '@clerk/react';
import { enUS, plPL } from '@clerk/localizations';
import { Button } from '@/components/ui/button';
import { s } from '@/i18n';
import { useLang } from '@/i18n/useLang';
import { setAuthBridge } from './token';

const publishableKey: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;
const stub = typeof __AUTH_STUB__ !== 'undefined' && __AUTH_STUB__;
const single = typeof __SINGLEFILE__ !== 'undefined' && __SINGLEFILE__;

// "Try without an account": a visitor who has not signed in can open the editor with projects kept in this browser only (exactly
// the no-login mode below). It is a per-tab choice, set before a reload so the whole app starts in that mode; signing in later
// offers the browser's projects to the account (the claim flow).
const GUEST_KEY = 'slabs-guest';
const readGuest = (): boolean => { try { return sessionStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } };
/** True in a tab that chose to try the app without an account. */
export const guest = !single && readGuest();
/** Opens the editor without an account (restarts the app in the no-login mode). */
export function enterGuest(): void { try { sessionStorage.setItem(GUEST_KEY, '1'); } catch { /* ignore */ } location.reload(); }
/** Back to the landing page, where the sign-in is. */
export function leaveGuest(): void { try { sessionStorage.removeItem(GUEST_KEY); } catch { /* ignore */ } location.replace(location.pathname); }

/** True when this build requires a sign-in. */
export const authEnabled = !single && !guest && (!!publishableKey || stub);
/** True when a sign-in exists in this build but this tab did not use it. */
export const canSignIn = !single && (!!publishableKey || stub) && guest;

export type AuthState = { status: 'off' } | { status: 'loading' } | { status: 'out' } | { status: 'in'; userId: string };

// ---- test stub --------------------------------------------------------------------------------------------------------
const STUB_KEY = 'slabs-stub-user';
const stubListeners = new Set<() => void>();
const stubUser = (): string | null => { try { return localStorage.getItem(STUB_KEY); } catch { return null; } };
const stubSubscribe = (fn: () => void) => { stubListeners.add(fn); return () => { stubListeners.delete(fn); }; };
function stubSignIn(id = 'e2e-user') { try { localStorage.setItem(STUB_KEY, id); } catch { /* ignore */ } stubListeners.forEach((f) => f()); }
function stubSignOut() { try { localStorage.removeItem(STUB_KEY); } catch { /* ignore */ } stubListeners.forEach((f) => f()); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const lang = useLang();
  if (!authEnabled || stub) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={publishableKey!}
      localization={lang === 'pl' ? plPL : enUS}
      appearance={{ variables: { colorPrimary: 'var(--primary)', borderRadius: '8px', fontFamily: 'inherit' }, elements: { userButtonAvatarBox: { width: 32, height: 32 } } }}
    >
      {children}
    </ClerkProvider>
  );
}

/** Who is signed in. Also tells auth/token.ts (render-time on purpose: the app's first request needs the token). */
export function useAuthState(): AuthState {
  if (!authEnabled) return { status: 'off' };
  if (stub) {
    const user = useSyncExternalStore(stubSubscribe, stubUser, () => null);
    setAuthBridge({ userId: user, getToken: user ? async () => `test:${user}` : null });
    return user ? { status: 'in', userId: user } : { status: 'out' };
  }
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  setAuthBridge({ userId: isSignedIn ? userId ?? null : null, getToken: isSignedIn ? () => getToken() : null });
  if (!isLoaded) return { status: 'loading' };
  return isSignedIn && userId ? { status: 'in', userId } : { status: 'out' };
}

/** Reloads the page when the user signs out, so nothing of the account stays in memory. */
export function useReloadOnSignOut(status: AuthState['status']): void {
  const was = useRef(status);
  useEffect(() => {
    if (was.current === 'in' && status === 'out') location.replace(location.pathname);
    was.current = status;
  }, [status]);
}

/** Wraps the one button that starts the sign-in (Google). Comes back to this very address afterwards, so a share link survives it. */
export function SignInTrigger({ children }: { children: ReactElement }) {
  if (stub) return cloneElement(children, { onClick: () => stubSignIn() } as object);
  return <SignInButton mode="modal" forceRedirectUrl={typeof location !== 'undefined' ? location.href : undefined}>{children}</SignInButton>;
}

/** The account button of the signed-in user. */
export function AuthControls() {
  if (canSignIn) return <Button variant="outline" data-a="guest-sign-in" onClick={leaveGuest}>{s.auth.guestSignIn}</Button>;
  if (!authEnabled) return null;
  if (stub) return <Button variant="outline" data-a="sign-out" onClick={stubSignOut}>{s.auth.signOut}</Button>;
  return <UserButton />;
}
