import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
  console.log('Skipping real Supabase connection: placeholder or missing keys in .env.local')
  console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local to execute seed against live Supabase.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seed() {
  console.log('🚀 Starting idempotent dummy data seeding...')

  // 1. Seed Kelompok
  const groups = [
    { nama: 'Tim Riset EROS', jenis: 'tim_riset', target_jam_mingguan: 10 },
    { nama: 'Tim Riset EIRA', jenis: 'tim_riset', target_jam_mingguan: 10 },
    { nama: 'Roboholic', jenis: 'ukm', target_jam_mingguan: null },
  ]

  const groupMap: Record<string, string> = {}

  for (const g of groups) {
    const { data, error } = await supabase
      .from('kelompok')
      .upsert({ nama: g.nama, jenis: g.jenis, target_jam_mingguan: g.target_jam_mingguan }, { onConflict: 'nama' })
      .select('id, nama')
      .single()

    if (error) {
      console.error(`Error inserting group ${g.nama}:`, error)
      continue
    }
    groupMap[g.nama] = data.id
    console.log(`✓ Kelompok: ${g.nama} (${data.id})`)
  }

  // 2. Seed Users & Profiles (domain: @labmanage.test)
  const users = [
    {
      email: 'admin.lab@labmanage.test',
      password: 'password123',
      nama: 'Ahmad Zaki Fauzan',
      nim: '198503152010121001',
      role: 'admin',
      kelompok: 'Tim Riset EROS',
    },
    {
      email: 'dimas.eros@labmanage.test',
      password: 'password123',
      nama: 'Dimas Aditya',
      nim: '3121500001',
      role: 'anggota',
      kelompok: 'Tim Riset EROS',
    },
    {
      email: 'farhan.eros@labmanage.test',
      password: 'password123',
      nama: 'Farhan Yudha',
      nim: '3121500002',
      role: 'anggota',
      kelompok: 'Tim Riset EROS',
    },
    {
      email: 'bayu.eira@labmanage.test',
      password: 'password123',
      nama: 'Bayu Setiawan',
      nim: '3121500015',
      role: 'anggota',
      kelompok: 'Tim Riset EIRA',
    },
    {
      email: 'rina.robo@labmanage.test',
      password: 'password123',
      nama: 'Rina Kusuma',
      nim: '3121500040',
      role: 'anggota',
      kelompok: 'Roboholic',
    },
    {
      email: 'doni.robo@labmanage.test',
      password: 'password123',
      nama: 'Doni Pratama',
      nim: '3121500041',
      role: 'anggota',
      kelompok: 'Roboholic',
    },
    {
      email: 'budi.advisor@labmanage.test',
      password: 'password123',
      nama: 'Dr. Ir. Budi Santoso, M.T.',
      nim: '197508202000031002',
      role: 'advisor',
      kelompok: 'Tim Riset EROS',
    },
  ]

  const userMap: Record<string, string> = {}

  // Ambil daftar user yang sudah ada terlebih dahulu agar idempoten
  const { data: existingUsersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingUsers = existingUsersData?.users || []

  for (const u of users) {
    let userId: string | undefined

    const found = existingUsers.find((x) => x.email?.toLowerCase() === u.email.toLowerCase())
    if (found) {
      userId = found.id
      // Update password & metadata agar selalu sinkron
      await supabase.auth.admin.updateUserById(userId, {
        password: u.password,
        email_confirm: true,
        user_metadata: { nama: u.nama, role: u.role, kelompok_id: groupMap[u.kelompok] },
      })
    } else {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { nama: u.nama, role: u.role, kelompok_id: groupMap[u.kelompok] },
      })

      if (authError) {
        console.error(`Failed to create auth user ${u.email}:`, authError)
        continue
      }
      userId = authUser?.user?.id
    }

    if (!userId) {
      console.error(`Could not resolve user ID for ${u.email}`)
      continue
    }

    userMap[u.email] = userId

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        nama: u.nama,
        nim: u.nim,
        role: u.role,
        kelompok_id: groupMap[u.kelompok],
        email: u.email,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error(`Error profile for ${u.email}:`, profileError)
    } else {
      console.log(`✓ Profile: ${u.nama} (${u.role}) -> ${u.email}`)
    }
  }

  // 3. Seed Inventory Items
  const items = [
    // Lab owned (pemilik_kelompok_id null)
    {
      nama: 'Jetson Orin Nano Developer Kit',
      kode: 'LAB-JON-001',
      kategori: 'mikrokontroler',
      lokasi: 'Lemari A1 (Komputasi)',
      stok_total: 2,
      stok_tersedia: 2,
      status: 'tersedia',
      spesifikasi: '8GB RAM, 40 TOPS AI compute, fan included',
      pemilik: null,
      dapat_dipinjam_kelompok_lain: true,
    },
    {
      nama: 'Osiloskop Digital Rigol DS1054Z',
      kode: 'LAB-OSC-002',
      kategori: 'perkakas',
      lokasi: 'Meja Kalibrasi 2',
      stok_total: 1,
      stok_tersedia: 1,
      status: 'tersedia',
      spesifikasi: '50MHz 4-channel, 1GSa/s real-time sample rate',
      pemilik: null,
      dapat_dipinjam_kelompok_lain: true,
    },
    {
      nama: 'Soldering Station Hakko FX-888D',
      kode: 'LAB-SLD-003',
      kategori: 'perkakas',
      lokasi: 'Meja Solder Utama',
      stok_total: 3,
      stok_tersedia: 3,
      status: 'tersedia',
      spesifikasi: 'Digital soldering iron 70W temperature controlled',
      pemilik: null,
      dapat_dipinjam_kelompok_lain: true,
    },
    {
      nama: 'Power Supply DC Matrix 30V 5A',
      kode: 'LAB-PWR-004',
      kategori: 'perkakas',
      lokasi: 'Rak B2 (Alat Ukur)',
      stok_total: 2,
      stok_tersedia: 1,
      status: 'tersedia',
      spesifikasi: 'Adjustable DC regulated benchtop power supply',
      pemilik: null,
      dapat_dipinjam_kelompok_lain: true,
    },
    // EROS owned
    {
      nama: 'Dynamixel MX-64AT Actuator',
      kode: 'EROS-ACT-001',
      kategori: 'actuator',
      lokasi: 'Box Khusus EROS A',
      stok_total: 12,
      stok_tersedia: 10,
      status: 'tersedia',
      spesifikasi: 'Aluminium front case, magnetic encoder 12-bit, TTL protocol',
      pemilik: 'Tim Riset EROS',
      dapat_dipinjam_kelompok_lain: false, // EROS internal only
    },
    {
      nama: 'Kamera Stereo Stereolabs ZED 2i',
      kode: 'EROS-CAM-002',
      kategori: 'sensor',
      lokasi: 'Lemari EROS B3',
      stok_total: 1,
      stok_tersedia: 1,
      status: 'tersedia',
      spesifikasi: 'IP66 stereo camera, neural depth sensing, IMU integrated',
      pemilik: 'Tim Riset EROS',
      dapat_dipinjam_kelompok_lain: true, // Shared with other groups
    },
    // EIRA owned
    {
      nama: 'LiDAR Slamtec RPLIDAR S2',
      kode: 'EIRA-LID-001',
      kategori: 'sensor',
      lokasi: 'Box Proyek EIRA 1',
      stok_total: 2,
      stok_tersedia: 2,
      status: 'tersedia',
      spesifikasi: '30m range DTOF, 32K sample rate, IP65 enclosure',
      pemilik: 'Tim Riset EIRA',
      dapat_dipinjam_kelompok_lain: false,
    },
    {
      nama: 'Omron Industrial Optical Sensor Kit',
      kode: 'EIRA-SNS-002',
      kategori: 'sensor',
      lokasi: 'Loker EIRA C',
      stok_total: 4,
      stok_tersedia: 3,
      status: 'tersedia',
      spesifikasi: 'E3Z-T61 photoelectric through-beam sensor kit with brackets',
      pemilik: 'Tim Riset EIRA',
      dapat_dipinjam_kelompok_lain: true,
    },
    // UKM Roboholic owned
    {
      nama: 'Chassis Aluminium Omniwheel Base',
      kode: 'ROBO-CHS-001',
      kategori: 'actuator',
      lokasi: 'Rak UKM Roboholic 1',
      stok_total: 3,
      stok_tersedia: 3,
      status: 'tersedia',
      spesifikasi: '3-wheel omni directional laser cut 3mm aluminium frame',
      pemilik: 'Roboholic',
      dapat_dipinjam_kelompok_lain: false,
    },
    {
      nama: 'Motor DC Planetary PG45 dengan Encoder',
      kode: 'ROBO-MTR-002',
      kategori: 'actuator',
      lokasi: 'Rak UKM Roboholic 2',
      stok_total: 6,
      stok_tersedia: 4,
      status: 'tersedia',
      spesifikasi: '12V DC, 1:19.2 gear ratio, 350 RPM with Hall encoder',
      pemilik: 'Roboholic',
      dapat_dipinjam_kelompok_lain: true,
    },
    {
      nama: 'Filament 3D Printer PLA+ eSun',
      kode: 'ROBO-FIL-003',
      kategori: 'komponen',
      lokasi: 'Meja 3D Print Roboholic',
      stok_total: 5,
      stok_tersedia: 0,
      status: 'habis',
      spesifikasi: '1.75mm 1kg spool black / white PLA+ high toughness',
      pemilik: 'Roboholic',
      dapat_dipinjam_kelompok_lain: false,
    },
  ]

  const itemMap: Record<string, string> = {}

  for (const item of items) {
    const { data, error } = await supabase
      .from('inventory_items')
      .upsert(
        {
          nama: item.nama,
          kode: item.kode,
          kategori: item.kategori,
          lokasi: item.lokasi,
          stok_total: item.stok_total,
          stok_tersedia: item.stok_tersedia,
          status: item.status,
          spesifikasi: item.spesifikasi,
          pemilik_kelompok_id: item.pemilik ? groupMap[item.pemilik] : null,
          dapat_dipinjam_kelompok_lain: item.dapat_dipinjam_kelompok_lain,
        },
        { onConflict: 'kode' }
      )
      .select('id, kode')
      .single()

    if (error) {
      console.error(`Error item ${item.kode}:`, error)
      continue
    }
    itemMap[item.kode] = data.id
    console.log(`✓ Item: ${item.kode} - ${item.nama}`)
  }

  // 4. Seed Attendance Sessions (Tim Riset only)
  const now = new Date()
  const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const d2 = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  if (userMap['dimas.eros@labmanage.test']) {
    await supabase.from('attendance_sessions').insert([
      {
        user_id: userMap['dimas.eros@labmanage.test'],
        kelompok_id: groupMap['Tim Riset EROS'],
        check_in: new Date(d2.setHours(9, 0, 0, 0)).toISOString(),
        check_out: new Date(d2.setHours(15, 30, 0, 0)).toISOString(),
      },
      {
        user_id: userMap['dimas.eros@labmanage.test'],
        kelompok_id: groupMap['Tim Riset EROS'],
        check_in: new Date(d1.setHours(10, 0, 0, 0)).toISOString(),
        check_out: new Date(d1.setHours(16, 0, 0, 0)).toISOString(),
      },
    ])
    console.log('✓ Attendance seeded for Dimas (EROS)')
  }

  if (userMap['farhan.eros@labmanage.test']) {
    await supabase.from('attendance_sessions').insert([
      {
        user_id: userMap['farhan.eros@labmanage.test'],
        kelompok_id: groupMap['Tim Riset EROS'],
        check_in: new Date(d1.setHours(13, 0, 0, 0)).toISOString(),
        check_out: new Date(d1.setHours(19, 0, 0, 0)).toISOString(),
      },
    ])
    console.log('✓ Attendance seeded for Farhan (EROS)')
  }

  if (userMap['bayu.eira@labmanage.test']) {
    await supabase.from('attendance_sessions').insert([
      {
        user_id: userMap['bayu.eira@labmanage.test'],
        kelompok_id: groupMap['Tim Riset EIRA'],
        check_in: new Date(d2.setHours(8, 0, 0, 0)).toISOString(),
        check_out: new Date(d2.setHours(18, 0, 0, 0)).toISOString(),
      },
    ])
    console.log('✓ Attendance seeded for Bayu (EIRA)')
  }

  // 5. Seed Room Bookings
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (userMap['dimas.eros@labmanage.test']) {
    await supabase.from('room_bookings').insert([
      {
        ruangan_id: 'arena-kontes',
        nama_ruangan: 'Arena Lapangan Kontes',
        user_id: userMap['dimas.eros@labmanage.test'],
        kelompok_id: groupMap['Tim Riset EROS'],
        waktu_mulai: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
        waktu_selesai: new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString(),
        keperluan: 'Uji Coba Dribbling & Navigasi Robot Humanoid',
        jumlah_peserta: 6,
        status: 'aktif',
      },
    ])
    console.log('✓ Room booking seeded for EROS')
  }

  // 6. Seed Loan Requests
  if (userMap['bayu.eira@labmanage.test'] && itemMap['LAB-OSC-002']) {
    await supabase.from('loan_requests').insert([
      {
        item_id: itemMap['LAB-OSC-002'],
        user_id: userMap['bayu.eira@labmanage.test'],
        kelompok_id: groupMap['Tim Riset EIRA'],
        jumlah: 1,
        keperluan: 'Debugging encoder motor dan serial communication bus',
        rencana_kembali: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'disetujui',
      },
    ])
    console.log('✓ Loan request seeded for Bayu')
  }

  console.log('🎉 Seeding completed successfully!')
}

seed().catch((err) => {
  console.error('Fatal seed error:', err)
  process.exit(1)
})
