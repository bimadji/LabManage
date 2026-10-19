import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The only Supabase client in the frontend. It must only ever use the anon key;
// the service role key never reaches the browser.
let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, creating it on first use.
 * Created lazily so importing this module never throws when env is absent
 * (for example while a component test renders in isolation).
 */
export function supabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY wajib diisi di web/.env');
  }

  client = createClient(url, anonKey);
  return client;
}
