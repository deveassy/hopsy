import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { sessionStorage } from './session-storage';

let client: SupabaseClient | undefined;
let preparing: Promise<SupabaseClient> | undefined;

export async function getSupabase(): Promise<SupabaseClient> {
  if (client) return client;
  if (preparing) return preparing;
  preparing = prepareClient();
  try { return await preparing; } finally { preparing = undefined; }
}

async function prepareClient(): Promise<SupabaseClient> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Set the public Supabase URL and publishable key in apps/mobile/.env.');
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  // The SDK can swallow an initialization read error and subsequently report no
  // session. Fail before constructing it instead of interpreting that as signup.
  await sessionStorage.getItem(storageKey);
  client = createClient(url, key, {
    auth: {
      storage: sessionStorage,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
