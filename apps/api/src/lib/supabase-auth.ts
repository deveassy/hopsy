import { createClient } from '@supabase/supabase-js';

export type VerifyToken = (token: string) => Promise<{ id: string } | null>;

export function createTokenVerifier(url: string, publishableKey: string): VerifyToken {
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return async (token) => {
    // getUser verifies with this project's Auth server, including legacy HS256 JWTs.
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      if (error.status === 401 || error.status === 403 || error.status === 400) return null;
      throw new Error('Authentication service unavailable');
    }
    const user = data.user;
    if (!user || user.role !== 'authenticated' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) return null;
    return { id: user.id };
  };
}
