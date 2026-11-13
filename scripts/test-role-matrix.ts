/**
 * Matriks hak akses per role (PRD §3) diuji langsung ke database uji.
 * Jalankan: npx tsx scripts/test-role-matrix.ts
 * Butuh: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY di .env.test.local.
 *
 * Setiap baris matriks diuji untuk 4 peran: admin, anggota tim riset,
 * anggota UKM, advisor. Aksi yang DILARANG harus gagal (error RLS / 42501).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { check, finish, requireEnv } from './test-harness'

const { url, anonKey } = requireEnv()

type Peran = 'admin' | 'anggota' | 'anggota-ukm' | 'advisor'

const AKUN: Record<Peran, string> = {
  admin: 'admin.lab@labmanage.test',
  anggota: 'dimas.eros@labmanage.test',
  'anggota-ukm': 'rina.robo@labmanage.test',
  advisor: 'budi.advisor@labmanage.test',
}

// User tanpa baris profiles: dibuat khusus pengujian ini.
const TANPA_PROFIL = 'tanpa-profil@labmanage.test'
const PASSWORD = 'password123'

type Klien = SupabaseClient

async function signIn(email: string): Promise<Klien> {
  const client = createClient(url, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) {
    console.error(`Gagal login ${email}: ${error.message}`)
    process.exit(1)
  }
  return client
}

async function ensureUserTanpaProfil(): Promise<void> {
  const admin = createClient(url, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!)
  const { error } = await admin.auth.admin.createUser({
    email: TANPA_PROFIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !error.message.includes('already')) {
    console.error(`Gagal membuat user tanpa profil: ${error.message}`)
    process.exit(1)
  }
}

async function main() {
  await ensureUserTanpaProfil()

  const clients: Record<Peran, Klien> = {
    admin: await signIn(AKUN.admin),
    anggota: await signIn(AKUN.anggota),
    'anggota-ukm': await signIn(AKUN['anggota-ukm']),
    advisor: await signIn(AKUN.advisor),
  }
  const tanpaProfil = await signIn(TANPA_PROFIL)

  // Identitas & barang uji.
  const admin = clients.admin
  const { data: profilAdmin } = await admin.from('profiles').select('id, kelompok_id').eq('role', 'admin').single()
  const { data: profilAnggota } = await clients.anggota.from('profiles').select('id, kelompok_id').eq('email', AKUN.anggota).single()
  const { data: profilUkm } = await clients['anggota-ukm'].from('profiles').select('id, kelompok_id').eq('email', AKUN['anggota-ukm']).single()
  const { data: profilAdvisor } = await clients.advisor.from('profiles').select('id, kelompok_id').eq('email', AKUN.advisor).single()
  const { data: profilFarhan } = await admin.from('profiles').select('id, kelompok_id').eq('email', 'farhan.eros@labmanage.test').single()

  const kode = `MATRIX-${Date.now().toString().slice(-6)}`
  const { data: item, error: itemErr } = await admin
    .from('inventory_items')
    .insert([{
      nama: 'Barang Uji Matriks', kode, kategori: 'sensor', lokasi: 'Rak Uji',
      stok_total: 10, stok_tersedia: 10, status: 'tersedia',
      dapat_dipinjam_kelompok_lain: true,
    }])
    .select()
    .single()
  if (itemErr) {
    console.error(`Gagal membuat barang uji: ${itemErr.message}`)
    process.exit(1)
  }

  // Barang milik kelompok EIRA saja (kelompok lain dari anggota EROS).
  const { data: profilEira } = await admin.from('profiles').select('id, kelompok_id').eq('email', 'bayu.eira@labmanage.test').single()
  const { data: itemPrivat } = await admin
    .from('inventory_items')
    .insert([{
      nama: 'Barang Privat EIRA', kode: `${kode}-P`, kategori: 'sensor', lokasi: 'Rak Uji',
      stok_total: 2, stok_tersedia: 2, status: 'tersedia',
      pemilik_kelompok_id: profilEira!.kelompok_id, dapat_dipinjam_kelompok_lain: false,
    }])
    .select()
    .single()

  const esok = new Date(Date.now() + 86400000).toISOString()
  const belakang = new Date(Date.now() + 2 * 86400000).toISOString()

  async function buatLoan(client: Klien, pemohon: string, kelompok: string, itemId: string, jumlah = 1) {
    const { data, error } = await client.from('loan_requests').insert([{
      item_id: itemId, user_id: pemohon, kelompok_id: kelompok, jumlah,
      keperluan: 'uji matriks', rencana_kembali: belakang, status: 'menunggu',
    }]).select().single()
    return { data, error }
  }

  // ------------------------------------------------------------------
  // 1. Ajukan pinjam (PRD: Admin TIDAK boleh; anggota & advisor boleh)
  // ------------------------------------------------------------------
  {
    const { error } = await buatLoan(clients.anggota, profilAnggota!.id, profilAnggota!.kelompok_id, item!.id)
    check('anggota: boleh mengajukan pinjam', !error, error?.message ?? 'ok')
  }
  {
    const { error } = await buatLoan(clients.advisor, profilAdvisor!.id, profilAdvisor!.kelompok_id, item!.id)
    check('advisor: boleh mengajukan pinjam', !error, error?.message ?? 'ok')
  }
  {
    const { error } = await buatLoan(clients.admin, profilAdmin!.id, profilAdmin!.kelompok_id, item!.id)
    check('admin: DITOLAK mengajukan pinjam', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await buatLoan(clients['anggota-ukm'], profilUkm!.id, profilUkm!.kelompok_id, item!.id)
    check('anggota UKM: boleh mengajukan pinjam barang bersama', !error, error?.message ?? 'ok')
  }

  // 1b. Menulis atas nama user lain (user_id palsu) harus ditolak.
  {
    const { error } = await buatLoan(clients.anggota, profilUkm!.id, profilUkm!.kelompok_id, item!.id)
    check('anggota: DITOLAK menulis pinjam atas nama user lain', Boolean(error), error?.message ?? 'LOLOS')
  }

  // ------------------------------------------------------------------
  // 2. Verifikasi pinjam (RPC): hanya Admin
  // ------------------------------------------------------------------
  const loanAnggota = (await buatLoan(clients.anggota, profilAnggota!.id, profilAnggota!.kelompok_id, item!.id)).data!
  {
    const { error } = await clients.admin.rpc('verifikasi_pinjam', { p_loan_id: loanAnggota.id, p_setuju: true, p_alasan: 'ok' })
    check('admin: boleh menyetujui pinjam (RPC)', !error, error?.message ?? 'ok')
  }
  {
    const loan2 = (await buatLoan(clients.anggota, profilAnggota!.id, profilAnggota!.kelompok_id, item!.id)).data!
    const { error } = await clients.advisor.rpc('verifikasi_pinjam', { p_loan_id: loan2.id, p_setuju: true, p_alasan: 'x' })
    check('advisor: DITOLAK menyetujui pinjam (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const loan3 = (await buatLoan(clients.anggota, profilAnggota!.id, profilAnggota!.kelompok_id, item!.id)).data!
    const { error } = await clients.anggota.rpc('verifikasi_pinjam', { p_loan_id: loan3.id, p_setuju: false, p_alasan: 'x' })
    check('anggota: DITOLAK memverifikasi pinjam (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }

  // 2b. Selesaikan pinjam (RPC): hanya Admin
  {
    const { error } = await clients.anggota.rpc('selesaikan_pinjam', { p_loan_id: loanAnggota.id })
    check('anggota: DITOLAK menyelesaikan pinjam (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.advisor.rpc('selesaikan_pinjam', { p_loan_id: loanAnggota.id })
    check('advisor: DITOLAK menyelesaikan pinjam (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }

  // ------------------------------------------------------------------
  // 3. Tambah barang & stok: hanya Admin
  // ------------------------------------------------------------------
  {
    const { error } = await clients.anggota.from('inventory_items').insert([{
      nama: 'Barang Ilegal', kode: `${kode}-A`, kategori: 'sensor', lokasi: 'Meja',
      stok_total: 1, stok_tersedia: 1, status: 'tersedia',
    }])
    check('anggota: DITOLAK menambah barang', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.advisor.from('inventory_items').insert([{
      nama: 'Barang Ilegal', kode: `${kode}-B`, kategori: 'sensor', lokasi: 'Meja',
      stok_total: 1, stok_tersedia: 1, status: 'tersedia',
    }])
    check('advisor: DITOLAK menambah barang', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.anggota.rpc('tambah_stok_inventory', { p_item_id: item!.id, p_jumlah: 1 })
    check('anggota: DITOLAK menambah stok (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.advisor.rpc('tambah_stok_inventory', { p_item_id: item!.id, p_jumlah: 1 })
    check('advisor: DITOLAK menambah stok (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.admin.rpc('tambah_stok_inventory', { p_item_id: item!.id, p_jumlah: 1 })
    check('admin: boleh menambah stok (RPC)', !error, error?.message ?? 'ok')
  }

  // ------------------------------------------------------------------
  // 4. Ubah status laporan: hanya Admin
  // ------------------------------------------------------------------
  const { data: laporan, error: laporanErr } = await clients.anggota.from('reports').insert([{
    user_id: profilAnggota!.id, kelompok_id: profilAnggota!.kelompok_id,
    judul: 'Laporan uji matriks', deskripsi: 'Uji', lokasi: 'Rak', jenis: 'rusak', urgensi: 'normal',
  }]).select().single()
  if (laporanErr) {
    console.error(`Gagal membuat laporan uji: ${laporanErr.message}`)
    process.exit(1)
  }

  {
    const { data, error } = await clients.advisor.from('reports').update({ status: 'selesai' }).eq('id', laporan!.id).select('id')
    check('advisor: DITOLAK mengubah status laporan', Boolean(error) || (data ?? []).length === 0, error?.message ?? `baris=${(data ?? []).length}`)
  }
  {
    const { data, error } = await clients.anggota.from('reports').update({ status: 'selesai' }).eq('id', laporan!.id).select('id')
    check('anggota: DITOLAK mengubah status laporan', Boolean(error) || (data ?? []).length === 0, error?.message ?? `baris=${(data ?? []).length}`)
  }
  {
    const { data, error } = await clients.admin.from('reports').update({ status: 'ditangani' }).eq('id', laporan!.id).select('id')
    check('admin: boleh mengubah status laporan', !error && (data ?? []).length === 1, error?.message ?? `baris=${(data ?? []).length}`)
  }

  // 4b. Laporan atas nama user lain harus ditolak.
  {
    const { error } = await clients.anggota.from('reports').insert([{
      user_id: profilUkm!.id, kelompok_id: profilUkm!.kelompok_id,
      judul: 'Laporan atas nama lain', deskripsi: 'Uji', lokasi: 'Rak', jenis: 'rusak', urgensi: 'normal',
    }])
    check('anggota: DITOLAK menulis laporan atas nama user lain', Boolean(error), error?.message ?? 'LOLOS')
  }

  // ------------------------------------------------------------------
  // 5. Booking ruangan: semua peran boleh (bukan eksklusif admin)
  // ------------------------------------------------------------------
  // Tiap peran memakai slot berbeda: booking yang sama di ruangan & jam yang sama
  // memang bentrok (constraint GiST), jadi slot digeser per peran.
  // Slot dihitung dari slot harian (Pagi/Siang/Malam) + hari ke-N agar tidak
  // pernah bentrok dengan booking hasil seed atau run sebelumnya.
  // Jam proses dijadikan penanda slot supaya run berurutan tidak saling bentrok
  // walau run sebelumnya gagal sebelum pembersihan.
  const hariKedepan = 7 + Number(process.env.MATRIX_HARI_OFFSET ?? '0')
  const menitPenanda = new Date().getMinutes()
  const slotPeran: Record<Peran, number> = { admin: 0, anggota: 1, 'anggota-ukm': 2, advisor: 3 }
  for (const peran of ['admin', 'anggota', 'anggota-ukm', 'advisor'] as Peran[]) {
    const profil = peran === 'admin' ? profilAdmin : peran === 'anggota' ? profilAnggota : peran === 'advisor' ? profilAdvisor : profilUkm
    const mulai = new Date(
      Date.now() + (hariKedepan * 86400000 + slotPeran[peran] * 3600000 + menitPenanda * 60000)
    ).toISOString()
    const selesai = new Date(
      Date.now() + (hariKedepan * 86400000 + (slotPeran[peran] + 1) * 3600000 + menitPenanda * 60000)
    ).toISOString()
    const { error } = await clients[peran].from('room_bookings').insert([{
      ruangan_id: 'arena-kontes', nama_ruangan: 'Arena Uji', user_id: profil!.id, kelompok_id: profil!.kelompok_id,
      waktu_mulai: mulai, waktu_selesai: selesai, keperluan: 'uji matriks', jumlah_peserta: 3, status: 'aktif',
    }])
    check(`${peran}: boleh membuat booking ruangan`, !error, error?.message ?? 'ok')
  }

  // 5b. Booking atas nama user lain harus ditolak.
  {
    const { error } = await clients.anggota.from('room_bookings').insert([{
      ruangan_id: 'arena-kontes', nama_ruangan: 'Arena Uji', user_id: profilUkm!.id, kelompok_id: profilUkm!.kelompok_id,
      waktu_mulai: esok, waktu_selesai: belakang, keperluan: 'uji matriks', jumlah_peserta: 3, status: 'aktif',
    }])
    check('anggota: DITOLAK membuat booking atas nama user lain', Boolean(error), error?.message ?? 'LOLOS')
  }

  // ------------------------------------------------------------------
  // 6. Presensi (check-in): hanya anggota tim riset
  // ------------------------------------------------------------------
  {
    const { error } = await clients.anggota.from('attendance_sessions').insert([{
      user_id: profilAnggota!.id, kelompok_id: profilAnggota!.kelompok_id, check_in: new Date().toISOString(),
    }])
    check('anggota tim riset: boleh check-in', !error, error?.message ?? 'ok')
  }
  {
    const { error } = await clients['anggota-ukm'].from('attendance_sessions').insert([{
      user_id: profilUkm!.id, kelompok_id: profilUkm!.kelompok_id, check_in: new Date().toISOString(),
    }])
    check('anggota UKM: DITOLAK check-in', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.advisor.from('attendance_sessions').insert([{
      user_id: profilAdvisor!.id, kelompok_id: profilAdvisor!.kelompok_id, check_in: new Date().toISOString(),
    }])
    check('advisor: DITOLAK check-in', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await clients.admin.from('attendance_sessions').insert([{
      user_id: profilAdmin!.id, kelompok_id: profilAdmin!.kelompok_id, check_in: new Date().toISOString(),
    }])
    check('admin: DITOLAK check-in', Boolean(error), error?.message ?? 'LOLOS')
  }

  // 6b. Presensi atas nama user lain harus ditolak.
  {
    const { error } = await clients.anggota.from('attendance_sessions').insert([{
      user_id: profilAdvisor!.id, kelompok_id: profilAdvisor!.kelompok_id, check_in: new Date().toISOString(),
    }])
    check('anggota: DITOLAK check-in atas nama user lain', Boolean(error), error?.message ?? 'LOLOS')
  }

  // 6c. Check-out sesi milik anggota lain harus ditolak.
  {
    // Sesi terbuka milik anggota lain dibuat lewat service role (RLS tidak bisa
    // disimulasikan dari admin karena admin memang tidak boleh check-in).
    await createClient(url, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!).from('attendance_sessions').insert([{
      user_id: profilFarhan!.id, kelompok_id: profilFarhan!.kelompok_id, check_in: new Date().toISOString(),
    }])
    const { data: sesiOrangLain } = await admin
      .from('attendance_sessions')
      .select('id')
      .eq('user_id', profilFarhan!.id)
      .is('check_out', null)
      .limit(1)
    if (sesiOrangLain && sesiOrangLain.length > 0) {
      const { error } = await clients.anggota
        .from('attendance_sessions')
        .update({ check_out: new Date().toISOString() })
        .eq('id', sesiOrangLain[0].id)
      // RLS UPDATE tidak melempar error: baris yang tidak terlihat tidak ikut terpengaruh.
      const { data: setelahnya } = await admin
        .from('attendance_sessions')
        .select('check_out')
        .eq('id', sesiOrangLain[0].id)
        .single()
      const tetapTerbuka = setelahnya?.check_out === null
      check('anggota: DITOLAK menutup sesi presensi milik anggota lain',
        !error && tetapTerbuka,
        `err=${error?.message ?? '-'} check_out=${setelahnya?.check_out ?? 'null'}`)
    } else {
      check('anggota: DITOLAK menutup sesi presensi milik anggota lain', false, 'sesi terbuka milik user lain tidak tersedia')
    }
  }

  // ------------------------------------------------------------------
  // 7. Baca data kelompok lain
  // ------------------------------------------------------------------
  {
    const { data, error } = await clients.anggota.from('inventory_items').select('id').eq('id', itemPrivat!.id)
    check('anggota: TIDAK boleh membaca barang privat kelompok lain', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await clients['anggota-ukm'].from('inventory_items').select('id').eq('id', itemPrivat!.id)
    check('anggota UKM: TIDAK boleh membaca barang privat kelompok lain', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await clients.anggota.from('profiles').select('id').eq('id', profilUkm!.id)
    check('anggota: TIDAK boleh membaca profil kelompok lain', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await clients.anggota.from('loan_requests').select('id').eq('user_id', profilAdvisor!.id)
    check('anggota: TIDAK boleh membaca permohonan milik orang lain', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }

  // ------------------------------------------------------------------
  // 8. User tanpa baris profiles: tidak boleh apa pun
  // ------------------------------------------------------------------
  {
    const { data, error } = await tanpaProfil.from('inventory_items').select('id')
    check('tanpa profil: TIDAK boleh membaca inventaris', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await tanpaProfil.from('loan_requests').select('id')
    check('tanpa profil: TIDAK boleh membaca permohonan', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await tanpaProfil.from('profiles').select('id')
    check('tanpa profil: TIDAK boleh membaca profiles', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await tanpaProfil.from('room_bookings').select('id')
    check('tanpa profil: TIDAK boleh membaca booking', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { data, error } = await tanpaProfil.from('attendance_sessions').select('id')
    check('tanpa profil: TIDAK boleh membaca presensi', !error && (data ?? []).length === 0, `baris=${(data ?? []).length} err=${error?.message ?? '-'}`)
  }
  {
    const { error } = await tanpaProfil.from('loan_requests').insert([{
      item_id: item!.id, user_id: profilAnggota!.id, kelompok_id: profilAnggota!.kelompok_id,
      jumlah: 1, keperluan: 'uji', rencana_kembali: belakang,
    }])
    check('tanpa profil: DITOLAK menulis permohonan', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await tanpaProfil.from('attendance_sessions').insert([{
      user_id: profilAnggota!.id, kelompok_id: profilAnggota!.kelompok_id, check_in: new Date().toISOString(),
    }])
    check('tanpa profil: DITOLAK menulis presensi', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await tanpaProfil.from('room_bookings').insert([{
      ruangan_id: 'arena-kontes', nama_ruangan: 'Arena Uji', user_id: profilAnggota!.id, kelompok_id: profilAnggota!.kelompok_id,
      waktu_mulai: esok, waktu_selesai: belakang, keperluan: 'uji', jumlah_peserta: 3, status: 'aktif',
    }])
    check('tanpa profil: DITOLAK membuat booking', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await tanpaProfil.rpc('verifikasi_pinjam', { p_loan_id: loanAnggota.id, p_setuju: true, p_alasan: 'x' })
    check('tanpa profil: DITOLAK memverifikasi pinjam (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }
  {
    const { error } = await tanpaProfil.rpc('tambah_stok_inventory', { p_item_id: item!.id, p_jumlah: 1 })
    check('tanpa profil: DITOLAK menambah stok (RPC)', Boolean(error), error?.message ?? 'LOLOS')
  }

  // Bersihkan data uji yang dibuat skrip ini (biar run berikutnya tidak bentrok).
  const service = createClient(url, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!)
  await service.from('room_bookings').delete().like('keperluan', 'uji matriks')
  await service.from('loan_requests').delete().like('keperluan', 'uji matriks')
  await service.from('reports').delete().like('deskripsi', 'Uji')
  await service.from('inventory_items').delete().like('kode', `${kode}%`)
  await service.from('attendance_sessions').delete().eq('user_id', profilFarhan!.id).is('check_out', null)
  console.log('🧹 Data uji dibersihkan.')

  finish()
}

main().catch((err) => {
  console.error('Gagal menjalankan matriks role:', err)
  process.exit(1)
})
