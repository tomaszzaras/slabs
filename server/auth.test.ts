import { describe, expect, it, vi } from 'vitest';
import { clerkAuthenticator, stubAuthenticator } from './auth';

const req = (authorization?: string) => new Request('http://x/api/projects', { headers: authorization ? { authorization } : {} });

describe('clerkAuthenticator (verification mocked)', () => {
  it('returns the user id of a valid token and passes the secret key', async () => {
    const verify = vi.fn(async () => ({ data: { sub: 'user_1' }, errors: undefined }));
    const a = clerkAuthenticator({ CLERK_SECRET_KEY: 'sk_test_x' }, verify as never);
    expect(await a(req('Bearer abc.def.ghi'))).toBe('user_1');
    expect(verify).toHaveBeenCalledWith('abc.def.ghi', { secretKey: 'sk_test_x' });
  });
  it('passes authorized parties when configured', async () => {
    const verify = vi.fn(async () => ({ data: { sub: 'u' }, errors: undefined }));
    await clerkAuthenticator({ CLERK_SECRET_KEY: 'k', CLERK_AUTHORIZED_PARTIES: 'https://a.app, https://b.app' }, verify as never)(req('Bearer t'));
    expect(verify).toHaveBeenCalledWith('t', { secretKey: 'k', authorizedParties: ['https://a.app', 'https://b.app'] });
  });
  it('rejects a missing header, a non-bearer header, an invalid token, a thrown error and a missing secret', async () => {
    const bad = vi.fn(async () => ({ data: undefined, errors: [new Error('invalid')] }));
    const a = clerkAuthenticator({ CLERK_SECRET_KEY: 'k' }, bad as never);
    expect(await a(req())).toBeNull();
    expect(await a(req('Basic abc'))).toBeNull();
    expect(await a(req('Bearer nope'))).toBeNull();
    const boom = vi.fn(async () => { throw new Error('network'); });
    expect(await clerkAuthenticator({ CLERK_SECRET_KEY: 'k' }, boom as never)(req('Bearer t'))).toBeNull();
    const ok = vi.fn(async () => ({ data: { sub: 'u' }, errors: undefined }));
    expect(await clerkAuthenticator({}, ok as never)(req('Bearer t'))).toBeNull();
    expect(ok).not.toHaveBeenCalled();
  });
  it('a token without subject is not a user', async () => {
    const verify = vi.fn(async () => ({ data: {}, errors: undefined }));
    expect(await clerkAuthenticator({ CLERK_SECRET_KEY: 'k' }, verify as never)(req('Bearer t'))).toBeNull();
  });
});

describe('stubAuthenticator (tests only)', () => {
  it('maps test:<id> to that user and nothing else', async () => {
    expect(await stubAuthenticator(req('Bearer test:alice'))).toBe('alice');
    expect(await stubAuthenticator(req('Bearer alice'))).toBeNull();
    expect(await stubAuthenticator(req())).toBeNull();
  });
});
