# TUGAS PRODUKSI LabManage (Paket 8)

Repo: bimadji/LabManage, branch kerja `stabilisasi`. Baca seluruh file ini sebelum mulai.

Stabilisasi (Paket 1 sampai 2c) sudah selesai dan teruji di Supabase lokal. Sekarang pemilik repo mengizinkan empat hal, dan hanya empat hal ini:

1. Menyediakan tabel roster akun di database, supaya pemilik bisa mengisi sendiri siapa saja akunnya.
2. Push branch `stabilisasi` ke GitHub.
3. Menerapkan migrasi ke Supabase produksi.
4. Deploy ke Vercel (preview dulu, lalu produksi).

Izin ini mengubah aturan lama ("jangan push, jangan sentuh produksi") HANYA untuk langkah yang tertulis di file ini. Semua larangan lain tetap berlaku: tidak ada fitur baru, tidak ada perubahan desain, tidak ada secret di repo.

## Mode kerja

1. Muat skill `ponytail` sebelum menulis atau mengubah kode apa pun (aplikasi, SQL, skrip, test, workflow). Kalau tidak bisa dimuat, berhenti dan laporkan.
2. Tulis laporan dengan skill `caveman` di `docs/laporan/PAKET-8.md`, format sama seperti laporan paket sebelumnya (Dikerjakan, Verifikasi asli, Belum beres, Butuh darimu, File dan commit, Skipped dan risiko). Satu bagian per fase (A, B, C, D) dengan status SELESAI, SEBAGIAN, atau BELUM. Perbarui tabel status di `docs/STABILISASI_REPORT.md` dan `docs/laporan/00-RINGKASAN.md`.
3. Kerjakan fase berurutan A, B, C, D. Setiap fase punya GATE. Kalau sebuah GATE gagal, JANGAN memaksa: berhenti di fase itu, tulis keadaan persis, tulis langkah manual untuk pemilik (perintah siap jalan, tanpa secret), tandai fase itu dan fase yang bergantung padanya sebagai BELUM, lalu tulis laporan.
4. Setiap klaim butuh bukti nyata (perintah dan output asli). Jangan menulis hasil perintah yang tidak kamu jalankan. Status SELESAI hanya untuk yang terverifikasi.

## Kredensial (aturan keras)

- Pakai HANYA kredensial yang disiapkan pemilik di `.env.production.local` (di root repo) atau CLI yang sudah login (`supabase`, `vercel`, `gh`, git remote). Sebelum membaca file env itu, pastikan `git check-ignore -v .env.production.local` menunjukkan file itu diabaikan git. Kalau tidak diabaikan, tambahkan ke `.gitignore` dan commit dulu.
- Variabel yang diharapkan di `.env.production.local`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `PROD_SUPABASE_URL`, `PROD_SUPABASE_ANON_KEY`, `PROD_SUPABASE_SERVICE_ROLE_KEY`, dan opsional `VERCEL_TOKEN`.
- JANGAN mencari kredensial di tempat lain (`.env.local` lama, history git, folder lain). Kalau ada yang tidak tersedia, lewati langkah yang membutuhkannya dan tulis perintahnya untuk pemilik.
- `PROD_SUPABASE_SERVICE_ROLE_KEY` hanya boleh dipakai skrip provisioning yang berjalan lokal. JANGAN pernah memasukkannya ke Vercel, repo, log, laporan, atau output terminal.
- Jangan mencetak nilai secret apa pun. Redaksi dengan `***` di laporan dan log.

## Larangan mutlak (produksi)

Tidak boleh: `--force`, `--no-verify`, `git reset --hard`, rewrite history, `supabase db reset --linked`, `supabase db push --include-all` tanpa dry-run bersih dan alasan tertulis, `DROP`, `TRUNCATE`, atau `DELETE` terhadap data produksi, mengedit tabel `schema_migrations` (itu Jalur B di runbook, khusus pemilik), menjalankan `seed-dummy.ts`, `test-rls.ts`, `test-inventory-admin.ts`, `test-role-matrix.ts`, `verify-loan-lifecycle.sql`, atau `verify-security-definer.sql` ke produksi (harness menolak URL `*.supabase.co`; jangan dilonggarkan), membuat data uji di produksi, atau "memperbaiki" masalah produksi dengan SQL manual. Kalau terjadi hal tak terduga di produksi: berhenti, laporkan keadaan persis dan opsi rollback dari backup.

