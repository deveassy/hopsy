import { afterEach, expect, it, vi } from 'vitest';
import { createTokenVerifier } from '../src/lib/supabase-auth.js';

afterEach(() => { vi.unstubAllGlobals(); });
const id = '11111111-1111-4111-8111-111111111111';

it('verifies the supplied token with the configured Supabase Auth server', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id, role: 'authenticated', is_anonymous: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  const verify = createTokenVerifier('https://project.supabase.co', 'publishable-key');
  expect(await verify('anonymous-access-token')).toEqual({ id });
  expect(fetch.mock.calls[0]![0]).toBe('https://project.supabase.co/auth/v1/user');
  const headers = fetch.mock.calls[0]![1].headers;
  expect(headers.Authorization).toBe('Bearer anonymous-access-token');
  expect(headers.apikey).toBe('publishable-key');
});

it.each([400, 401, 403])('rejects tokens rejected by Supabase (%s)', async (status) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'invalid JWT' }), { status })));
  expect(await createTokenVerifier('https://project.supabase.co', 'key')('invalid')).toBeNull();
});

it('fails closed without exposing upstream details when Auth is rate limited', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'sensitive upstream details' }), { status: 429 })));
  await expect(createTokenVerifier('https://project.supabase.co', 'key')('token')).rejects.toThrow('Authentication service unavailable');
});

it.each([{ id, role: 'anon' }, { id: 'invalid', role: 'authenticated' }])('rejects a response without a valid authenticated user: %j', async (user) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(user), { status: 200 })));
  expect(await createTokenVerifier('https://project.supabase.co', 'key')('token')).toBeNull();
});
