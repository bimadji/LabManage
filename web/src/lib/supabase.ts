import { createClient } from '@supabase/supabase-js';

// The only Supabase client in the frontend. It must only ever use the anon key;
// the service role key never reaches the browser.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY wajib diisi di web/.env');
}

export const supabase = createClient(url, anonKey);
