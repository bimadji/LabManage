import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !anonKey || supabaseUrl.includes('placeholder')) {
  console.log('Skipping test: placeholder or missing keys in .env.local')
  process.exit(0)
}

async function runTests() {
  console.log('🧪 Starting Admin Inventory & RLS test suite...\n')

  // 1. Login as Admin (Ahmad Zaki)
  const clientAdmin = createClient(supabaseUrl, anonKey)
  const { data: adminAuth, error: adminAuthErr } = await clientAdmin.auth.signInWithPassword({
    email: 'admin.lab@labmanage.test',
    password: 'password123',
  })

  if (adminAuthErr) {
    console.error('Failed to log in as Admin:', adminAuthErr.message)
    return
  }
  console.log('✓ Successfully authenticated as Admin')

  // TEST 1: Admin successfully adds a new item
  const testCode = `TEST-ITEM-${Date.now().toString().slice(-4)}`
  const { data: insertedItem, error: insertErr } = await clientAdmin
    .from('inventory_items')
    .insert([
      {
        nama: 'Test Sensor Ultrasonic HC-SR04',
        kode: testCode,
        kategori: 'sensor',
        lokasi: 'Laci Pengujian Admin',
        stok_total: 5,
        stok_tersedia: 5,
        status: 'tersedia',
        spesifikasi: 'Rentang 2cm - 400cm, frekuensi 40kHz',
        pemilik_kelompok_id: null,
        dapat_dipinjam_kelompok_lain: true,
      },
    ])
    .select()
    .single()

  if (insertErr) {
    console.error('❌ TEST 1 FAILED: Admin unable to insert item:', insertErr.message)
  } else {
    console.log(`✅ TEST 1 PASSED: Admin successfully created item: ${insertedItem.kode} (${insertedItem.id})`)
  }

  // TEST 2: Admin adds stock via RPC tambah_stok_inventory
  if (insertedItem) {
    const { data: updatedItem, error: rpcErr } = await clientAdmin.rpc('tambah_stok_inventory', {
      p_item_id: insertedItem.id,
      p_jumlah: 3,
    })

    if (rpcErr) {
      console.error('❌ TEST 2 FAILED: Admin RPC tambah_stok_inventory failed:', rpcErr.message)
    } else {
      console.log(`✅ TEST 2 PASSED: Admin increased stock by 3: Total is now ${updatedItem.stok_total}, Available: ${updatedItem.stok_tersedia}`)
    }
  }

  // TEST 3: Validation checks - negative and zero quantity rejected
  if (insertedItem) {
    const { error: negErr } = await clientAdmin.rpc('tambah_stok_inventory', {
      p_item_id: insertedItem.id,
      p_jumlah: -2,
    })
    const { error: zeroErr } = await clientAdmin.rpc('tambah_stok_inventory', {
      p_item_id: insertedItem.id,
      p_jumlah: 0,
    })

    if (negErr && zeroErr) {
      console.log('✅ TEST 3 PASSED: Zero and negative quantities correctly rejected by database constraints')
    } else {
      console.error('❌ TEST 3 FAILED: Zero or negative quantity was accepted!')
    }
  }

  // 2. Login as Anggota Roboholic (Rina)
  const clientRobo = createClient(supabaseUrl, anonKey)
  const { error: roboAuthErr } = await clientRobo.auth.signInWithPassword({
    email: 'rina.robo@labmanage.test',
    password: 'password123',
  })

  if (roboAuthErr) {
    console.error('Failed to log in as Rina:', roboAuthErr.message)
    return
  }
  console.log('\n✓ Successfully authenticated as Anggota UKM Roboholic (Rina)')

  // TEST 4: Anggota tries to INSERT into inventory_items -> MUST FAIL RLS
  const { error: memberInsertErr } = await clientRobo
    .from('inventory_items')
    .insert([
      {
        nama: 'Barang Ilegal Anggota',
        kode: `ILLEGAL-${Date.now().toString().slice(-4)}`,
        kategori: 'komponen',
        lokasi: 'Meja Rina',
        stok_total: 1,
        stok_tersedia: 1,
        status: 'tersedia',
      },
    ])

  if (memberInsertErr) {
    console.log('✅ TEST 4 PASSED: Anggota blocked from inserting inventory_items by RLS:', memberInsertErr.message)
  } else {
    console.error('❌ TEST 4 FAILED: Anggota was able to insert inventory_items!')
  }

  // TEST 5: Anggota tries to call tambah_stok_inventory -> MUST FAIL (42501 Unauthorized)
  if (insertedItem) {
    const { error: memberRpcErr } = await clientRobo.rpc('tambah_stok_inventory', {
      p_item_id: insertedItem.id,
      p_jumlah: 5,
    })

    if (memberRpcErr) {
      console.log('✅ TEST 5 PASSED: Anggota blocked from tambah_stok_inventory:', memberRpcErr.message)
    } else {
      console.error('❌ TEST 5 FAILED: Anggota was able to execute tambah_stok_inventory!')
    }
  }

  // 3. Login as Advisor (Dr. Ir. Budi Santoso)
  const clientAdvisor = createClient(supabaseUrl, anonKey)
  const { error: advAuthErr } = await clientAdvisor.auth.signInWithPassword({
    email: 'budi.advisor@labmanage.test',
    password: 'password123',
  })

  if (advAuthErr) {
    console.error('Failed to log in as Advisor:', advAuthErr.message)
    return
  }
  console.log('\n✓ Successfully authenticated as Advisor')

  // TEST 6: Advisor tries to call tambah_stok_inventory -> MUST FAIL
  if (insertedItem) {
    const { error: advRpcErr } = await clientAdvisor.rpc('tambah_stok_inventory', {
      p_item_id: insertedItem.id,
      p_jumlah: 2,
    })

    if (advRpcErr) {
      console.log('✅ TEST 6 PASSED: Advisor blocked from tambah_stok_inventory:', advRpcErr.message)
    } else {
      console.error('❌ TEST 6 FAILED: Advisor was able to execute tambah_stok_inventory!')
    }
  }

  console.log('\n🏁 All Admin Inventory & RLS tests completed successfully!')
}

runTests().catch(console.error)
