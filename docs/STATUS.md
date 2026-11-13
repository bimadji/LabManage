# Status Fitur — LabManage

Status jujur per fitur, berdasarkan kode + verifikasi DB uji lokal (Supabase CLI) per 2026-11-12.
Detail per paket: `docs/laporan/`. Item yang belum dikerjakan: `docs/BACKLOG.md`.

Legend: **Selesai** = ada di kode dan terverifikasi (DB nyata atau test otomatis) · **Sebagian** = ada tapi belum lengkap/terverifikasi · **Belum** = belum ada.

## Modul Inti

| Fitur | Status | Bukti / Catatan |
|---|---|---|
| Login Supabase Auth, role dari tabel `profiles` | Selesai | `src/contexts/role-context.tsx`, `src/app/login/page.tsx`; terverifikasi di browser (4 peran) |
| Guard server (proxy) untuk `/monitoring` + halaman needing login | Selesai | `src/proxy.ts`; test `src/proxy.test.ts` (5 test) |
| RLS PostgreSQL per peran (22 policy aktif) | Selesai | `supabase/migrations/`; `scripts/test-rls.ts` 7/7 + `scripts/test-role-matrix.ts` 44/44 + `scripts/verify-security-definer.sql` 5/5 lulus di DB uji |
| Inventaris: katalog, filter kepemilikan, tambah barang/stok atomik | Selesai | `supabase/migrations/20261027000200_*.sql` (RPC `tambah_stok_inventory`); `scripts/test-inventory-admin.ts` 9/9 lulus |
| Siklus pinjam: setujui / tolak / selesai + stok pulih atomik | Selesai | RPC `verifikasi_pinjam` & `selesaikan_pinjam`; `scripts/verify-loan-lifecycle.sql` 10/10 PASS |
| Booking ruang dengan rentang waktu nyata + deteksi bentrok | Selesai | `src/lib/rooms.ts`, constraint GiST di DB; terverifikasi via browser (booking tersimpan 13:30–17:30 WIB, booking duplikat ditolak) |
| Presensi: check-in/check-out, timer, jam mingguan dari DB | Selesai | `src/lib/attendance.ts`, `src/contexts/attendance-context.tsx`; 11 unit test |
| Monitoring: jam riset per anggota vs target, utilisasi ruangan, rekap | Selesai | `src/app/monitoring/page.tsx` (data nyata, empty state jelas) |
| Advisor memantau saja (tanpa aksi tulis) | Selesai | `review-request-sheet.tsx`, `kotak-masuk/page.tsx`; RLS menolak tulisan advisor |
| Admin tanpa tombol ajukan pinjam | Selesai | `src/app/inventaris/page.tsx` |
| Error jujur (tidak ada fallback "pura-pura sukses") | Selesai | `src/contexts/data-context.tsx`; test `src/contexts/data-context.test.tsx` (6 test) |
| Laporan kerusakan / stok habis | Sebagian | UI + kolom DB ada; belum ada halaman rekap khusus |
| Mode demo (data contoh, default mati) | Selesai | `src/lib/demo.ts`, banner "Mode Demo" |

## Infrastruktur & Kualitas

| Item | Status | Catatan |
|---|---|---|
| Type check (`npx tsc --noEmit`) | Selesai | 0 error |
| Lint (`npm run lint`) | Selesai | 0 error, 16 warning |
| Unit test (`npm run test`) | Selesai | 54 test, 9 file |
| Build produksi | Selesai | `NODE_OPTIONS=--max-old-space-size=4096` |
| CI GitHub Actions | Selesai | Branch `stabilisasi` ter-push (butuh scope `workflow` yang ditambahkan pemilik). Job `verify` & `db` **hijau**: run 43413682629. Perbaikan CI yang dikerjakan ada di `docs/laporan/PAKET-8B.md`. |
| TypeScript strict, tanpa `any` eksplisit | Selesai | 0 pelanggaran `no-explicit-any` |
| Aksesibilitas dasar (skip link, aria-expanded, focus ring, reduced motion, target 44px) | Selesai | `src/app/globals.css`, `app-shell.tsx`, `header.tsx` |
| one-click deploy (Vercel) | Belum | repo memakai branch `main` untuk deploy; branch `stabilisasi` belum di-deploy |

## Yang BELUM ada (fitur, bukan bug)

Rekap absensi bulanan, peringatan advisor, notifikasi anggota, koreksi sesi lupa check-out oleh admin, target jam dinamis — semuanya fitur dari rencana lama, sengaja tidak dikerjakan pada fase stabilisasi. Lihat `docs/BACKLOG.md`.

## Batasan yang masih ada (jujur)

1. **Tidak ada akun nyata** — yang tersedia hanya akun seed `password123` untuk DB uji. Cara membuat akun riil: `docs/SETUP-TES.md`.
2. **Tidak ada tabel `ruangan`** — identitas ruangan dijaga konstanta `src/lib/rooms.ts`; `room_bookings.ruangan_id` tetap `TEXT`.
3. **Agregasi absensi di sisi klien** — mengunduh seluruh sesi yang terlihat RLS; perlu view/RPC bila skala membesar.
4. **Data uji dari skrip tidak dibersihkan otomatis** — `scripts/test-inventory-admin.ts` menambah baris inventaris tiap dijalankan.
5. **Job CI untuk DB uji sudah terverifikasi hijau di runner GitHub** (run 43413682629). Catatan: butuh token dengan scope `workflow`; port 54524 (local_smtp) dimatikan di `supabase/config.toml` karena bentrok di runner.
6. **Widget "Ringkasan Tim" dan halaman Monitoring menghitung ulang di browser** — untuk data besar perlu agregasi di server.
7. **Tidak ada monitoring uptime** aplikasi di produksi.
8. **Durasi sesi dihitung per menit** — sesi < 30 detik tercatat 0 menit.