## Fase A: Tabel roster akun (kerjakan dan uji di DB lokal)

Tujuan: pemilik mengisi daftar akun di tabel database lewat Supabase Dashboard (Table Editor), lalu satu skrip lokal mengubah baris itu menjadi akun login sungguhan.

1. Baca skema `profiles` dan `kelompok` dari migrasi yang ada supaya kolom dan enum roster cocok.
2. Migrasi baru `supabase/migrations/20261114000100_fase7_daftar_akun.sql` (nama unik, jangan edit migrasi lama, idempoten seperti migrasi lain): tabel `public.daftar_akun` dengan kolom `email` (unik, disimpan huruf kecil), `nama_lengkap`, `nim` (boleh kosong), `role` (enum role yang sama dengan `profiles`), `kelompok` (nama kelompok sebagai teks, boleh kosong untuk admin dan advisor sesuai aturan `profiles`), `status` (`menunggu`, `dibuat`, `gagal`; default `menunggu`), `user_id` (kosong sampai akun dibuat), `catatan`, `dibuat_pada`, `diperbarui_pada`. Aktifkan RLS TANPA policy untuk `anon` dan `authenticated`, dan `REVOKE ALL` dari keduanya. Artinya hanya Dashboard dan service role yang bisa menyentuh tabel ini; email calon pengguna tidak bocor lewat aplikasi. Tabel dibiarkan KOSONG. Jangan mengarang akun.
3. Skrip `scripts/provision-akun.ts`:
   - Default adalah dry-run: cetak rencana (email, role, kelompok, tanpa password) lalu keluar. Eksekusi nyata hanya dengan `--apply`.
   - Target default lokal. Target hosted wajib `--remote` dan memakai variabel `PROD_*`; tanpa `--remote` skrip menolak URL non-lokal (pakai `isLocalUrl()` dari `test-harness.ts`), dengan `--remote` skrip menolak URL lokal. Cetak host/project ref target sebelum bertindak.
   - Untuk tiap baris berstatus `menunggu`: buat user Auth lewat admin API (`email_confirm: true`) dengan password acak kuat (minimal 20 karakter, dari `crypto`), buat baris `profiles` (id = id user Auth, role, kelompok, nama, nim), lalu set `daftar_akun.status = 'dibuat'` dan isi `user_id`.
   - Idempoten: kalau email sudah ada di Auth, jangan buat ulang; sinkronkan profil bila hilang. Kegagalan satu baris (mis. kelompok tidak ditemukan) tidak menghentikan baris lain; baris itu jadi `gagal` dengan catatan singkat. Jangan membuat kelompok karangan di produksi.
   - Password ditulis HANYA ke `akun-kredensial.local.csv` (email, password) di root repo, permission 600, dan file itu harus ada di `.gitignore` (verifikasi dengan `git check-ignore`). Password tidak boleh muncul di stdout, log, atau laporan.
   - Catatan jujur untuk dokumentasi: aplikasi belum punya fitur ganti kata sandi (sudah ada di BACKLOG); jangan menambah fiturnya. Password acak dibagikan pemilik lewat kanal aman, dan penggantian lewat Dashboard bila perlu.
