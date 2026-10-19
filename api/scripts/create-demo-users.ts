// Creates (or updates) the three demo users in the LOCAL Supabase.
// Run after `npm run db:start`: `npm run db:seed-users` (from api/).
import { config as loadDotenv } from 'dotenv';
import type { Role } from '../src/auth/requireAuth.js';
import { loadConfig } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';

const DEMO_USERS: { email: string; fullName: string; role: Role }[] = [
  { email: 'anggota@labmanage.test', fullName: 'Anggota Demo', role: 'anggota' },
  { email: 'admin@labmanage.test', fullName: 'Admin Demo', role: 'admin' },
  { email: 'advisor@labmanage.test', fullName: 'Advisor Demo', role: 'advisor' },
];

loadDotenv({ path: '.env.test', quiet: true });
// NODE_ENV=test makes loadConfig refuse any non-local SUPABASE_URL.
const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
const password = process.env.DEMO_PASSWORD;
if (!password) {
  throw new Error('DEMO_PASSWORD wajib diisi di api/.env.test');
}

const admin = serviceClient(config);

const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const idByEmail = new Map(existing.users.map((u) => [u.email, u.id]));

for (const demo of DEMO_USERS) {
  let id = idByEmail.get(demo.email);
  const attributes = {
    password,
    email_confirm: true,
    user_metadata: { full_name: demo.fullName },
  };

  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, attributes);
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: demo.email, ...attributes });
    if (error) throw error;
    id = data.user.id;
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: demo.role, full_name: demo.fullName })
    .eq('id', id);
  if (profileError) throw profileError;

  console.log(`${demo.email} → ${demo.role}`);
}
