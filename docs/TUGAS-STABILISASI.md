# TUGAS STABILISASI LabManage (LabManageV3)

Repo: bimadji/LabManage. File ini adalah instruksi lengkap untuk agen. Baca SEMUANYA sebelum mulai, lalu kerjakan Paket 1b sampai Paket 7 dalam satu sesi, tanpa menunggu pemilik repo. Pemilik sedang tidur dan tidak bisa menjawab pertanyaan.

Tujuan akhir: web siap dites nyata oleh staf lab dan anggota tim riset. Ini fase STABILISASI, bukan pengembangan fitur.

## Konteks

Paket 1 sudah dikerjakan (commit 8bcd1e4, 5cfbd4b): alur pinjam tersambung ke DB lewat migrasi `20261112_fase4_loan_lifecycle.sql` (RPC `verifikasi_pinjam` dan `selesaikan_pinjam`), fallback pura-pura sukses dihapus, `MOCK_*` hanya aktif jika `NEXT_PUBLIC_DEMO_MODE=true`. Status Paket 1: SEBAGIAN, karena SQL belum pernah dieksekusi di DB nyata.

Baca `docs/STABILISASI_REPORT.md` dan `docs/BACKLOG.md` dulu untuk konteks. Jangan membaca ulang file yang sudah kamu baca.

## Aturan ruang lingkup

- DILAKUKAN: memperbaiki bug, menyambungkan yang masih mock ke Supabase, menutup celah akses, menghapus data palsu, menambah test, merapikan dokumen yang salah.
- DILARANG: fitur baru, perubahan desain/tema, perluasan scope. Fitur dari rencana lama (rekap absensi, peringatan advisor, notifikasi, koreksi sesi admin, target jam dinamis) JANGAN dikerjakan; catat di `docs/BACKLOG.md`.
- Masalah di luar daftar: catat di `BACKLOG.md`. Perbaiki langsung hanya jika memblokir tes nyata (data hilang, salah hak akses, crash).

## Mode kerja (wajib)

1. Muat skill `ponytail` SEBELUM menulis atau mengubah kode apa pun (aplikasi, migrasi SQL, skrip, test). Kalau tidak bisa dimuat, jangan menulis kode; tulis itu di laporan dan hentikan sesi.
2. Tulis laporan tiap paket dengan skill `caveman` (singkat, padat, tanpa basa-basi, bukti tidak boleh dipotong). Kalau skill caveman tidak bisa dimuat, tulis seringkas mungkin dan catat itu.
3. Kerjakan paket berurutan: 1b, 2, 3, 4, 5, 6, 7. Setelah tiap paket: jalankan `npx tsc --noEmit`, `npm run lint`, test yang relevan; commit; tulis file laporan paket itu; lanjut ke paket berikutnya TANPA berhenti.
4. Jangan berhenti untuk bertanya. Setiap keputusan yang butuh pemilik: ambil default aman (lihat "Keputusan default"), catat di laporan bagian "Butuh darimu", lanjut.
5. Kalau sebuah paket gagal diverifikasi setelah 3 percobaan perbaikan: tandai SEBAGIAN, catat persis apa yang gagal, lalu lanjut ke paket berikutnya HANYA jika paket itu tidak bergantung pada yang gagal. Ketergantungan: Paket 2 butuh 1b; Paket 3 butuh 2; Paket 6 butuh semua; Paket 4 dan 5 bebas. Paket yang dilewati berstatus BELUM beserta alasannya, dan tetap dibuatkan file laporannya.
6. Satu paket = satu atau beberapa commit dengan pesan jelas; jangan campur perubahan antar paket dalam satu commit.
7. Kalau konteks atau token hampir habis: selesaikan langkah yang sedang berjalan sampai aman, commit, tulis `docs/laporan/STATE.md` (paket mana selesai, sedang dikerjakan, sisa), lalu berhenti. Jangan meninggalkan perubahan setengah jadi yang merusak build.

## Aturan keamanan (jangan dilanggar)

- Kerja di branch, bukan main. Kalau sedang di main, buat branch `stabilisasi` dari posisi sekarang. JANGAN push, JANGAN merge ke main, JANGAN deploy, JANGAN force-push, JANGAN rewrite history.
- JANGAN menyentuh Supabase produksi. Operasi database nyata (terapkan migrasi, seed, test RLS, test RPC) HANYA boleh memakai variabel `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` dari `.env.test.local`. Kalau variabel itu tidak ada, JANGAN memakai kredensial lain (termasuk `.env.local`) untuk operasi tulis apa pun; semua langkah yang butuh DB dilewati dan dicatat sebagai TIDAK TERVERIFIKASI.
- Migrasi: selalu file BARU di `supabase/migrations/` (jangan edit yang lama). Jangan menulis migrasi yang menghapus tabel, kolom, atau data.
- Jangan commit secret. Kalau menemukan secret ter-commit di repo atau history: catat di laporan, jangan coba membersihkan history.
- Jangan menghapus file milik user di luar yang memang diminta paket.
- Build bisa gagal OOM di mesin RAM kecil: pakai `NODE_OPTIONS=--max-old-space-size=2048` (atau lebih) dan catat.

