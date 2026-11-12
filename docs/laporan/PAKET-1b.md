# Paket 1b — Verifikasi database: SELESAI

Dikerjakan:
- Migrasi `20261027000100_fase2_group_based_schema.sql`, `20261027000200_fase3_admin_inventory_management.sql`, `20261112_fase4_loan_lifecycle.sql` diterapkan ke DB uji lokal (Supabase CLI, container `supabase_db_LabManageV3`).
- **Perbaikan blocker:** dua migrasi lama sama-sama berawalan `20261027`, jadi CLI gagal: `duplicate key value violates unique constraint "schema_migrations_pkey" ... Key (version)=(20261027) already exists`. Nama file diganti menjadi `20261027000100_...` dan `20261027000200_...` (isi file tidak diubah). Setelah itu ketiga migrasi ter-applies berurutan.
- Skenario siklus pinjam dijalankan di DB nyata lewat `scripts/verify-loan-lifecycle.sql` (9 skenario) dan `scripts/test-inventory-admin.ts` (9 skenario lewat PostgREST + RLS nyata).
- `scripts/test-rls.ts` dan `scripts/test-inventory-admin.ts` rewritten: pakai `scripts/test-harness.ts` (helper `check`/`finish`/`requireEnv`), keluar dengan kode non-zero saat gagal, dan menolak URL `*.supabase.co` (hanya DB uji lokal).
- PRD §4.2 diperbarui: stok dipotong saat **disetujui**, penolakan tidak mengubah stok, selesai memulihkan stok secara atomik + `tanggal_kembali`.
- README: nama file migrasi diperbarui + migrasi fase 4 ditambahkan.

Verifikasi asli:
- `npx supabase start` → `Applying migration 20261027000100_fase2_group_based_schema.sql... / 20261027000200_fase3_admin_inventory_management.sql... / 20261112_fase4_loan_lifecycle.sql...` (ketiganya sukses).
- Versi lama (sebelum rename) gagal: `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505) Key (version)=(20261027) already exists`.
- Migrasi diulang (idempoten) pada DB yang sama → ketiganya `OK` tanpa error.
- `psql -f scripts/verify-loan-lifecycle.sql` → 10/10 PASS, exit 0:
  - `1. setuju stok cukup` → `status=disetujui stok=3 (harap disetujui/3)`
  - `2. setuju stok kurang ditolak` → `err="Stok tersedia tidak mencukupi: tersisa 1 unit, diminta 3 unit" stok=1 status=menunggu`
  - `3. tolak tidak mengubah stok` → `status=ditolak stok=3`
  - `4. selesai memulihkan stok` → `status=selesai stok=5 tanggal=2026-11-12 18:54:00.12615+00`
  - `5. selesai dua kali ditolak` → `err="Hanya peminjaman berstatus disetujui yang dapat diselesaikan" stok=5 (harus tetap 5)`
  - `6. non-admin ditolak` → `err="Akses ditolak: hanya admin laboratorium yang dapat memverifikasi peminjaman"`
  - `6b. non-admin tidak bisa selesaikan` → `err="Akses ditolak: hanya admin laboratorium yang dapat menutup peminjaman"`
  - `7. status rusak tidak berubah` → `stok=1 status=rusak`
  - `8. SECURITY DEFINER + search_path` → `selesaikan_pinjam:def=true,sp=search_path=public, pg_temp | tambah_stok_inventory:def=true,... | verifikasi_pinjam:def=true,...`
  - `9. GRANT EXECUTE authenticated` → `selesaikan_pinjam=true | tambah_stok_inventory=true | verifikasi_pinjam=true`
- `npx tsx scripts/test-rls.ts` → `7/7 lulus`, exit 0.
- `npx tsx scripts/test-inventory-admin.ts` → `9/9 lulus`, exit 0, termasuk `dua persetujuan bersamaan: tepat satu menang, stok tidak negatif — pemenang=1 stok=0 err2=Stok tersedia tidak mencukupi: tersisa 0 unit, diminta 1 unit` dan `admin dilarang membuat permohonan pinjam — new row violates row-level security policy for table "loan_requests"`.
- Kontrol exit code: pemeriksaan yang sengaja gagal → exit 1; env tidak ada → exit 2 (`SKIP`, bukan lulus).
- `npx tsc --noEmit` → exit 0. `npm run lint` → 19 problems (7 errors, 12 warnings), semua pre-existing.

Belum beres:
- Skrip uji menulis ke DB uji lokal; di DB produksi **belum pernah dijalankan** dan tidak boleh dijalankan (harness menolak URL `*.supabase.co`).
- Renaming migrasi: environment yang sudah pernah menerapkan versi `20261027` akan mencatat versi baru di `schema_migrations`; migrasi bersifat idempoten jadi aman, tapi baris versi lama tetap tertinggal.

Butuh darimu:
1. Konfirmasi aturan stok (dipotong saat disetujui) — sudah diterapkan sesuai keputusan default, tapi tetap perlu konfirmasi karena mengubah semantik PRD.

File: `scripts/verify-loan-lifecycle.sql`, `scripts/test-harness.ts`, `scripts/test-rls.ts`, `scripts/test-inventory-admin.ts`, `supabase/migrations/`, `docs/PRD.md`, `README.md`. Commit: lihat git log branch `stabilisasi`.

Skipped: `supabase db push` ke project remote (production) — tidak diizinkan. Risiko: DB uji memakai Supabase lokal, sehingga perilaku `auth.uid()` dan GoTrue sedikit berbeda dari Supabase hosted (perbedaan tidak terdeteksi pada skenario yang diuji).
