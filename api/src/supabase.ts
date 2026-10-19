import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';

const serverAuth = { persistSession: false, autoRefreshToken: false } as const;

/** Anon-key client without a user session (used to verify tokens and sign in). */
export function anonClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: serverAuth });
}

/** Client that acts as the user behind `jwt`, so RLS applies to every query. */
export function userClient(config: Config, jwt: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: serverAuth,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/** Service-role client. Bypasses RLS: server-side jobs and seed scripts only. */
export function serviceClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: serverAuth });
}
