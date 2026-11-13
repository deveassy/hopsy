type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Manifest = { generation: string; count: number };

// ASCII chunks stay below historical Keychain value limits, including Unicode sessions.
export function createChunkedStorage(store: Store): Store {
  let queue: Promise<unknown> = Promise.resolve();
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  }
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await store.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Manifest;
    if (!parsed || !/^[a-z0-9-]+$/.test(parsed.generation) || !Number.isInteger(parsed.count) || parsed.count < 1 || parsed.count > 10000) {
      throw new Error('Invalid secure session storage');
    }
    return parsed;
  }
  const chunkKey = (key: string, entry: Manifest, index: number) => `${key}.${entry.generation}.${index}`;
  async function clean(key: string, entry: Manifest) {
    for (let i = 0; i < entry.count; i++) await store.removeItem(chunkKey(key, entry, i));
  }
  return {
    getItem: (key) => serialized(async () => {
      const entry = await manifest(key);
      if (!entry) return null;
      let encoded = '';
      for (let i = 0; i < entry.count; i++) {
        const chunk = await store.getItem(chunkKey(key, entry, i));
        if (chunk === null) throw new Error('Incomplete secure session storage');
        encoded += chunk;
      }
      return decodeURIComponent(encoded);
    }),
    setItem: (key, value) => serialized(async () => {
      const previous = await manifest(key);
      const encoded = encodeURIComponent(value);
      const entry = { generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: Math.max(1, Math.ceil(encoded.length / 1500)) };
      try {
        for (let i = 0; i < entry.count; i++) await store.setItem(chunkKey(key, entry, i), encoded.slice(i * 1500, (i + 1) * 1500));
        // Publish only after all chunks are durable; a failed write preserves the old session.
        await store.setItem(key, JSON.stringify(entry));
      } catch (error) {
        await clean(key, entry).catch(() => {});
        throw error;
      }
      if (previous) await clean(key, previous).catch(() => {});
    }),
    removeItem: (key) => serialized(async () => {
      const previous = await manifest(key);
      await store.removeItem(key);
      if (previous) await clean(key, previous);
    }),
  };
}
