import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { restoreOrSignIn } from '../src/auth/restore-session';

function setup(session: Session | null = null) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'anonymous-id' } } }, error: null }),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
}

describe('session bootstrap', () => {
  it('restores an existing session without creating a user', async () => {
    const session = { user: { id: 'existing-id' } } as Session;
    const { client, auth } = setup(session);
    expect(await restoreOrSignIn(client)).toBe(session);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in once when there is no stored session', async () => {
    const { client, auth } = setup();
    expect((await restoreOrSignIn(client)).user.id).toBe('anonymous-id');
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('shares concurrent startup and retry calls', async () => {
    const { client, auth } = setup();
    const sessions = await Promise.all([restoreOrSignIn(client), restoreOrSignIn(client), restoreOrSignIn(client)]);
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(sessions[0]).toBe(sessions[1]);
  });

  it('does not create a new identity when restoring fails', async () => {
    const { client, auth } = setup();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('offline or storage failure') });
    await expect(restoreOrSignIn(client)).rejects.toThrow();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('allows retry after an error and restores the saved identity', async () => {
    const { client, auth } = setup();
    auth.getSession.mockRejectedValueOnce(new Error('storage locked'));
    await expect(restoreOrSignIn(client)).rejects.toThrow();
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'saved-id' } } }, error: null });
    expect((await restoreOrSignIn(client)).user.id).toBe('saved-id');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('surfaces anonymous sign-in failures', async () => {
    const { client, auth } = setup();
    auth.signInAnonymously.mockResolvedValue({ data: { session: null }, error: new Error('Anonymous sign-in disabled') });
    await expect(restoreOrSignIn(client)).rejects.toThrow('Anonymous sign-in disabled');
  });

  it('rejects a successful response without a session', async () => {
    const { client, auth } = setup();
    auth.signInAnonymously.mockResolvedValue({ data: { session: null }, error: null });
    await expect(restoreOrSignIn(client)).rejects.toThrow('No session');
  });
});
