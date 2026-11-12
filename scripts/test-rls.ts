/**
 * Verifikasi RLS inti terhadap DB uji nyata.
 * Jalankan: npx tsx scripts/test-rls.ts
 * Butuh: TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, dan akun demo dari scripts/seed-dummy.ts.
 * Keluar non-zero bila ada pemeriksaan gagal.
 */
import { createClient } from '@supabase/supabase-js'
import { check, finish, requireEnv } from './test-harness'

const { url, anonKey } = requireEnv()
const PASSWORD = 'password123'

async function signIn(email: string) {
  const client = createClient(url, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) {
    console.error(`Gagal login ${email}: ${error.message}`)
    process.exit(1)
  }
  return client
}

async function main() {
  const ukm = await signIn('rina.robo@labmanage.test')
  const eros = await signIn('dimas.eros@labmanage.test')
  const advisor = await signIn('budi.advisor@labmanage.test')

  const { data: ukmProfile } = await ukm.from('profiles').select('kelompok_id').single()
  const { data: erosAuth } = await eros.auth.getUser()

  // 1. UKM tidak boleh mengisi presensi (RLS attendance_insert_tim_riset)
  const ukmAttendance = await ukm.from('attendance_sessions').insert([{
    user_id: (await ukm.auth.getUser()).data.user?.id,
    kelompok_id: ukmProfile?.kelompok_id,
    check_in: new Date().toISOString(),
  }])
  check('UKM Roboholic diblokir dari attendance_sessions', Boolean(ukmAttendance.error), ukmAttendance.error?.message ?? 'LOLOS')

  // 2. UKM tidak melihat item privat kelompok lain
  const ukmItems = await ukm.from('inventory_items').select('kode')
  const seesPrivate = (ukmItems.data ?? []).some((i) => i.kode === 'EROS-ACT-001')
  check('UKM tidak melihat item privat EROS', !ukmItems.error && !seesPrivate, `error=${ukmItems.error?.message ?? '-'} terlihat=${seesPrivate}`)

  // 3. Anggota hanya melihat presensi miliknya
  const erosAttendance = await eros.from('attendance_sessions').select('user_id')
  const onlyOwn = (erosAttendance.data ?? []).every((a) => a.user_id === erosAuth?.user?.id)
  check('Anggota hanya melihat presensi sendiri', !erosAttendance.error && onlyOwn, `baris=${erosAttendance.data?.length ?? 0} hanya-sendiri=${onlyOwn}`)

  // 4. Anggota tidak bisa membaca permohonan milik orang lain
  const othersLoans = await eros.from('loan_requests').select('user_id')
  const ownOnly = (othersLoans.data ?? []).every((l) => l.user_id === erosAuth?.user?.id)
  check('Anggota hanya melihat permohonan sendiri', !othersLoans.error && ownOnly, `baris=${othersLoans.data?.length ?? 0} hanya-sendiri=${ownOnly}`)

  // 5. Advisor tidak bisa mengubah status laporan (RLS reports_update_policy)
  const advisorReport = await advisor.from('reports').update({ status: 'selesai' }).neq('id', '00000000-0000-0000-0000-000000000000').select('id')
  check(
    'Advisor tidak bisa mengubah status laporan',
    Boolean(advisorReport.error) || (advisorReport.data ?? []).length === 0,
    `error=${advisorReport.error?.message ?? '-'} baris-berubah=${advisorReport.data?.length ?? 0}`
  )

  // 6. Advisor tidak bisa memverifikasi peminjaman (RPC khusus admin)
  const advisorApprove = await advisor.rpc('verifikasi_pinjam', {
    p_loan_id: '00000000-0000-0000-0000-000000000000',
    p_setuju: true,
    p_alasan: 'x',
  })
  check('Advisor ditolak oleh verifikasi_pinjam', Boolean(advisorApprove.error), advisorApprove.error?.message ?? 'LOLOS')

  // 7. Anggota tidak bisa menambah stok (RPC khusus admin)
  const memberStock = await eros.rpc('tambah_stok_inventory', {
    p_item_id: '00000000-0000-0000-0000-000000000000',
    p_jumlah: 1,
  })
  check('Anggota ditolak oleh tambah_stok_inventory', Boolean(memberStock.error), memberStock.error?.message ?? 'LOLOS')

  finish()
}

main().catch((err) => {
  console.error('Gagal menjalankan suite:', err)
  process.exit(1)
})
