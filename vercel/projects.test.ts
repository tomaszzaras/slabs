import { describe, expect, it } from 'vitest';
import { fetchHandler } from './projects';

describe('vercel function without credentials', () => {
  it('answers 500 storage_not_configured with the API header (so the client shows a save error, not "no API")', async () => {
    const r = await fetchHandler(new Request('http://x/api/projects', { method: 'POST', body: '{}' }), {});
    expect(r.status).toBe(500);
    expect(r.headers.get('x-slabs-api')).toBe('1');
    expect(await r.json()).toMatchObject({ error: 'storage_not_configured' });
  });
});
