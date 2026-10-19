import { config as loadDotenv } from 'dotenv';

export interface Config {
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  // Only place in the codebase that reads the service role key.
  supabaseServiceRoleKey: string;
}

const LOCAL_HOSTS: Record<string, true> = { '127.0.0.1': true, localhost: true };

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Variabel env ${name} wajib diisi`);
  return value;
}

/**
 * Builds the API config from environment variables.
 * Refuses to run tests against a non-local Supabase so tests never touch production.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const supabaseUrl = required(env, 'SUPABASE_URL');

  if (env.NODE_ENV === 'test') {
    let host: string;
    try {
      host = new URL(supabaseUrl).hostname;
    } catch {
      throw new Error(`SUPABASE_URL tidak valid: ${supabaseUrl}`);
    }
    if (!Object.hasOwn(LOCAL_HOSTS, host)) {
      throw new Error(`NODE_ENV=test hanya boleh memakai Supabase lokal, bukan ${host}`);
    }
  }

  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT tidak valid: ${env.PORT}`);
  }

  return {
    port,
    supabaseUrl,
    supabaseAnonKey: required(env, 'SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}

/** Loads `.env` (or `.env.test` when NODE_ENV=test) into process.env. */
export function loadEnvFile(): void {
  const path = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
  loadDotenv({ path, quiet: true });
}
