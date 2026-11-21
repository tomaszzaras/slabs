// Source of the /api/projects Netlify Function. It is bundled into one self-contained file by
// scripts/build-functions.mjs (netlify/functions/projects.mjs, generated at build time), because Netlify's own
// bundler leaves workspace packages such as @slabs/core out of the function. Route config is added by that script.
import { getStore } from '@netlify/blobs';
import { handle } from '../lib/projects-api';

export default async (req: Request): Promise<Response> => {
  // Also accept the direct function URL, in case the request arrives through a rewrite.
  const url = new URL(req.url);
  if (url.pathname.startsWith('/.netlify/functions/projects')) {
    url.pathname = url.pathname.replace('/.netlify/functions/projects', '/api/projects');
    req = new Request(url, req);
  }
  return handle(req, getStore({ name: 'projects', consistency: 'strong' }) as never);
};
