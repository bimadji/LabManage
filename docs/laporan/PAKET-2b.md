# Paket 2b — Test akses per role & pengaman seed: SELESAI

Dikerjakan:

- **Matriks hak akses di DB uji lokal** (`scripts/test-role-matrix.ts`, baru): 44 pemeriksaan turunan PRD §3 untuk 4 peran (admin, anggota tim riset, anggota UKM, advisor). Setiap aksi diuji boleh **dan** dilarang: ajukan pinjam, setujui/tolak/selesaikan pinjam (RPC), tambah barang, tambah stok (RPC), ubah status laporan, buat booking, check-in/out presensi, baca data kelompok lain. Termasuk penulisan atas nama user lain (pinjam, presensi, booking, laporan) dan user tanpa baris `profiles`.
- **Test komponen (vitest)**: `src/components/overlays/review-request-sheet.test.tsx` (advisor tidak melihat Setujui/Tolak/Tandai Dikembalikan), `src/app/inventaris/page.test.tsx` (admin tidak melihat "Ajukan Pinjam Barang", anggota tidak melihat "Tambah Barang Baru"), `src/components/widgets/attendance-widget.test.tsx` (anggota UKM tidak melihat Check-In).
- **`src/proxy.test.ts` diperluas**: 16 test — semua rute × (tanpa sesi, tanpa profil, tiap role).
- **Celah RLS nyata ditemukan & ditutup** (2 migrasi baru):
  - `20261113000100_fase5_profile_guard.sql`: helper `labmanage.has_profile()`; semua policy SELECT/INSERT/UPDATE/DELETE kini mewajibkan profil ada. User di `auth.users` tanpa baris `profiles` tidak bisa baca/tulis data apa pun. `attendance_sessions` hanya untuk anggota tim riset (sebelumnya admin/advisor bisa insert). `reports_update_policy` hanya Admin (sebelumnya anggota bisa ubah status laporan miliknya sendiri).
  - `20261113000200_fase6_rpc_role_guard.sql`: helper `labmanage.is_admin()` (NULL-safe) menggantikan `current_role() <> 'admin'` pada tiga RPC admin-only. Sebelumnya `current_role()` bernilai NULL untuk user tanpa profil sehingga pemeriksaan NULL **tidak menolak** → user tanpa profil bisa memanggil `tambah_stok_inventory`.
- **Guard server diperketat** (`src/proxy.ts`): user login tanpa baris `profiles` kini dialihkan ke `/login?alasan=belum-terdaftar` (sebelumnya lolos 200).
- **Pesan jelas untuk user tanpa profil**: `src/app/login/page.tsx` menampilkan "Akunmu belum didaftarkan oleh admin lab…" (dari query `alasan`); `signIn` di `role-context.tsx` juga menolak login yang profilnya tidak ada dengan pesan sama.
- **Pengaman seed**: `scripts/seed-dummy.ts` menolak URL non-lokal memakai helper `isLocalUrl()` dari `test-harness.ts` (keluar kode 2). `scripts/test-harness.test.ts` menguji helper itu (3 test). `vitest.config.ts` menyertakan `scripts/**/*.test.ts`.

Verifikasi asli:

- `npx tsx scripts/test-role-matrix.ts` → `44/44 lulus`, exit 0 (diulang 3× berturut-turut: 44/44, 44/44, 44/44).
- `npx vitest run` → `Test Files 9 passed (9)`, `Tests 54 passed (54)` (sebelumnya 32 test / 5 file).
- `npx vitest run src/proxy.test.ts` → `16 passed (16)`, exit 0.
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → `✖ 16 problems (0 errors, 16 warnings)` — 0 error.
- `npm run lint:md` → **0 error** (sebelumnya 1 error di `docs/TUGAS-STABILISASI.md`).
- Guard seed: `NEXT_PUBLIC_SUPABASE_URL=https://produksi.supabase.co npx tsx scripts/seed-dummy.ts` → `TOLAK: seed-dummy membuat akun demo berpassword lemah dan hanya boleh dijalankan pada Supabase lokal.` exit **2**.
- Migrasi ter-apply di DB uji: `npx supabase db reset` → 5 migrasi ter-apply (fase2, fase3, fase4, fase5, fase6), policy aktif = **22**.

Temuan selama pengerjaan:

