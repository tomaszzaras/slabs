// Source of the /api/projects Vercel Function (Build Output API v3). scripts/build-vercel.mjs bundles it with everything
// it imports (workspace packages included) into .vercel/output/functions/api/projects.func/index.mjs.
// Storage: Upstash Redis (Vercel Marketplace). Credentials come from KV_REST_API_URL/KV_REST_API_TOKEN or
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN. Login: CLERK_SECRET_KEY (server/auth.ts).
import { handle } from '../server/projects-api';
import { clerkAuthenticator, type Authenticator } from '../server/auth';
import { MissingCredentialsError, redisFromEnv, upstashStore } from '../server/upstash-store';

let store: ReturnType<typeof upstashStore> | undefined;
let authn: Authenticator | undefined;

const fail = (error: string, message: string) => new Response(JSON.stringify({ error, message }), {
  status: 500, headers: { 'x-slabs-api': '1', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function fetchHandler(req: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  if (!env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY missing');
    return fail('auth_not_configured', 'CLERK_SECRET_KEY is not set in the Vercel project environment.');
  }
  try {
    store ??= upstashStore(redisFromEnv(env));
  } catch (e) {
    if (!(e instanceof MissingCredentialsError)) throw e;
    console.error(e.message);
    return fail('storage_not_configured', e.message);
  }
  authn ??= clerkAuthenticator(env);
  return handle(req, store, authn);
}

// Node.js runtime, web-standard signature: Vercel calls fetch(request) on the default export.
export default { fetch: (req: Request) => fetchHandler(req) };
