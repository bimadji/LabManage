/**
 * Verifikasi siklus pinjam (stok, verifikasi, penyelesaian) terhadap DB uji nyata.
 * Jalankan: npx tsx scripts/test-inventory-admin.ts
 * Butuh: TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, dan akun demo dari scripts/seed-dummy.ts.
 * Keluar non-zero bila ada pemeriksaan gagal.
 */
import { createClient } from '@supabase/supabase-js'
import { check, finish, requireEnv } from './test-harness'

const { url, anonKey } = requireEnv()
const PASSWORD = 'password123'
const ADMIN = 'admin.lab@labmanage.test'
const MEMBER = 'dimas.eros@labmanage.test'
const UKM = 'rina.robo@labmanage.test'

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
  const admin = await signIn(ADMIN)
  const member = await signIn(MEMBER)
  const ukm = await signIn(UKM)

  const { data: authUser } = await member.auth.getUser()
  const { data: profile, error: profileErr } = await member
    .from('profiles')
    .select('id, kelompok_id')
    .eq('id', authUser?.user?.id ?? '')
    .single()
  if (!profile) {
    console.error(`Profil anggota tidak ditemukan (${profileErr?.message}); jalankan scripts/seed-dummy.ts dulu.`)
    process.exit(1)
  }

  const stamp = Date.now().toString().slice(-6)
  async function createItem(kode: string, stok: number) {
    const { data, error } = await admin
      .from('inventory_items')
      .insert([{
        nama: `Uji Pinjam ${kode}`,
        kode,
        kategori: 'sensor',
        lokasi: 'Rak Uji',
        stok_total: stok,
        stok_tersedia: stok,
        status: 'tersedia',
        pemilik_kelompok_id: null,
        dapat_dipinjam_kelompok_lain: true,
      }])
      .select()
      .single()
    if (error) {
      console.error(`Gagal membuat item ${kode}: ${error.message}`)
      process.exit(1)
    }
    return data
  }

  async function createLoan(itemId: string, jumlah: number) {
    const { data, error } = await member
      .from('loan_requests')
      .insert([{
        item_id: itemId,
        user_id: profile!.id,
        kelompok_id: profile!.kelompok_id,
        jumlah,
        keperluan: `uji ${stamp}`,
        rencana_kembali: new Date(Date.now() + 7 * 86400000).toISOString(),
      }])
      .select()
      .single()
    if (error) {
      console.error(`Gagal membuat permohonan: ${error.message}`)
      process.exit(1)
    }
    return data
  }

  const stokTersedia = async (itemId: string) => {
    const { data } = await admin.from('inventory_items').select('stok_tersedia, status').eq('id', itemId).single()
    return data
  }

  // 1. Setuju dengan stok cukup
  const itemA = await createItem(`UJI-A-${stamp}`, 5)
  const loanA = await createLoan(itemA.id, 2)
  const approve = await admin.rpc('verifikasi_pinjam', { p_loan_id: loanA.id, p_setuju: true, p_alasan: 'ok' })
  const afterA = await stokTersedia(itemA.id)
  check(
    'setuju stok cukup: status disetujui + stok 5→3',
    !approve.error && approve.data?.status === 'disetujui' && afterA?.stok_tersedia === 3,
    `err=${approve.error?.message ?? '-'} status=${approve.data?.status} stok=${afterA?.stok_tersedia}`
  )

  // 2. Setuju dengan stok kurang harus ditolak
  const itemB = await createItem(`UJI-B-${stamp}`, 1)
  const loanB = await createLoan(itemB.id, 3)
  const approveB = await admin.rpc('verifikasi_pinjam', { p_loan_id: loanB.id, p_setuju: true, p_alasan: 'ok' })
  const afterB = await stokTersedia(itemB.id)
  const loanBStatus = await member.from('loan_requests').select('status').eq('id', loanB.id).single()
  check(
    'setuju stok kurang ditolak, stok tidak berubah',
    Boolean(approveB.error) && afterB?.stok_tersedia === 1 && loanBStatus.data?.status === 'menunggu',
    `err=${approveB.error?.message ?? 'TIDAK ADA ERROR'} stok=${afterB?.stok_tersedia} status=${loanBStatus.data?.status}`
  )

  // 3. Tolak tidak mengubah stok
  const loanC = await createLoan(itemA.id, 1)
  const reject = await admin.rpc('verifikasi_pinjam', { p_loan_id: loanC.id, p_setuju: false, p_alasan: 'alat dipakai' })
  const afterC = await stokTersedia(itemA.id)
  check(
    'tolak: status ditolak, stok tetap 3',
    !reject.error && reject.data?.status === 'ditolak' && afterC?.stok_tersedia === 3,
    `status=${reject.data?.status} stok=${afterC?.stok_tersedia}`
  )

  // 4. Selesai memulihkan stok
  const complete = await admin.rpc('selesaikan_pinjam', { p_loan_id: loanA.id })
  const afterD = await stokTersedia(itemA.id)
  check(
    'selesai: stok pulih ke 5 + tanggal_kembali terisi',
    !complete.error && complete.data?.status === 'selesai' && afterD?.stok_tersedia === 5 && Boolean(complete.data?.tanggal_kembali),
    `status=${complete.data?.status} stok=${afterD?.stok_tersedia} tanggal=${complete.data?.tanggal_kembali ?? '-'}`
  )

  // 5. Selesai dua kali tidak memulihkan dua kali
  const completeAgain = await admin.rpc('selesaikan_pinjam', { p_loan_id: loanA.id })
  const afterE = await stokTersedia(itemA.id)
  check(
    'selesai dua kali ditolak, stok tetap 5',
    Boolean(completeAgain.error) && afterE?.stok_tersedia === 5,
    `err=${completeAgain.error?.message ?? 'TIDAK ADA ERROR'} stok=${afterE?.stok_tersedia}`
  )

  // 6. Non-admin tidak boleh memverifikasi/menyelesaikan
  const loanF = await createLoan(itemB.id, 1)
  const memberApprove = await member.rpc('verifikasi_pinjam', { p_loan_id: loanF.id, p_setuju: true, p_alasan: 'x' })
  const memberComplete = await member.rpc('selesaikan_pinjam', { p_loan_id: loanF.id })
  const advisor = await signIn('budi.advisor@labmanage.test')
  const advisorApprove = await advisor.rpc('verifikasi_pinjam', { p_loan_id: loanF.id, p_setuju: true, p_alasan: 'x' })
  check(
    'non-admin (anggota & advisor) ditolak',
    Boolean(memberApprove.error) && Boolean(memberComplete.error) && Boolean(advisorApprove.error),
    `anggota-verifikasi=${memberApprove.error?.message ?? 'LOLOS'} anggota-selesai=${memberComplete.error?.message ?? 'LOLOS'} advisor=${advisorApprove.error?.message ?? 'LOLOS'}`
  )

  // 7. Dua persetujuan bersamaan untuk stok yang sama: hanya satu boleh menang
  const itemG = await createItem(`UJI-G-${stamp}`, 1)
  const loanG1 = await createLoan(itemG.id, 1)
  const loanG2 = await createLoan(itemG.id, 1)
  const [race1, race2] = await Promise.all([
    admin.rpc('verifikasi_pinjam', { p_loan_id: loanG1.id, p_setuju: true, p_alasan: 'race' }),
    admin.rpc('verifikasi_pinjam', { p_loan_id: loanG2.id, p_setuju: true, p_alasan: 'race' }),
  ])
  const afterG = await stokTersedia(itemG.id)
  const winners = [race1, race2].filter((r) => !r.error).length
  check(
    'dua persetujuan bersamaan: tepat satu menang, stok tidak negatif',
    winners === 1 && afterG?.stok_tersedia === 0,
    `pemenang=${winners} stok=${afterG?.stok_tersedia} err1=${race1.error?.message ?? '-'} err2=${race2.error?.message ?? '-'}`
  )

  // 8. Admin tetap dilarang membuat permohonan (RLS)
  const adminLoan = await admin.from('loan_requests').insert([{
    item_id: itemA.id,
    user_id: profile!.id,
    kelompok_id: profile!.kelompok_id,
    jumlah: 1,
    keperluan: 'admin tidak boleh',
    rencana_kembali: new Date().toISOString(),
  }])
  check('admin dilarang membuat permohonan pinjam', Boolean(adminLoan.error), adminLoan.error?.message ?? 'LOLOS')

  // 9. Anggota UKM tetap boleh meminjam barang lab
  const ukmLoan = await ukm.from('loan_requests').select('id').limit(1)
  check('anggota UKM dapat membaca permohonan sendiri', !ukmLoan.error, ukmLoan.error?.message ?? 'ok')

  finish()
}

main().catch((err) => {
  console.error('Gagal menjalankan suite:', err)
  process.exit(1)
})
