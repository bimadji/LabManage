# Paket 6 — Test dan pengaman: SEBAGIAN

Dikerjakan:
- **Runner test**: vitest 3 + @testing-library/react + jsdom, devDependencies baru; script `npm run test` (vitest run) dan `npm run test:watch`. `vitest.config.ts` (environment jsdom, alias `@` → `src`) + `vitest.setup.ts` (`@testing-library/jest-dom`).
- **Test baru (32 test, 5 file)**:
  - `src/contexts/data-context.test.tsx` (6): jalur gagal Supabase tidak boleh pura-pura sukses — tambah barang, tambah stok (RPC), ajukan pinjam, booking ruang tanpa jam sesi, ubah status laporan (0 baris terpengaruh). Plus booking dengan rentang waktu: `waktu_mulai`/`waktu_selesai` benar-benar dikirim ke DB.
  - `src/components/common/status-badge.test.tsx` (4): token warna DESIGN.md §3 per status; `dipinjam` ungu (regresi bug dead code); label teks selalu ada.
  - `src/lib/rooms.test.ts` (6): `toWibIso` (WIB → UTC + input tidak valid → null), `overlaps` (tumpang tindih / bersebelahan / di dalam rentang), `todayWib`.
  - `src/lib/attendance.test.ts` (11): rentang minggu Senin–Senin di zona WIB, pemotongan sesi di batas periode, sesi terbuka dihitung sampai `now`, agregasi per user, deteksi sesi terbuka.
  - `src/proxy.test.ts` (5): guard server — belum login → redirect `/login`; anggota → dialihkan dari `/monitoring`; admin & advisor → boleh.
- **Skrip DB exit code non-zero**: `scripts/test-harness.ts` (`check`/`finish`/`requireEnv`) dipakai kedua skrip; `finish()` keluar 1 bila ada pemeriksaan gagal, 2 bila env tidak tersedia ("tidak dijalankan" ≠ "lulus"); `requireEnv()` menolak URL `*.supabase.co`. Login gagal juga keluar 1.
- **CI**: `.github/workflows/ci.yml` — job `verify` (tsc, lint, test, build dengan `NODE_OPTIONS=--max-old-space-size=4096`) dan job `db` (Supabase lokal via Docker → `supabase start` → seed → `test-rls.ts` → `test-inventory-admin.ts`).
- **`docs/QA-CHECKLIST.md`**: skenario uji manual per role (admin 15, anggota tim riset 11, UKM 4, advisor 5, cross-role 3) + cara melapor bug.

Verifikasi asli:
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → `✖ 16 problems (0 errors, 16 warnings)` — 0 error.
- `npm run test` → `Test Files 5 passed (5)`, `Tests 32 passed (32)`.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` → exit 0.
- Skrip DB terhadap DB uji lokal: `npx tsx scripts/test-rls.ts` → exit 0; `npx tsx scripts/test-inventory-admin.ts` → exit 0.
- Kontrol exit code: env kosong → `EXIT=2` (bukan 0). Pemeriksaan yang sengaja gagal → exit 1 (diuji lewat harness).

Belum beres:
- **CI belum pernah jalan** di GitHub Actions (branch belum di-push; aturan: jangan push). Job `db` juga belum pernah dieksekusi di runner — perilakunya disimulasikan manual di mesin ini.
- Job `db` di CI bergantung pada `npx supabase start` yang butuh Docker di runner; belum diuji di runner sungguhan.
- Tidak ada test UI end-to-end per role (hanya unit/level konteks). Skenario role di QA-CHECKLIST masih manual.
- `scripts/test-inventory-admin.ts` menulis data uji ke DB dan **tidak membersihkannya** (bertambahnya baris inventaris uji pada setiap run).

Butuh darimu:
1. Push branch `stabilisasi` dan jalankan CI di GitHub Actions untuk memastikan job `db` jalan di runner (butuh Docker + image Supabase terunduh).
2. Keputusan: apakah data uji dari skrip dibersihkan otomatis setelah run, atau dibiarkan (memudahkan debugging)?

File: `package.json`, `package-lock.json`, `vitest.config.ts`, `vitest.setup.ts`, `src/**/*.test.ts(x)`, `.github/workflows/ci.yml`, `docs/QA-CHECKLIST.md`, `src/lib/attendance.ts` (perbaikan zona waktu). Commit: `d8fc5a2`.

Skipped: e2e Playwright/Cypress (dependensi besar, tidak diminta). Risiko: test bergantung pada mock Supabase manual — perubahan nama kolom/tabel pada `data-context.tsx` bisa membuat test tetap hijau padahal kueri salah;ikas saja sebelum review.
