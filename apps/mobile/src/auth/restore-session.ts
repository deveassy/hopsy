import type { Session, SupabaseClient } from '@supabase/supabase-js';

// Share work across simultaneous mounts/retries (including React Strict Mode).
const pending = new WeakMap<SupabaseClient, Promise<Session>>();
export function restoreOrSignIn(client: SupabaseClient): Promise<Session> {
  const existing = pending.get(client);
  if (existing) return existing;
  const task = (async () => {
    const restored = await client.auth.getSession();
    if (restored.error) throw restored.error;
    if (restored.data.session) return restored.data.session;
    const signedIn = await client.auth.signInAnonymously();
    if (signedIn.error) throw signedIn.error;
    if (!signedIn.data.session) throw new Error('No session returned');
    return signedIn.data.session;
  })();
  pending.set(client, task);
  void task.finally(() => { pending.delete(client); }).catch(() => {});
  return task;
}
