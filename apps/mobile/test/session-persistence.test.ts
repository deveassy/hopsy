import { createClient } from '@supabase/supabase-js';
import { beforeEach, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';

import { sessionStorage } from '../src/auth/session-storage';
import { restoreOrSignIn } from '../src/auth/restore-session';

vi.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
    getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: vi.fn(async (key: string) => { values.delete(key); }),
  };
});

beforeEach(async () => { await SecureStore.deleteItemAsync('sb-test-auth-token'); });

it.each(['{}', 'broken-json', '{"generation":"old","count":1}'])('handles cold-start corruption %s without an unhandled rejection or signup', async (raw) => {
  await sessionStorage.setItem('sb-test-auth-token', raw);
  const fetch = vi.fn();
  const client = createClient('https://test.supabase.co', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
  });
  await expect(restoreOrSignIn(client)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect(await SecureStore.getItemAsync('sb-test-auth-token')).toBe(raw);
  // Flush the SDK's independently scheduled INITIAL_SESSION notification.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

it('does not create a replacement user when a subsequent SDK session read finds corrupt storage', async () => {
  const fetch = vi.fn();
  const client = createClient('https://test.supabase.co', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
  });
  await client.auth.getSession();
  await sessionStorage.setItem('sb-test-auth-token', '{}');
  await expect(restoreOrSignIn(client)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect(await SecureStore.getItemAsync('sb-test-auth-token')).toBe('{}');
});

it('restores the same anonymous user with a new SDK client without another signup request', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    access_token: 'test-access-token', refresh_token: 'test-refresh-token',
    token_type: 'bearer', expires_in: 3600,
    user: { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const makeClient = () => createClient('https://test.supabase.co', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
  });
  const first = await restoreOrSignIn(makeClient());
  const restored = await restoreOrSignIn(makeClient());
  expect(first.user.is_anonymous).toBe(true);
  expect(restored.user.id).toBe(first.user.id);
  expect(restored.refresh_token).toBe(first.refresh_token);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain('/auth/v1/signup');
});
