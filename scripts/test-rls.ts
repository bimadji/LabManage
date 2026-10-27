import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !anonKey || supabaseUrl.includes('placeholder')) {
  console.log('Skipping RLS test: placeholder or missing keys in .env.local')
  console.log('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to run live RLS tests.')
  process.exit(0)
}

async function runRlsTests() {
  console.log('🧪 Starting RLS verification test suite...')

  // 1. Sign in as Roboholic member (Rina)
  const clientRobo = createClient(supabaseUrl, anonKey)
  const { data: roboAuth, error: roboAuthErr } = await clientRobo.auth.signInWithPassword({
    email: 'rina.robo@labmanage.test',
    password: 'password123',
  })

  if (roboAuthErr) {
    console.error('Failed to log in as Roboholic user:', roboAuthErr.message)
    return
  }

  console.log('✓ Successfully authenticated as Rina (UKM Roboholic)')

  // Ambil profil Rina untuk mendapatkan kelompok_id
  const { data: rinaProfile } = await clientRobo
    .from('profiles')
    .select('kelompok_id')
    .eq('id', roboAuth.user.id)
    .single()

  // TEST 1: Roboholic user tries to insert into attendance_sessions -> MUST FAIL RLS
  const { error: attendErr } = await clientRobo.from('attendance_sessions').insert([
    {
      user_id: roboAuth.user.id,
      kelompok_id: rinaProfile?.kelompok_id,
      check_in: new Date().toISOString(),
    },
  ])

  if (attendErr) {
    console.log('✅ TEST 1 PASSED: UKM Roboholic blocked from attendance_sessions:', attendErr.message)
  } else {
    console.error('❌ TEST 1 FAILED: UKM Roboholic was able to insert attendance_sessions!')
  }

  // TEST 2: Roboholic member queries inventory items -> Should NOT see EROS internal items
  const { data: roboItems, error: itemsErr } = await clientRobo
    .from('inventory_items')
    .select('nama, kode, pemilik_kelompok_id, dapat_dipinjam_kelompok_lain')

  if (itemsErr) {
    console.error('Error fetching items as Roboholic:', itemsErr.message)
  } else {
    const hasPrivateEros = roboItems?.some((i) => i.kode === 'EROS-ACT-001')
    if (!hasPrivateEros) {
      console.log('✅ TEST 2 PASSED: Roboholic cannot see private EROS items (EROS-ACT-001 is filtered by RLS)')
    } else {
      console.error('❌ TEST 2 FAILED: Roboholic could see private EROS actuator!')
    }
  }

  // 2. Sign in as Tim Riset EROS member (Dimas)
  const clientEros = createClient(supabaseUrl, anonKey)
  const { data: erosAuth, error: erosAuthErr } = await clientEros.auth.signInWithPassword({
    email: 'dimas.eros@labmanage.test',
    password: 'password123',
  })

  if (erosAuthErr) {
    console.error('Failed to log in as EROS user:', erosAuthErr.message)
    return
  }

  console.log('✓ Successfully authenticated as Dimas (Tim Riset EROS)')

  // TEST 3: Tim Riset queries own attendance vs other user's attendance
  const { data: erosAttendance } = await clientEros.from('attendance_sessions').select('*')
  const onlyOwn = erosAttendance?.every((a) => a.user_id === erosAuth.user.id)

  if (onlyOwn) {
    console.log('✅ TEST 3 PASSED: Anggota Tim Riset only sees own attendance sessions')
  } else {
    console.error('❌ TEST 3 FAILED: Anggota Tim Riset saw attendance belonging to other members!')
  }

  console.log('🏁 All RLS tests completed!')
}

runRlsTests().catch(console.error)