1. **Celah RLS (tinggi)** — user tanpa `profiles` bisa memanggil RPC admin-only (`tambah_stok_inventory`) karena `current_role()` NULL membuat `NULL <> 'admin'` bernilai NULL, bukan TRUE. Diperbaiki dengan `labmanage.is_admin()`.
2. **Celah RLS (tinggi)** — policy baca yang longgar (`room_bookings_select_all` USING true, dsb.) tetap meloloskan user tanpa profil. Diperbaiki dengan `labmanage.has_profile()` di seluruh policy.
3. **Celah RLS (sedang)** — `attendance_sessions` mengizinkan admin & advisor insert karena policy tidak mengecek role. Diperbaiki: hanya `role = 'anggota'` + kelompok `tim_riset`.
4. **Celah RLS (sedang)** — `reports_update_policy` mengizinkan anggota mengubah status laporan sendiri (`status IN ('menunggu','selesai')`), bertentangan dengan PRD §3 (verifikasi = Admin). Diperbaiki: hanya Admin.
5. **Celah UI/guard (sedang)** — `src/proxy.ts` hanya mengecek `auth.getUser()`, jadi user tanpa profil lolos guard. Diperbaiki + pesan jelas.
6. **Bug versi migrasi (sedang)** — dua migrasi baru sama-sama berawalan `20261113` → CLI gagal `duplicate key value violates unique constraint "schema_migrations_pkey"`. Nama file diubah jadi `20261113000100`/`20261113000200`.
7. **Bug test (rendah)** — 3 asumsi test salah, bukan bug produk: booking 4 peran memakai slot jam sama (bentrok GiST legit); "barang privat" dibuat milik kelompok yang sama dengan pembaca sehingga boleh terbaca; sesi milik user lain tidak tersedia. Test diperbaiki (bukan dilonggarkan).
8. **Asumsi PRD dikoreksi** — advisor **boleh** mengajukan pinjam (PRD §3 "Pinjam Alat Lab & Barang Terbuka" = Ya); yang dilarang hanya verifikasi. Test awal sempat salah dan diperbaiki.

Belum beres:

- Tidak ada test UI end-to-end per role (hanya unit + level konteks + guard server). Skenario manual tetap pakai `docs/QA-CHECKLIST.md`.
- `scripts/test-role-matrix.ts` kini **membersihkan data uji** di akhir run (baris inventaris/booking/laporan/presensi uji). Slot booking memakai penanda menit jam proses supaya run berurutan tidak saling bentrok — terverifikasi 3× berturut-turut (`44/44 lulus`, exit 0).
- User tanpa profil diuji lewat satu akun (`tanpa-profil@labmanage.test`) yang dibuat skrip; tidak diuji untuk banyak akun sekaligus.
- Uji concurrency dua persetujuan bersamaan masih hanya di `scripts/test-inventory-admin.ts` (bukan di matriks role).

Butuh darimu:

1. ~~Keputusan: apakah `scripts/test-role-matrix.ts` boleh membersihkan data uji otomatis~~ — sudah dijawab: **ya, dibersihkan** (default aman).
2. Konfirmasi aturan laporan: anggota **tidak boleh** mengubah status laporan miliknya sendiri (koreksi policy ini mengubah perilaku lama PRD §3).

File: `scripts/test-role-matrix.ts`, `scripts/test-harness.ts`, `scripts/test-harness.test.ts`, `scripts/seed-dummy.ts`, `src/proxy.ts`, `src/proxy.test.ts`, `src/app/login/page.tsx`, `src/contexts/role-context.tsx`, `src/app/inventaris/page.test.tsx`, `src/components/overlays/review-request-sheet.test.tsx`, `src/components/widgets/attendance-widget.test.tsx`, `supabase/migrations/20261113000100_fase5_profile_guard.sql`, `supabase/migrations/20261113000200_fase6_rpc_role_guard.sql`, `vitest.config.ts`. Commit: `7f09e81`, `c59d5a0`.

Skipped: e2e Playwright/Cypress (dependensi besar, tidak diminta); tidak menjalankan skrip ke Supabase produksi. Risiko: matriks role bergantung pada PostgREST/GoTrue versi lokal — perilakunya di hosted belum diuji; policy `attendance_sessions` kini menutup admin/advisor (kalau nanti admin perlu mencatat kehadiran, harus pakai RPC terpisah).
