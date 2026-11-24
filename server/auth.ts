// The only server module that knows the login provider (Clerk). The API asks for "the user id of this request" and
// nothing else; a later move to another provider replaces this file.
import { verifyToken } from '@clerk/backend';

/** Gives the id of the signed-in user of a request, or null when the session token is missing or not valid. */
export type Authenticator = (req: Request) => Promise<string | null>;

export const bearerToken = (req: Request): string | null => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1]! : null;
};

/** Verifies the Clerk session token (a JWT) with CLERK_SECRET_KEY. CLERK_AUTHORIZED_PARTIES (comma separated origins) is optional. */
export function clerkAuthenticator(env: Record<string, string | undefined>, verify: typeof verifyToken = verifyToken): Authenticator {
  const secretKey = env.CLERK_SECRET_KEY;
  const parties = (env.CLERK_AUTHORIZED_PARTIES ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return async (req) => {
    const token = bearerToken(req);
    if (!token || !secretKey) return null;
    try {
      const r = await verify(token, { secretKey, ...(parties.length ? { authorizedParties: parties } : {}) });
      const sub = (r.data as { sub?: unknown } | undefined)?.sub;
      return !r.errors && typeof sub === 'string' && sub ? sub : null;
    } catch { return null; }
  };
}

/** Test only: the token "test:<userId>" is the user <userId>. Never used by the deployed function. */
export const stubAuthenticator: Authenticator = async (req) => {
  const m = /^test:([A-Za-z0-9_-]{1,40})$/.exec(bearerToken(req) ?? '');
  return m ? m[1]! : null;
};
