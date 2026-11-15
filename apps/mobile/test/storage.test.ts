import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';

import { sessionStorage } from '../src/auth/session-storage';

const values = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { values.delete(key); }),
}));

const key = 'sb-test-auth-token';
const session = JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: 9999999999, user: { id: 'same-user' } });
function seedLegacy() {
  const encoded = encodeURIComponent(session);
  values.set(key, JSON.stringify({ generation: 'old-123', count: 2 }));
  values.set(`${key}.old-123.0`, encoded.slice(0, 40));
  values.set(`${key}.old-123.1`, encoded.slice(40));
}

beforeEach(() => { values.clear(); vi.clearAllMocks(); });

describe('direct SecureStore adapter', () => {
  it('writes the complete session to one native key with device-only accessibility', async () => {
    await sessionStorage.setItem(key, session);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, session, { keychainAccessible: 'device-only' });
    expect(values.size).toBe(1);
    expect(await sessionStorage.getItem(key)).toBe(session);
    await sessionStorage.removeItem(key);
    expect(await sessionStorage.getItem(key)).toBeNull();
  });

  it('passes full Unicode values through without splitting or imposing a synthetic size limit', async () => {
    const raw = JSON.stringify({ ...JSON.parse(session), name: '🍻한글'.repeat(1000) });
    await sessionStorage.setItem(key, raw);
    expect(values.size).toBe(1);
    expect(await sessionStorage.getItem(key)).toBe(raw);
  });

  it('supports non-session SDK keys containing plain strings', async () => {
    await sessionStorage.setItem('code-verifier', 'plain-string');
    expect(await sessionStorage.getItem('code-verifier')).toBe('plain-string');
  });

  it('migrates legacy chunks once while preserving the user and token values', async () => {
    seedLegacy();
    expect(await sessionStorage.getItem(key)).toBe(session);
    expect(values.get(key)).toBe(session);
    expect(values.size).toBe(1);
    vi.clearAllMocks();
    expect(await sessionStorage.getItem(key)).toBe(session);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('keeps legacy data intact when a native migration write fails', async () => {
    seedLegacy();
    const before = new Map(values);
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Native capacity failure'));
    await expect(sessionStorage.getItem(key)).rejects.toThrow('Native capacity failure');
    expect(values).toEqual(before);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('rejects incomplete legacy data without deleting it or returning no session', async () => {
    seedLegacy();
    values.delete(`${key}.old-123.1`);
    await expect(sessionStorage.getItem(key)).rejects.toThrow('Incomplete legacy session');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it.each(['broken-json', '{}', '{"generation":"old-123","count":-1}'])('rejects corrupt auth storage: %s', async (raw) => {
    values.set(key, raw);
    await expect(sessionStorage.getItem(key)).rejects.toThrow();
    expect(values.get(key)).toBe(raw);
  });

  it('surfaces read failures instead of reporting an absent session', async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Keychain unavailable'));
    await expect(sessionStorage.getItem(key)).rejects.toThrow('Keychain unavailable');
  });

  it('surfaces native write and delete errors', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Write rejected'));
    await expect(sessionStorage.setItem(key, session)).rejects.toThrow('Write rejected');
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('Delete rejected'));
    await expect(sessionStorage.removeItem(key)).rejects.toThrow('Delete rejected');
  });
});
