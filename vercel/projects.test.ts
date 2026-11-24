import { describe, expect, it } from 'vitest';
import { fetchHandler } from './projects';

describe('vercel function without credentials', () => {
  it('answers 500 storage_not_configured with the API header (so the client shows a save error, not "no API")', async () => {
    const r = await fetchHandler(new Request('http://x/api/projects', { method: 'POST', body: '{}' }), { CLERK_SECRET_KEY: 'sk_test_x' });
    expect(r.status).toBe(500);
    expect(r.headers.get('x-slabs-api')).toBe('1');
    expect(await r.json()).toMatchObject({ error: 'storage_not_configured' });
  });

  it('answers 500 auth_not_configured without the Clerk secret key', async () => {
    const r = await fetchHandler(new Request('http://x/api/projects', { method: 'GET' }), { KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' });
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({ error: 'auth_not_configured' });
  });
});