4. Uji di DB lokal: `supabase db reset`, isi `daftar_akun` dengan 4 baris uji (admin, anggota tim riset, anggota UKM, advisor) ditambah 1 baris dengan kelompok yang tidak ada. Buktikan: dry-run tidak menulis apa pun; `--apply` membuat 4 akun dan 1 baris `gagal`; login API dengan password dari CSV berhasil untuk tiap akun; profil sesuai; menjalankan ulang tidak membuat duplikat; password tidak ada di stdout; `daftar_akun` tidak bisa dibaca dengan anon key dan dengan token user biasa (hasil 401/403 atau kosong). Bersihkan baris dan akun uji setelahnya.
5. Test unit (vitest) untuk bagian murni: pembuat password (panjang, karakter acak, tidak ada dua yang sama dalam 1000 percobaan), normalisasi email, guard URL.
6. Perbarui `docs/SETUP-TES.md`, `docs/RUNBOOK-PRODUKSI.md`, dan `README.md` (alur baru: isi tabel di Dashboard, dry-run, apply; daftar migrasi jadi enam; hitung ulang jumlah policy dari `pg_policies`).
7. Jalankan ulang dari `supabase db reset`: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run lint:md`, `npm run build` (NODE_OPTIONS secukupnya), dan semua skrip DB lokal. Commit per butir.

GATE A: semua hijau dan butir 4 terbukti. Kalau tidak, berhenti.

## Fase B: Push branch

1. Prasyarat: `git status` bersih. Cari secret ter-commit: `git ls-files` untuk file `.env*` (hanya `.env.example` yang boleh), `.local.csv` tidak ter-track, dan `grep` untuk pola `service_role`, `eyJ`, `sb_secret`, `password` selain `password123` milik seed lokal.
2. `git push -u origin stabilisasi` (tanpa `--force`). JANGAN merge ke `main` di fase ini. Kalau push ditolak, jangan paksa; laporkan.
3. Pantau CI (`gh run list` dan `gh run watch`, atau API GitHub bila `gh` tidak ada). Kalau merah: baca log, perbaiki dengan commit baru, push lagi, maksimal 3 siklus. Job `db` mungkin gagal karena port atau Docker di runner; periksa `supabase/config.toml` dan `.github/workflows/ci.yml` dulu.
4. Catat hasil CI di laporan: job apa yang hijau atau merah, link run.

GATE B: push berhasil. Status CI hijau adalah syarat untuk deploy produksi (D4), bukan untuk Fase C.

## Fase C: Migrasi Supabase produksi

Baca ulang `docs/RUNBOOK-PRODUKSI.md` dan ikuti persis. Verifikasi flag CLI lewat `npx supabase ... --help` sebelum dipakai.

1. Hubungkan: `supabase link --project-ref $SUPABASE_PROJECT_REF`. Pastikan project ref itu BUKAN stack lokal dan cocok dengan `PROD_SUPABASE_URL`. Kalau ragu, berhenti.
2. Cek read-only keadaan remote: `migration list` lokal vs remote; daftar tabel di schema `public`; jumlah baris per tabel; ada tidaknya versi `20261027` lama di `schema_migrations`.
3. BACKUP sebelum perubahan apa pun: `supabase db dump --remote` ke `backups/prod-<cap-waktu>.sql` (folder harus diabaikan git; verifikasi). Periksa file tidak kosong dan memuat `CREATE TABLE` atau `COPY`. Tanpa backup valid, berhenti.
4. Klasifikasikan remote: (a) belum ada skema aplikasi: lanjut. (b) sudah ada versi migrasi lama `20261027`: pakai HANYA Jalur A runbook (apply ulang idempoten) dan hanya jika `db push --dry-run` bersih dari statement yang menghapus atau merusak data; Jalur B jangan dipakai. (c) skema tak dikenal, tabel berisi data yang bertentangan, atau drift: berhenti dan laporkan.
5. `supabase db push --dry-run`, baca seluruh outputnya dan catat migrasi apa saja yang akan jalan. Lalu `supabase db push`. Hanya migrasi dari repo, urutan sesuai nama file.
6. Verifikasi pasca-migrasi (read-only): `migration list` sinkron; jumlah policy sama dengan DB lokal hasil reset; semua tabel `public` ber-RLS; fungsi `has_profile`, `is_admin`, `verifikasi_pinjam`, `selesaikan_pinjam`, `tambah_stok_inventory` ada dan `SECURITY DEFINER` dengan `search_path` terkunci; tabel `daftar_akun` tidak terbaca oleh anon key.
7. Auth hosted: matikan sign-up publik (Dashboard, Authentication, Sign In / Providers, "Allow new users to sign up"). Kalau tidak bisa dilakukan lewat CLI atau API dengan kredensial yang ada, tulis sebagai langkah pemilik; jangan menebak endpoint Management API (verifikasi dokumentasinya dulu lewat WebFetch). Setelah domain Vercel diketahui (Fase D), langkah pemilik berikutnya: isi Site URL dan Redirect URLs dengan domain itu.
8. Akun produksi: tabel `daftar_akun` produksi sekarang ada tapi kosong. Kalau saat fase ini berjalan ada baris `menunggu` yang diisi pemilik: jalankan dry-run (`--remote`) dulu, dan `--apply` hanya jika semua baris valid. Kalau kosong: tulis di laporan bahwa pemilik tinggal mengisi tabel lalu menjalankan `npx tsx scripts/provision-akun.ts --remote` (dry-run) dan `... --remote --apply`.

GATE C: backup valid, dry-run bersih, migrasi tersinkron, verifikasi butir 6 lulus.

## Fase D: Deploy Vercel

1. Cek proyek: `vercel whoami`, dan `vercel link` ke proyek LabManage yang benar (cek folder `.vercel`). Kalau tidak ada proyek yang cocok atau ada keraguan, berhenti dan beri instruksi; jangan membuat proyek baru.
2. Env var di Vercel untuk Preview dan Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (nama persis sesuai kode di `src/lib/supabase`), dan `NEXT_PUBLIC_DEMO_MODE=false`. Cek dengan `vercel env ls`, tambahkan yang kurang. Pastikan kunci yang dipakai adalah anon key (periksa klaim `role` pada JWT tanpa mencetak tokennya). JANGAN memasukkan service role. Jika build kehabisan memori di Vercel, tambahkan `NODE_OPTIONS=--max-old-space-size=4096`.
3. Deploy preview dari branch `stabilisasi` (lewat integrasi git atau `vercel deploy` tanpa `--prod`). Catat URL preview.
4. Smoke test preview terhadap Supabase produksi, hanya baca: `/` dan `/monitoring` tanpa sesi dialihkan ke `/login`; `/login` 200 berbahasa Indonesia; tidak ada banner "Mode Demo"; HTML tidak memuat data mock (`Jetson Orin`, `Osiloskop`, `Soldering Station`). Login dengan akun produksi hanya jika pemilik sudah membuatnya lewat roster; uji sebatas membaca, jangan membuat data di produksi.
5. Deploy produksi. GATE D4, semua harus benar: CI hijau pada commit yang sama, migrasi Fase C tersinkron, backup valid, smoke test preview lulus. Sebelum deploy, catat ID dan URL deployment produksi yang sedang berjalan (untuk rollback). Cek branch produksi proyek Vercel. Jika `main`: buka PR `stabilisasi` ke `main` (`gh pr create`) dan merge biasa hanya setelah GATE D4 terpenuhi (tanpa force, tanpa squash yang menghilangkan riwayat commit per paket). Jangan memakai `vercel --prod` yang membuat produksi menyimpang dari `main`, kecuali branch produksi proyek bukan `main`.
6. Verifikasi produksi: deployment berstatus Ready, smoke test yang sama di URL produksi. Kalau gagal: `vercel rollback` ke deployment sebelumnya, laporkan. Migrasi database tidak ikut di-rollback; jelaskan opsi pemulihan dari backup sesuai runbook, jangan dijalankan sendiri.
7. Perbarui `docs/STATUS.md` (CI dan deploy), `docs/RUNBOOK-PRODUKSI.md` (hal yang berbeda dari rencana), dan `README.md`.

## Format laporan

`docs/laporan/PAKET-8.md`, satu bagian per fase. Catat setiap perintah yang menyentuh produksi (tanpa secret) beserta ringkasan hasil. Bagian "Butuh darimu" harus jelas: apa yang perlu pemilik kerjakan (isi `daftar_akun`, jalankan provisioning, bagikan password, set Site URL, QA-CHECKLIST untuk keempat peran sebelum mengundang anggota). Tulis penilaian jujur di akhir: apakah web SIAP dibuka ke anggota, ya atau tidak per butir (aksi tersimpan di DB, tidak ada data mock, hak akses per role, CI hijau, akun tersedia), dengan bukti.

## Mulai sekarang

Muat skill `ponytail` dan `caveman`, baca `docs/RUNBOOK-PRODUKSI.md`, lalu kerjakan Fase A. Lanjut ke B, C, D selama setiap GATE terpenuhi.
