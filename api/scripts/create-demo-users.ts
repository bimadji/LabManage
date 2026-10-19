// Creates (or updates) the three demo users in the LOCAL Supabase.
// Run after `npm run db:start`: `npm run db:seed-users` (from api/).
import { config as loadDotenv } from 'dotenv';
import type { Role } from '../src/auth/requireAuth.js';
import { loadConfig } from '../src/config.js';
import { serviceClient } from '../src/supabase.js';

// Kata sandi demo sengaja sederhana dan per akun; akun ini hanya ada di Supabase lokal.
const DEMO_USERS: { email: string; fullName: string; role: Role; password: string }[] = [
  {
    email: 'anggota@labmanage.test',
    fullName: 'Anggota Demo',
    role: 'anggota',
    password: 'anggota123',
  },
  { email: 'admin@labmanage.test', fullName: 'Admin Demo', role: 'admin', password: 'admin123' },
  {
    email: 'advisor@labmanage.test',
    fullName: 'Advisor Demo',
    role: 'advisor',
    password: 'advisor123',
  },
];

loadDotenv({ path: '.env.test', quiet: true });
// NODE_ENV=test makes loadConfig refuse any non-local SUPABASE_URL.
const config = loadConfig({ ...process.env, NODE_ENV: 'test' });

const admin = serviceClient(config);

const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const idByEmail = new Map(existing.users.map((u) => [u.email, u.id]));

for (const demo of DEMO_USERS) {
  let id = idByEmail.get(demo.email);
  const attributes = {
    password: demo.password,
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
    // Keep the map current: later steps resolve demo ids from it.
    idByEmail.set(demo.email, id);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: demo.role, full_name: demo.fullName })
    .eq('id', id);
  if (profileError) throw profileError;

  console.log(`${demo.email} → ${demo.role}`);
}

// Demo activity that must reference auth users, so it lives here instead of seed.sql.
const anggotaId = idByEmail.get('anggota@labmanage.test');
const adminId = idByEmail.get('admin@labmanage.test');
if (!anggotaId || !adminId) {
  throw new Error('User demo tidak ditemukan setelah dibuat');
}

const { data: roomRows, error: roomError } = await admin.from('rooms').select('id, name');
if (roomError) throw roomError;
const rooms = roomRows ?? [];
function roomId(name: string): string {
  const room = rooms.find((row) => row.name === name);
  if (!room) {
    throw new Error(`Ruang "${name}" tidak ada. Jalankan "npx supabase db reset" dulu.`);
  }
  return room.id;
}

const WIB_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Local lab time (WIB) as an ISO string with +07:00, `dayOffset` days from today in WIB. */
function wibIso(dayOffset: number, hour: number, minute = 0): string {
  const [year, month, day] = WIB_DATE.format(new Date()).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + dayOffset));
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

// Demo inventaris: laporan ambil dan permintaan pinjam dengan berbagai status.
// Baris demo dihapus lebih dulu agar rerun tidak menumpuk; riwayat ikut dibersihkan
// lewat `inventory_history` item yang disentuh.
await admin.from('component_requests').delete().in('user_id', [anggotaId, adminId]);
await admin.from('loan_requests').delete().in('user_id', [anggotaId, adminId]);

const { data: itemRows, error: itemError } = await admin
  .from('equipment')
  .select('id, name, kind')
  .in('name', [
    'Resistor 220 Ohm',
    'Kabel Jumper',
    'Osiloskop Rigol DS1054Z',
    'Laptop Lenovo ThinkPad E14',
    'Multimeter Fluke 17B+',
  ]);
if (itemError) throw itemError;
function itemId(name: string): string {
  const item = (itemRows ?? []).find((row) => row.name === name);
  if (!item) {
    throw new Error(`Item "${name}" tidak ada. Jalankan "npx supabase db reset" dulu.`);
  }
  return item.id;
}

const demoItemIds = (itemRows ?? []).map((row) => row.id);
await admin.from('inventory_history').delete().in('item_id', demoItemIds);

const nowIso = new Date().toISOString();
const { error: componentError } = await admin.from('component_requests').insert([
  {
    item_id: itemId('Resistor 220 Ohm'),
    user_id: anggotaId,
    qty: 5,
    note: 'untuk proyek line follower',
    status: 'menunggu',
  },
  {
    item_id: itemId('Kabel Jumper'),
    user_id: anggotaId,
    qty: 10,
    status: 'dikonfirmasi',
    decided_by: adminId,
    decided_at: nowIso,
  },
]);
if (componentError) throw componentError;

// Kabel Jumper ikut berkurang 10 karena laporannya sudah dikonfirmasi.
const { error: stockError } = await admin
  .from('equipment')
  .update({ quantity: 30, updated_at: nowIso })
  .eq('id', itemId('Kabel Jumper'));
if (stockError) throw stockError;

const { error: loanError } = await admin.from('loan_requests').insert([
  {
    item_id: itemId('Osiloskop Rigol DS1054Z'),
    user_id: anggotaId,
    purpose: 'kalibrasi sensor',
    status: 'menunggu',
  },
  {
    item_id: itemId('Laptop Lenovo ThinkPad E14'),
    user_id: anggotaId,
    purpose: 'mengerjakan laporan praktikum',
    status: 'disetujui',
    decided_by: adminId,
    decided_at: nowIso,
  },
  {
    item_id: itemId('Multimeter Fluke 17B+'),
    user_id: anggotaId,
    purpose: 'mengukur rangkaian daya',
    status: 'ditolak',
    admin_note: 'dipakai lomba',
    decided_by: adminId,
    decided_at: nowIso,
  },
]);
if (loanError) throw loanError;

const { error: loanStateError } = await admin
  .from('equipment')
  .update({ status: 'dipinjam', borrowed_by: anggotaId, borrowed_at: nowIso, updated_at: nowIso })
  .eq('id', itemId('Laptop Lenovo ThinkPad E14'));
if (loanStateError) throw loanStateError;

const { error: historyError } = await admin.from('inventory_history').insert([
  {
    item_id: itemId('Kabel Jumper'),
    actor_id: adminId,
    action: 'konfirmasi_ambil',
    before_qty: 40,
    after_qty: 30,
    note: 'untuk proyek line follower',
  },
  {
    item_id: itemId('Laptop Lenovo ThinkPad E14'),
    actor_id: adminId,
    action: 'setujui_pinjam',
    before_status: 'tersedia',
    after_status: 'dipinjam',
    note: 'mengerjakan laporan praktikum',
  },
]);
if (historyError) throw historyError;

console.log(
  'data demo: 3 reservasi, 1 sesi kehadiran terbuka, 2 laporan fasilitas, ' +
    '2 laporan ambil, 3 permintaan pinjam',
);
