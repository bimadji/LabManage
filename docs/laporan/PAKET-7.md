# Paket 7 — Kesiapan tes nyata: SEBAGIAN

Dikerjakan:

- `.env.example` diperbarui: menambahkan `NEXT_PUBLIC_DEMO_MODE` dan blok `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` (khusus DB uji lokal, dengan catatan skrip menolak URL produksi). `.gitignore` diberi pengecualian `!.env.example` supaya contoh env ikut ter-commit (sebelumnya `.env*` menutupnya, jadi file itu tidak pernah masuk repo).
- `docs/SETUP-TES.md` (baru): cara menjalankan dengan Supabase lokal, cara membuat **akun nyata** (Auth Dashboard + insert `profiles` + `kelompok`), daftar akun demo seed (kata sandi `password123`, khusus DB uji), cara reset data uji, cara menjalankan pengujian otomatis, mode demo, dan format laporan bug.
- `docs/STATUS.md` (baru): status jujur tiap fitur (Selesai / Sebagian / Belum) + 8 batasan yang masih ada + tautan ke `docs/BACKLOG.md`.
- README sinkron dengan kenyataan:
  - Emerald `#047857` → `#22c55e` (sesuai DESIGN.md & `globals.css`).
  - "14 Kebijakan RLS" → **20 kebijakan** (dihitung dari `pg_policies` pada DB uji setelah ketiga migrasi ter-apply; 23 `CREATE POLICY` di file, 3 diganti oleh migrasi fase 3).
  - Diagram arsitektur diperbarui: guard server (`src/proxy.ts`), role dari tabel `profiles`, RPC siklus pinjam, tabel `reports`.
  - Bagian baru "Keterbatasan yang masih ada" + catatan bahwa data STATE bukan "State Optimistik".
- `docs/USAGE.md` diperbarui: bagian 1 diganti dari "Role Switcher" menjadi "Masuk ke Aplikasi" (login, peran otomatis dari akun, simulator peran hanya mode demo); bagian 3 pinjaman diselaraskan (stok dipotong saat disetujui, tombol "Tandai Dikembalikan"); bagian 5 booking (nama ruangan kanonik + tanggal/slot jam + validasi rentang).
- `docs/BACKLOG.md` diperbarui: 6 fitur lama + 14 temuan tersisa.
- `docs/STABILISASI_REPORT.md`: tabel status semua paket diperbarui di bagian atas.

Verifikasi asli:

- `git check-ignore -v .env.example` → `.gitignore:35:!.env.example .env.example` (file sekarang bisa di-commit; `.env.local` tetap di-ignore: `.gitignore:34:.env* .env.local`).
- Scan secret ter-commit: `grep -rn "password123|sb_secret|eyJhbGciOi"` → hanya `password123` untuk akun seed DB uji dan placeholder di README/example. Tidak ada kunci API nyata.
- `docker exec ... psql -tAc "select count(*) from pg_policies where schemaname='public'"` → **20** (dipakai di README).
- `grep -c "CREATE POLICY" supabase/migrations/*.sql` → 22 + 1 + 0 = 23 file, 3 diganti migrasi fase 3 → 20 aktif.
- `npx tsc --noEmit` → exit 0; `npm run lint` → 0 error; `npm run test` → 32 test lulus; `npm run build` → exit 0.

Belum beres:

- **Belum ada akun produksi.** Yang tersedia hanya akun seed `password123` untuk DB uji. Cara membuat akun riil ada di `docs/SETUP-TES.md`, tapi eksekusinya perlu keputusan siapa yang memegang password.
- **CI belum pernah jalan** di GitHub Actions (branch `stabilisasi` belum di-push sesuai aturan).
- **Branch `stabilisasi` belum di-deploy** ke Vercel; produksi masih versi lama (tanpa login, masih role switcher).
- `docs/USAGE.md` bagian 4/6 masih menyebut "target 10 jam" sebagai angka tetap, padahal label di UI kini mengikuti `kelompok.target_jam_mingguan`.
- `.prettierrc`/format markdown tidak dijalankan pada dokumen baru (`npm run lint:md` tidak dijalankan di paket ini).

Butuh darimu:

1. **Keputusan akun nyata**: siapa yang membuat dan membagikan kredensial ke staf/anggota, dan kata sandi apa yang dipakai. Seed `password123` tidak boleh dipakai di produksi.
2. **Rencana deploy**: setelah branch `stabilisasi` di-push dan CI hijau, apakah deploy produksi menyusul? (Saat ini produksi masih versi lama tanpa login.)
3. Migrasi `20261027_fase2` & `20261027_fase3` **belum pernah ter-apply ke project Supabase produksi** — perlu keputusan kapan & oleh siapa, karena versinya berubah (nama file) dan lingkungan produksi bisa punya versi `20261027` lama di `schema_migrations`.

File: `.env.example`, `.gitignore`, `README.md`, `docs/SETUP-TES.md`, `docs/STATUS.md`, `docs/USAGE.md`, `docs/BACKLOG.md`, `docs/STABILISASI_REPORT.md`. Commit: lihat git log.

Skipped: `npm run lint:md` / `check:mermaid` / `check:links` (tidak dijalankan pada paket ini). Risiko: deploy produksi tanpa migrasi terbaru akan gagal karena RPC `verifikasi_pinjam` belum ada di DB produksi.