## Keputusan default (karena pemilik tidak bisa ditanya)

- Aturan stok: stok dipotong saat DISETUJUI (sesuai implementasi Paket 1). Perbarui PRD §4.2 agar sesuai, dan catat di laporan sebagai keputusan yang perlu dikonfirmasi.
- Enum `inventory_status`: JANGAN ubah enum DB. Selaraskan TS/UI/mock supaya tidak memakai "dipinjam" sebagai status inventaris (jika perlu, turunkan dari `stok_tersedia` vs `stok_total`). Catat di laporan.
- Mode demo: tetap ada, default mati, dengan banner "MODE DEMO".
- Ruangan: pakai satu konstanta bersama; jangan ubah skema besar-besaran.
- Akun nyata: tidak ada password hardcode untuk akun nyata; seed demo hanya untuk DB uji.

## Aturan kejujuran

- Setiap klaim harus punya bukti nyata (perintah dan output asli, nama test, path file). Jangan membulatkan ke atas. File ada bukan berarti fitur selesai.
- SELESAI hanya jika terverifikasi. Paket yang melibatkan database tidak boleh SELESAI jika tidak diuji di DB nyata; statusnya SEBAGIAN dengan keterangan "kode siap, belum teruji DB".
- Jangan menelan error. Jangan menulis hasil perintah yang tidak benar-benar kamu jalankan.
- Pisahkan fakta terverifikasi dari asumsi.

## Format laporan per paket

Satu file per paket di `docs/laporan/`: `PAKET-1.md` (salinan laporan Paket 1 lama dengan format ini), `PAKET-1b.md`, `PAKET-2.md`, `PAKET-3.md`, `PAKET-4.md`, `PAKET-5.md`, `PAKET-6.md`, `PAKET-7.md`. Format PERSIS seperti ini (gaya caveman):

```
# Paket N — <judul>: <SELESAI|SEBAGIAN|BELUM>

Dikerjakan:
- <poin singkat>

Verifikasi asli:
- <perintah> → <hasil asli, termasuk yang gagal>

Belum beres:
- <apa, kenapa>

Butuh darimu:
1. <keputusan atau akses yang dibutuhkan>

File: <file penting>. Commit: <hash>.

Skipped: <apa yang tidak dijalankan dan kenapa>. Risiko: <risiko nyata>.
```

Di akhir sesi tulis `docs/laporan/00-RINGKASAN.md` berisi: tabel (paket | status | catatan satu baris), daftar semua "Butuh darimu" digabung dan diurut dari yang paling mendesak, daftar keputusan default yang diambil, dan daftar hal yang tidak teruji karena tidak ada DB uji. Perbarui juga tabel status di bagian atas `docs/STABILISASI_REPORT.md`.

## Daftar tugas

### Paket 1b — Verifikasi database

1. Terapkan semua migrasi (termasuk `20261112_fase4_loan_lifecycle.sql`) ke Supabase UJI. Catat hasil tiap migrasi.
2. Uji `verifikasi_pinjam` dan `selesaikan_pinjam` langsung di DB: setuju stok cukup; setuju stok kurang (harus ditolak); tolak; selesai; selesai dua kali (tidak boleh memulihkan stok dua kali); dipanggil non-admin (harus ditolak); dua persetujuan bersamaan untuk stok yang sama. Periksa juga: kedua RPC memeriksa role admin, punya `SET search_path` dan GRANT eksplisit; status item kembali ke tersedia saat stok pulih dari 0; status rusak tidak ikut berubah.
3. Ubah `scripts/test-rls.ts` dan `scripts/test-inventory-admin.ts` supaya exit code non-zero saat gagal; tambahkan skenario pinjam di atas.
4. Perbarui PRD §4.2 sesuai aturan stok.
5. Jika `SUPABASE_TEST_*` tidak ada: kerjakan butir 3 dan 4 saja, tulis skenario SQL uji di `scripts/` agar siap dijalankan nanti, status SEBAGIAN.

### Paket 2 — Autentikasi dan hak akses sungguhan

1. Ganti Role Switcher localStorage dengan login Supabase Auth. Role dan kelompok dari tabel `profiles` user yang login. Role Switcher hanya ada di mode demo. Buat halaman login berbahasa Indonesia sesuai DESIGN.md.
2. Semua `user_id` yang ditulis (presensi, pinjam, booking, laporan) berasal dari `auth.uid()`, bukan data mock.
3. Guard server (middleware Next.js atau cek di server component): `/monitoring` hanya admin dan advisor; halaman lain butuh login; belum login dialihkan ke login.
4. Advisor memantau saja: sembunyikan/nonaktifkan semua aksi tulis advisor di UI (Tinjau, Setujui, Tolak, ubah status laporan). Admin tidak melihat tombol ajukan pinjam di inventaris.
5. Test per role: aksi yang diizinkan dan yang dilarang, lewat UI dan langsung ke API Supabase (bagian API butuh DB uji).

