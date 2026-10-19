import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '../../src/auth/requireAuth.js';
import { loadConfig, loadEnvFile, type Config } from '../../src/config.js';
import { anonClient, serviceClient, userClient } from '../../src/supabase.js';

export interface TestUser {
  id: string;
  email: string;
  token: string;
  client: SupabaseClient;
}

/** Loads api/.env.test; loadConfig refuses anything but a local Supabase in tests. */
export function testConfig(): Config {
  loadEnvFile();
  return loadConfig();
}

/** Creates a confirmed auth user with the given role and signs it in. */
export async function createTestUser(config: Config, role: Role): Promise<TestUser> {
  const admin = serviceClient(config);
  const email = `test-${role}-${randomUUID()}@labmanage.test`;
  const userPassword = randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: `Test ${role}` },
  });
  if (error) throw error;
  const id = data.user.id;

  if (role !== 'anggota') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', id);
    if (roleError) throw roleError;
  }

  const { data: session, error: signInError } = await anonClient(config).auth.signInWithPassword({
    email,
    password: userPassword,
  });
  if (signInError) throw signInError;
  const token = session.session.access_token;

  return { id, email, token, client: userClient(config, token) };
}

export async function deleteTestUsers(config: Config, users: TestUser[]): Promise<void> {
  const admin = serviceClient(config);
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
