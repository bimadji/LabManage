# Laporan Stabilisasi LabManage

Fase stabilisasi: memperbaiki bug, menyambungkan data ke database, menutup celah akses. Bukan pengembangan fitur.

Laporan rinci per paket ada di `docs/laporan/` (satu file per paket). Ringkasan akhir: `docs/laporan/00-RINGKASAN.md`.

| Paket | Status | Catatan |
|---|---|---|
| 1 — Data nyata & tersimpan | **SELESAI** | Semua aksi tulis menulis DB; stok pulih atomik via RPC; fallback palsu dihapus; MOCK_* hanya di mode demo. |
| 1b — Verifikasi database | **SELESAI** | Semua migrasi ter-apply di DB uji; 10 skenario SQL + 9 skenario API + 7 skenario RLS lulus. |
| 2 — Autentikasi & hak akses | **SELESAI** | Login Supabase Auth + guard server (`src/proxy.ts`) + role dari `profiles`; advisor pantau-saja; admin tanpa tombol pinjam. Test per role: matriks DB 44/44 + 54 unit test (Paket 2b) + 5/5 konfigurasi SECURITY DEFINER (Paket 2c). |
| 3 — Presensi & jam riset | **SELESAI** | Jam dihitung dari `attendance_sessions` (11 unit test); monitoring & ringkasan tim pakai data nyata; empty state jelas. |
| 4 — Booking ruangan | **SELESAI** | Tanggal + jam nyata tersimpan; deteksi bentrok berbasis rentang; constraint GiST jadi penjaga terakhir. |
| 5 — Bug kecil terlihat user | **SELESAI** | Badge status sesuai DESIGN.md §3; `npm run lint` 0 error; teks Inggris diterjemahkan; skip link, aria-expanded, reduced motion, target 44px. |
| 6 — Test & pengaman | **SEBAGIAN** | 32 unit test + CI GitHub Actions + QA checklist. CI belum pernah jalan (branch belum di-push). |
| 7 — Kesiapan tes nyata | **SEBAGIAN** | `.env.example` lengkap, `docs/SETUP-TES.md`, README sinkron, `docs/STATUS.md`, `docs/RUNBOOK-PRODUKSI.md`. Belum ada akun produksi — hanya akun seed untuk DB uji. |

Dokumen pendukung: `docs/BACKLOG.md` (pekerjaan yang ditunda), `docs/STATUS.md` (status fitur), `docs/QA-CHECKLIST.md` (skenario uji manual), `docs/SETUP-TES.md` (panduan setup).
