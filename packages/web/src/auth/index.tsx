// The app's only contact with the login provider (Clerk). Everything else asks this module, so a later move to
// another provider (e.g. Supabase Auth) replaces this file and the server check, nothing else.
// Login is optional: without VITE_CLERK_PUBLISHABLE_KEY at build time (local dev without keys, the single-file
// build) the app runs exactly as before, saving in the browser and by project link.
import type { ReactNode } from 'react';
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react';
import { enUS, plPL } from '@clerk/localizations';
import { Button } from '@/components/ui/button';
import { s } from '@/i18n';
import { useStore } from '@/state/store';

const publishableKey: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;

/** True when this build can sign users in. */
export const authEnabled = !__SINGLEFILE__ && !!publishableKey;

export function AuthProvider({ children }: { children: ReactNode }) {
  const lang = useStore((st) => st.lang);
  if (!authEnabled) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={publishableKey!}
      localization={lang === 'pl' ? plPL : enUS}
      appearance={{ variables: { colorPrimary: 'var(--primary)', borderRadius: '8px', fontFamily: 'inherit' } }}
    >
      {children}
    </ClerkProvider>
  );
}

/** Sign in / sign up when signed out, the account button when signed in. Nothing when login is not configured. */
export function AuthControls() {
  if (!authEnabled) return null;
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal"><Button variant="outline" data-a="sign-in">{s.auth.signIn}</Button></SignInButton>
        <SignUpButton mode="modal"><Button variant="ghost" className="max-md:hidden" data-a="sign-up">{s.auth.signUp}</Button></SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}

/** Returns a function that gives the current session token for the API (null when signed out or login is off). */
export function useAuthToken(): () => Promise<string | null> {
  if (!authEnabled) return async () => null;
  const { getToken, isSignedIn } = useAuth();
  return async () => (isSignedIn ? await getToken() : null);
}
