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
const demoPassword = process.env.DEMO_PASSWORD;
if (!demoPassword) {
  throw new Error('DEMO_PASSWORD wajib diisi di api/.env.test');
}

const admin = serviceClient(config);

const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const idByEmail = new Map(existing.users.map((u) => [u.email, u.id]));

for (const demo of DEMO_USERS) {
  let id = idByEmail.get(demo.email);
  const attributes = {
    password: demoPassword,
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

// Demo activity that must reference auth users, so it lives here instead of seed.sql.
const anggotaId = idByEmail.get('anggota@labmanage.test')!;
const adminId = idByEmail.get('admin@labmanage.test')!;

const { data: rooms, error: roomError } = await admin.from('rooms').select('id, name');
if (roomError) throw roomError;
const roomId = (name: string) => rooms.find((room) => room.name === name)?.id;

function wibIso(dayOffset: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  const key = date.toISOString().slice(0, 10);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${key}T${hh}:${mm}:00+07:00`;
}

// Reset demo-owned rows so reruns stay idempotent.
await admin.from('reservations').delete().in('user_id', [anggotaId, adminId]);
await admin.from('attendance').delete().in('user_id', [anggotaId, adminId]);
await admin.from('facility_reports').delete().in('reported_by', [anggotaId, adminId]);
await admin.from('notifications').delete().in('user_id', [anggotaId, adminId]);

const demoReservations = [
  {
    room_id: roomId('Ruang Robotik A'),
    team: 'Tim Robotik',
    starts_at: wibIso(1, 9),
    ends_at: wibIso(1, 11),
  },
  {
    room_id: roomId('Printer 3D'),
    team: 'Divisi Mekanik',
    starts_at: wibIso(1, 13),
    ends_at: wibIso(1, 15),
  },
  {
    room_id: roomId('Ruang Robotik B'),
    team: 'Tim Robotik',
    starts_at: wibIso(2, 16),
    ends_at: wibIso(2, 18),
  },
].map((row) => ({ ...row, user_id: anggotaId, status: 'aktif' as const }));
const { error: reservationError } = await admin.from('reservations').insert(demoReservations);
if (reservationError) throw reservationError;

const { error: attendanceError } = await admin
  .from('attendance')
  .insert({ user_id: anggotaId, checked_in_at: new Date(Date.now() - 45 * 60_000).toISOString() });
if (attendanceError) throw attendanceError;

const demoReports = [
  {
    category: 'lampu' as const,
    description: 'Lampu di atas meja solder berkedip lalu mati',
    location: 'Meja Solder',
    status: 'baru' as const,
  },
  {
    category: 'ventilasi' as const,
    description: 'Ventilasi ruang robotik B tidak berputar sejak minggu lalu',
    location: 'Ruang Robotik B',
    status: 'ditindaklanjuti' as const,
  },
].map((row) => ({ ...row, reported_by: anggotaId }));
const { error: reportError } = await admin.from('facility_reports').insert(demoReports);
if (reportError) throw reportError;

console.log('data demo: 3 reservasi, 1 sesi kehadiran terbuka, 2 laporan fasilitas');
