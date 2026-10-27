# LabManage

Sistem Manajemen Laboratorium Robotika Politeknik Elektronika Negeri Surabaya (PENS).

Platform terpadu untuk pengelolaan fasilitas laboratorium, peminjaman inventaris riset, pencatatan presensi mingguan anggota tim riset (EROS & EIRA), serta reservasi arena uji coba dan bengkel fabrikasi bagi tim riset dan UKM Robotika Roboholic.

## Fitur Utama

- **Inventaris Terpadu**: Pemisahan visibilitas aset milik bersama laboratorium, aset khusus kelompok, dan aset yang dapat dipinjam lintas kelompok.
- **Peminjaman Alat**: Alur pengajuan dan persetujuan peminjaman komponen mikrokontroler, aktuator, dan sensor.
- **Presensi Tim Riset**: Timer sesi aktif dan pencatatan akumulasi jam riset mingguan terhadap target wajib 10 jam (khusus anggota tim riset).
- **Reservasi Fasilitas**: Pemesanan jadwal arena uji coba dan bengkel mekanik dengan pencegahan tabrakan jadwal (*anti-collision constraint*).
- **Monitoring & Evaluasi**: Dashboard rekapitulasi kehadiran mahasiswa dan utilisasi fasilitas khusus Admin Lab dan Advisor.

## Stack Teknologi

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide Icons, Recharts.
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Auth).
- **Client Supabase**: `@supabase/ssr`, `@supabase/supabase-js`.

## Menjalankan Proyek Lokal

1. Salin konfigurasi environment:
   ```bash
   cp .env.local.example .env.local # atau lengkapi nilai di .env.local
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Jalankan development server:
   ```bash
   npm run dev
   ```
4. Buka [http://localhost:3000](http://localhost:3000) pada browser.

## Skrip Basis Data

- Migrasi skema: `supabase/migrations/20261027_fase2_group_based_schema.sql`
- Seeder dummy: `npx tsx scripts/seed-dummy.ts`
- Pengujian RLS: `npx tsx scripts/test-rls.ts`
