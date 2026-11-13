import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { read, makeClient, client } = vi.hoisted(() => {
  const client = { auth: {} };
  return { read: vi.fn(), makeClient: vi.fn(() => client), client };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: makeClient }));
vi.mock('../src/auth/session-storage', () => ({ sessionStorage: { getItem: read } }));

beforeEach(() => {
  vi.resetModules();
  read.mockReset();
  makeClient.mockClear();
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
});
afterEach(() => { vi.unstubAllEnvs(); });

it('blocks SDK initialization after a storage failure and permits a subsequent retry', async () => {
  const { getSupabase } = await import('../src/auth/supabase');
  read.mockRejectedValueOnce(new Error('Keychain locked'));
  await expect(getSupabase()).rejects.toThrow('Keychain locked');
  expect(makeClient).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledWith('sb-test-auth-token');
  read.mockResolvedValue(null);
  expect(await getSupabase()).toBe(client);
  expect(makeClient).toHaveBeenCalledTimes(1);
});

it('shares concurrent preparation and reuses the initialized client', async () => {
  const { getSupabase } = await import('../src/auth/supabase');
  read.mockResolvedValue(null);
  const clients = await Promise.all([getSupabase(), getSupabase()]);
  expect(clients).toEqual([client, client]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(makeClient).toHaveBeenCalledTimes(1);
  expect(await getSupabase()).toBe(client);
  expect(read).toHaveBeenCalledTimes(1);
});
