import { createClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { createChunkedStorage } from '../src/auth/chunked-storage';
import { restoreOrSignIn } from '../src/auth/restore-session';

it('restores the same anonymous user with a new SDK client without another signup request', async () => {
  const values = new Map<string, string>();
  const backingStore = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    access_token: 'test-access-token', refresh_token: 'test-refresh-token',
    token_type: 'bearer', expires_in: 3600,
    user: { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const makeClient = () => createClient('https://test.supabase.co', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: createChunkedStorage(backingStore), autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
  });
  const first = await restoreOrSignIn(makeClient());
  const restored = await restoreOrSignIn(makeClient());
  expect(first.user.is_anonymous).toBe(true);
  expect(restored.user.id).toBe(first.user.id);
  expect(restored.refresh_token).toBe(first.refresh_token);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain('/auth/v1/signup');
});