### Paket 3 — Presensi dan jam riset yang benar

1. Hapus angka fiktif 6.5 dan tombol `resetWeeklyDemo` dari jalur produksi.
2. Akumulasi jam mingguan dihitung dari `attendance_sessions` (minggu berjalan per user); target dari `kelompok.target_jam_mingguan`; label "10 Jam / Minggu" dari data, bukan hardcode.
3. Halaman Monitoring: ganti `MOCK_TEAM_MONITORING` dan okupansi hardcode dengan kueri nyata (jam riset per anggota vs target, utilisasi ruangan dari `room_bookings`, tabel rekap). Data kosong menampilkan empty state yang jelas.
4. Check-in/out menampilkan error jika RLS menolak; sesi yang masih terbuka (lupa check-out) terlihat jelas di UI user. Jangan mengerjakan koreksi admin.

### Paket 4 — Booking ruangan yang benar

1. Form menyimpan tanggal dan rentang jam yang dipilih (`start_time`/`end_time` sungguhan, zona Asia/Jakarta), bukan fallback `new Date()`.
2. Cek bentrok di klien pakai perbandingan rentang waktu, bukan string label. Constraint GiST tetap penjaga terakhir; tangkap pelanggarannya dan tampilkan "Ruangan sudah dipesan di jam itu".
3. Konstanta ruangan tunggal untuk UI dan DB.

### Paket 5 — Bug kecil yang terlihat user

1. `status-badge.tsx`: hapus dead code, perbaiki warna dipinjam/ditangani/aktif sesuai DESIGN.md §3; selaraskan tipe dengan enum DB sesuai keputusan default.
2. Perbaiki semua error ESLint yang tersisa (`react-hooks/set-state-in-effect`, `no-explicit-any`). Target: `npm run lint` tanpa error.
3. Teks Inggris di UI ("Toggle menu", "Off") jadi Indonesia; hapus duplikasi Textarea.
4. Aksesibilitas murah: skip link, `aria-expanded` pada toggle navigasi, focus ring terlihat, `prefers-reduced-motion`, touch target 44px di tombol utama mobile.

### Paket 6 — Test dan pengaman

1. Pasang vitest + testing library, script `npm run test`. Test untuk: jalur gagal Supabase (tidak boleh pura-pura sukses), pemulihan stok (logika klien), validasi bentrok ruangan, status-badge, guard role.
2. GitHub Actions: tsc, lint, test, build, dengan `NODE_OPTIONS=--max-old-space-size=4096`.
3. `docs/QA-CHECKLIST.md`: skenario uji manual per role (admin, anggota tim riset, anggota UKM, advisor), dari login sampai tiap alur utama, dipakai staf lab saat tes nyata.

### Paket 7 — Kesiapan tes nyata

1. `.env.example` lengkap (termasuk `SUPABASE_TEST_*`, `NEXT_PUBLIC_DEMO_MODE`); tidak ada secret ter-commit (periksa dengan grep).
2. `docs/SETUP-TES.md`: cara membuat akun asli untuk anggota, cara terapkan migrasi, cara reset data uji, cara melapor bug.
3. README sesuai kenyataan: Emerald `#22c55e`, jumlah policy RLS yang benar (hitung dengan grep di semua migrasi), keterbatasan yang masih ada.
4. `docs/STATUS.md`: daftar fitur dan status jujur masing-masing, link ke `BACKLOG.md`.
5. Tulis `docs/laporan/00-RINGKASAN.md` dan perbarui tabel di `STABILISASI_REPORT.md`.

## Definisi "siap tes nyata"

Nilai jujur di ringkasan akhir, jawab ya/tidak per butir dengan bukti:

- Setiap aksi yang tampil berhasil memang tersimpan di DB dan tetap ada setelah refresh.
- Tidak ada data mock tampil di mode produksi.
- Tiap role hanya bisa melihat dan melakukan yang diizinkan, diverifikasi di server/RLS.
- tsc, lint, test, build lulus; CI siap.
- Tidak ada error yang ditelan diam-diam.

Jika ada butir "tidak", tulis terang bahwa web BELUM siap dibuka ke anggota, dan sebutkan apa yang masih kurang.

## Mulai sekarang

Muat skill `ponytail` dan `caveman`, baca `docs/STABILISASI_REPORT.md` dan `docs/BACKLOG.md`, buat branch kerja, lalu kerjakan Paket 1b sampai Paket 7. Jangan berhenti untuk bertanya.
