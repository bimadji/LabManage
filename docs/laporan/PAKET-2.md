# Paket 2 — Autentikasi dan hak akses sungguhan: SEBAGIAN

Dikerjakan:

- `src/contexts/role-context.tsx` rewritten: sesi dari Supabase Auth (`supabase.auth.getSession()` + `onAuthStateChange`), role/kelompok/target jam dibaca dari tabel `profiles` milik user yang login. Tidak ada lagi `localStorage` sebagai sumber identitas. `currentUser` jadi `null` bila belum login. Ditambah `signIn`, `signOut`, `setDemoUser` (demo saja).
- `src/proxy.ts` (Next 16: `middleware` deprecated → `proxy`, dibuktikan dari `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`): belum login → redirect `/login?next=...`; `/monitoring` hanya admin & advisor, selain itu redirect ke beranda. Guard memakai `auth.getUser()` (validasi JWT server), bukan cookie tanpa cek.
- `src/lib/supabase/dal.ts`: `getSessionUser()` — sumber kebenaran identitas sisi server (server component), memakai `cache()`.
- `src/app/login/page.tsx`: halaman masuk berbahasa Indonesia (label, pesan error, `role="alert"`), `useSearchParams` dibungkus `Suspense` (dibutuhkan Next 16).
- `user_id` yang ditulis (presensi, pinjam, booking, laporan) memakai `currentUser.id` = `profiles.id` = `auth.users.id` = `auth.uid()`.
- Advisor = pantau saja: `review-request-sheet.tsx` menyembunyikan tombol Tolak/Setujui/Tandai Dikembalikan dan menampilkan catatan "Advisor hanya memantau". `kotak-masuk/page.tsx` untuk advisor menampilkan "Hanya Admin yang dapat memverifikasi", bukan tombol Tinjau.
- Admin tidak lagi melihat tombol "Ajukan Pinjam Barang" (banner + kartu item inventaris).
- `src/components/layout/app-shell.tsx`: sembunyikan shell saat belum login (tampilkan "Mengalihkan ke halaman masuk..." + tombol manual), `overlay-container.tsx` tidak mount sebelum ada sesi.
- `data-context` memuat data setelah `currentUser` tersedia, bukan saat mount.

Verifikasi asli (build + browser, DB uji lokal Supabase di 127.0.0.1:54521):

- `npx tsc --noEmit` → exit 0.
- `npm run lint` → `✖ 24 problems (6 errors, 18 warnings)`. 6 error: 3× `no-empty-object-type` (input.tsx 4:18, 24:18; textarea.tsx 4:18), `set-state-in-effect` (loan-request-sheet.tsx 39:7, home-banner.tsx 19:21). Semua milik Paket 5; **tidak ada** error `no-explicit-any` atau `set-state-in-effect` di role-context anymore.
- `NODE_OPTIONS=--max-old-space-size=2048 npx next build` → exit 0, rute: `/`, `/inventaris`, `/jadwal`, `/kotak-masuk`, `/login`, `/monitoring`, `ƒ Proxy (Middleware)`.
- Browser (Chromium headless):
  - `GET /monitoring` tanpa sesi → URL jadi `http://localhost:3132/login?next=%2Fmonitoring`.
  - Login `dimas.eros@labmanage.test` → `/`, banner "Selamat Pagi, Dimas!", kelompok tampil "Tim Riset EROS" (bukan "Umum" seperti sebelumnya).
  - Anggota buka `/monitoring` → dialihkan ke `/`.
  - Anggota `/inventaris`: "Ajukan Pinjam Barang" = true, "Tambah Barang Baru" = false, item DB tampil.
  - Klik "Keluar dari akun" → `/login`. Login `admin.lab@labmanage.test` → beranda admin ("Pak Ahmad").
  - Admin `/inventaris`: "Tambah Barang Baru" = true, "Ajukan Pinjam Barang" = false, "+ Stok" = true.
  - Admin `/monitoring` → tetap di `/monitoring`.
  - Login `budi.advisor@labmanage.test` → `/monitoring` tetap di `/monitoring`; `/kotak-masuk` menampilkan 11 permintaan dengan label "Hanya Admin yang dapat memverifikasi", "Tinjau Permohonan" = false.
  - Login `rina.robo@labmanage.test` → kartu "Status Kelompok: UKM Roboholic / Bebas Target Jam" tampil.

Belum beres:

- **Butir 5 Paket 2 sudah selesai di Paket 2b**: test otomatis per role tersedia — `scripts/test-role-matrix.ts` (44 pemeriksaan matriks PRD §3 di DB uji) + test komponen & guard server (`src/proxy.test.ts`, `src/app/inventaris/page.test.tsx`, `src/components/overlays/review-request-sheet.test.tsx`, `src/components/widgets/attendance-widget.test.tsx`). Lihat `docs/laporan/PAKET-2b.md`.
- `auth.users` untuk akun nyata belum dibuat (akun demo masih `password123`, hanya untuk DB uji).
- Halaman login belum punya "ingat saya"/reset kata sandi; belum diminta.
- Proxy tidak meng-hoist session ke cookie server secara manual (`@supabase/ssr` server client membaca cookie, jadi refresh token http-only ditangani library; sesi tetap valid setelah refresh — terverifikasi: login bertahan saat navigasi).

Butuh darimu:

1. Konfirmasi alur akun nyata: siapa yang membuat akun `auth.users` + `profiles` untuk staf/anggota, dan bagaimana kata sandi dibagikan. Saat ini seed demo (`scripts/seed-dummy.ts`) memakai `password123` dan hanya boleh untuk DB uji.
2. Pembatasan advisor "Hanya Admin yang dapat memverifikasi" ditampilkan sebagai teks, bukan tombol nonaktif. Setuju?

File: `src/contexts/role-context.tsx`, `src/proxy.ts`, `src/lib/supabase/dal.ts`, `src/app/login/page.tsx`, `src/components/layout/app-shell.tsx`, `src/components/overlays/review-request-sheet.tsx`, `src/app/kotak-masuk/page.tsx`, `src/app/inventaris/page.tsx`. Commit: `d804791`.

Skipped: `supabase auth` CLI (tidak ada), pengujian otomatis per role (Paket 6). Risiko: RLS tetap satu-satunya penegak hak akses data; guard UI bisa dilewati lewat developer tools, tapi server proxy + RLS menolak.
