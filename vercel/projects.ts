// Source of the /api/projects Vercel Function (Build Output API v3). scripts/build-vercel.mjs bundles it with everything
// it imports (workspace packages included) into .vercel/output/functions/api/projects.func/index.mjs.
// Storage: Upstash Redis (Vercel Marketplace). Credentials come from KV_REST_API_URL/KV_REST_API_TOKEN or
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
import { handle } from '../server/projects-api';
import { MissingCredentialsError, redisFromEnv, upstashStore } from '../server/upstash-store';

let store: ReturnType<typeof upstashStore> | undefined;

export async function fetchHandler(req: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  try {
    store ??= upstashStore(redisFromEnv(env));
  } catch (e) {
    if (!(e instanceof MissingCredentialsError)) throw e;
    console.error(e.message);
    return new Response(JSON.stringify({ error: 'storage_not_configured', message: e.message }), {
      status: 500, headers: { 'x-slabs-api': '1', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  return handle(req, store);
}

// Node.js runtime, web-standard signature: Vercel calls fetch(request) on the default export.
export default { fetch: (req: Request) => fetchHandler(req) };
