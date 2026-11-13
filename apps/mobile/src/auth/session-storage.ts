import * as SecureStore from 'expo-secure-store';

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function validateSession(key: string, raw: string) {
  // Do not let the SDK discard damaged auth storage and create a replacement identity.
  if (!key.endsWith('-auth-token')) return;
  const session = JSON.parse(raw);
  if (!session || typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string' || typeof session.expires_at !== 'number') {
    throw new Error('Invalid stored session');
  }
}

export const sessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const raw = await SecureStore.getItemAsync(key);
    if (raw === null) return null;
    let legacy;
    try { legacy = JSON.parse(raw); } catch { /* Non-session keys can contain plain strings. */ }
    if (legacy && typeof legacy === 'object' && ('generation' in legacy || 'count' in legacy)) {
      // Read-only compatibility with PR #6's old format. All new writes are direct.
      if (typeof legacy.generation !== 'string' || !/^[a-z0-9-]+$/.test(legacy.generation) || !Number.isInteger(legacy.count) || legacy.count < 1 || legacy.count > 10000) {
        throw new Error('Invalid legacy session');
      }
      let encoded = '';
      const keys: string[] = [];
      for (let index = 0; index < legacy.count; index++) {
        const chunkKey = `${key}.${legacy.generation}.${index}`;
        const chunk = await SecureStore.getItemAsync(chunkKey);
        if (chunk === null) throw new Error('Incomplete legacy session');
        keys.push(chunkKey);
        encoded += chunk;
      }
      const session = decodeURIComponent(encoded);
      validateSession(key, session);
      // Keep the manifest/chunks intact if the platform rejects the direct write.
      await SecureStore.setItemAsync(key, session, options);
      for (const chunkKey of keys) await SecureStore.deleteItemAsync(chunkKey).catch(() => {});
      return session;
    }
    validateSession(key, raw);
    return raw;
  },
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
