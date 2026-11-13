import { describe, expect, it, vi } from 'vitest';

import { createChunkedStorage } from '../src/auth/chunked-storage';

function setup() {
  const values = new Map<string, string>();
  const store = {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { values.delete(key); }),
  };
  return { values, store, storage: createChunkedStorage(store) };
}

describe('secure session storage', () => {
  it('restores a large Unicode session across adapter instances', async () => {
    const { store, storage } = setup();
    const session = JSON.stringify({ refresh_token: 'a'.repeat(5000), name: '🍻한글'.repeat(500) });
    await storage.setItem('session', session);
    expect(await createChunkedStorage(store).getItem('session')).toBe(session);
    for (const [, value] of store.setItem.mock.calls) expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(1500);
  });

  it('replaces and removes all referenced session chunks', async () => {
    const { values, storage } = setup();
    expect(await storage.getItem('session')).toBeNull();
    await storage.setItem('session', 'a'.repeat(5000));
    await storage.setItem('session', 'new');
    expect(values.size).toBe(2);
    expect(await storage.getItem('session')).toBe('new');
    await storage.removeItem('session');
    expect(values.size).toBe(0);
  });

  it('preserves the previous session on a failed update', async () => {
    const { store, storage } = setup();
    await storage.setItem('session', 'previous');
    store.setItem.mockRejectedValueOnce(new Error('Keychain locked'));
    await expect(storage.setItem('session', 'next')).rejects.toThrow();
    expect(await storage.getItem('session')).toBe('previous');
  });

  it('serializes concurrent reads and writes', async () => {
    const { storage } = setup();
    const results = await Promise.all([storage.setItem('session', 'first'), storage.getItem('session'), storage.setItem('session', 'second')]);
    expect(results[1]).toBe('first');
    expect(await storage.getItem('session')).toBe('second');
  });

  it('rejects missing chunks instead of treating corruption as no session', async () => {
    const { values, storage } = setup();
    await storage.setItem('session', 'secret');
    for (const key of values.keys()) if (key !== 'session') values.delete(key);
    await expect(storage.getItem('session')).rejects.toThrow('Incomplete');
  });

  it('propagates storage read failures', async () => {
    const { store, storage } = setup();
    store.getItem.mockRejectedValueOnce(new Error('Keychain unavailable'));
    await expect(storage.getItem('session')).rejects.toThrow('Keychain unavailable');
  });
});
