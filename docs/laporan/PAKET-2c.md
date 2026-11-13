# Paket 2c — Audit laporan & bukti SECURITY DEFINER: SELESAI

Paket ini **audit**, bukan fitur baru. Tujuh butir dicek satu per satu dengan perintah nyata (`ls`, `git log --stat`, `grep`, `psql`, `npm run`), lalu yang kurang dikerjakan sekarang.

Butir 1 — `docs/RUNBOOK-PRODUKSI.md`: **SUDAH ADA (bukti), dilanjutkan sekarang.**

Bukti: file ada (`ls -la docs/RUNBOOK-PRODUKSI.md` → 11970 byte), dibuat di commit `cfc171a`. Isi lengkap: backup dulu; bandingkan versi migrasi read-only (`migration list --local` vs `--remote`); penanganan rename `20261027` → `20261027000100`/`000200` (Jalur A apply ulang idempoten, Jalur B ubah baris riwayat lewat SQL Editor); matikan sign-up publik; buat akun + profiles; env Vercel (`NEXT_PUBLIC_DEMO_MODE=false`, kunci Supabase); deploy preview sebelum produksi; rollback A/B/C. Tiap langkah menyebut siapa yang mengerjakan (pemilik/agen) + cara memastikan berhasil. CLI diverifikasi via `npx supabase ... --help` (`db push --dry-run`, `--remote`, `--include-all`, `migration list --local/--remote`, `db dump --remote`, `backups list/restore`, `branches create`); yang tak terverifikasi ditandai.

BARU DIKERJAKAN: (a) tabel **urutan kelima migrasi** dengan nama file + isi + penanda "migrasi baru?"; (b) subsection 4b — **peringatan user tanpa profil terkunci** setelah fase 5/6, plus query read-only `SELECT u.id, u.email, u.created_at, p.id IS NULL AS tanpa_profil FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL` dan langkah membuat profilnya; (c) prosa campuran bahasa dibersihkan ("Applicate", "Applicable.log", "written", "penudge", "sudah_recorded", "Responsibilities" → "Tanggung Jawab").

Butir 2 — `docs/laporan/PAKET-1.md`: **SUDAH ADA (bukti).**

Bukti: header sudah `# Paket 1 — Data harus nyata dan tersimpan: SELESAI` + blok rujukan ke `docs/laporan/PAKET-1b.md` (isi lama tidak dihapus, masih ada di bawah sebagai catatan saat paket ditutup). Commit `7f79f31`.

Butir 3 — teks rusak: **SUDAH ADA (bukti).**

Bukti `grep -rn "Paket 2 but \|duikat\|ikas saja\|before review" docs/laporan/` → tidak ada hasil. Ketiganya sudah diperbaiki di commit `7f79f31` ("Paket 2 but 5" → "butir 5", "duikat" → "duplikat", "ikas saja" → "periksa saja"). Grep ulang di seluruh `docs/` + `README.md` untuk pola mirip (CJK nyasar, kata Inggris nyasar, pengulangan kata) → 0 hit. BARU DIKERJAKAN: `docs/RUNBOOK-PRODUKSI.md` masih punya "Applicate" / "Applicable.log" / "penudge" / "sudah_recorded" / "written" / "attempting" / "Responsibilities" → semuanya dibetulkan.

Butir 4 — angka: **SEBAGIAN ADA, dilanjutkan sekarang.**

Bukti yang sudah benar sebelumnya: 22 policy (README.md:106, README.md:128, docs/STATUS.md:14) dan 16 warning lint (docs/STATUS.md:31, docs/BACKLOG.md:25). Yang **belum** benar: `docs/STATUS.md:32` masih "32 test, 5 file" padahal sudah 54 test / 9 file; `docs/laporan/00-RINGKASAN.md` belum menyebut skrip SQL baru.

BARU DIKERJAKAN: `docs/STATUS.md` → "54 test, 9 file"; `docs/STABILISASI_REPORT.md` → tambah bukti 5/5 SECURITY DEFINER; `docs/laporan/00-RINGKASAN.md` → angka test + 4 skrip DB + 2 skrip SQL; `README.md` → daftar **lima** migrasi (nama file + isi + urutan), catatan user tanpa profil terkunci, penjelasan `SECURITY DEFINER` di bagian keamanan, "22 Kebijakan" sudah benar. Semua angka diambil dari hasil perintah terbaru (`pg_policies` = 22, `vitest` = 54/9, `eslint` = 16 warning).

Butir 5 — keputusan hak akses: **BARU DIKERJAKAN.**

Bukti: sebelumnya hanya ada satu butir di `docs/laporan/00-RINGKASAN.md` (butir 7 "Butuh darimu") — belum jadi keputusan tertulis. BARU DIKERJAKAN: section baru di `docs/BACKLOG.md` "Keputusan hak akses yang sudah dikunci (Paket 2b & 2c)" dengan tabel tiga aturan + alasan (PRD §3) + tempat ditegakkan + catatan bahwa perubahan aturan harus lewat migrasi baru (bukan melonggarkan test). Tiga aturan: (1) anggota **tidak boleh** mengubah status laporannya sendiri — hanya Admin; (2) advisor **boleh** mengajukan pinjam tapi **tidak boleh** memverifikasi/menolak/selesaikan; (3) admin & advisor **tidak bisa** mencatat presensi — hanya anggota tim riset, dan kalau nanti admin perlu mencatat sesi harus lewat RPC terpisah. Ringkasan yang sama masuk ke `docs/laporan/00-RINGKASAN.md` bagian "Keputusan default".

Butir 6 — `SECURITY DEFINER` + test: **BARU DIKERJAKAN.**

Bukti attribute di DB uji (`pg_proc.prosecdef`, `pg_proc.proconfig`): `has_profile:def=true,sp=search_path=public, pg_temp` · `is_admin:def=true,sp=search_path=public, pg_temp`. Kedua file migrasi memang menulis `SECURITY DEFINER` + `SET search_path = public, pg_temp`.

BARU DIKERJAKAN: `scripts/verify-security-definer.sql` (baru, 5 skenario) + `scripts/run-db-checks.sh` (baru, runner kedua skrip SQL).

**Cara rekursi RLS dicegah (bukti empiris, bukan asumsi):** `labmanage.has_profile()` dipanggil **di dalam** `profiles_select_policy` (policy tabel `profiles` memanggil helper yang membaca tabel `profiles`). Kalau helper jalan sebagai pemanggil (`SECURITY INVOKER`), query `SELECT … FROM public.profiles` dievaluasi di bawah RLS `profiles` → policy itu memanggil helper lagi → berulang → Postgres berhenti dengan `stack depth limit exceeded`. Dengan `SECURITY DEFINER`, helper dijalankan sebagai pemilik (postgres), sehingga policy `profiles` **tidak** ikut mengevaluasi dirinya sendiri — rekursi terputus di titik itu. `SET search_path = public, pg_temp` mencegah pemb hijacking `search_path` oleh objek user.

Bukti di DB uji (uid admin nyata, `SET LOCAL ROLE authenticated`):

```text
BUKTI (INVOKER, uid nyata)          -> hasil=- error=stack depth limit exceeded
BUKTI (SECURITY DEFINER, uid nyata)  -> hasil=true error=(TIDAK ADA ERROR)
```

**Uji negatif (test benar-benar gagal bila atribut hilang):** `ALTER FUNCTION labmanage.has_profile() SECURITY INVOKER;` + `RESET search_path` → `run-db-checks.sh` keluar **1** dengan 3 skenario FAIL (1, 3, 4) + `ERROR: ADA SKENARIO GAGAL`. Atribut dipulihkan, run berikutnya 5/5 PASS, `pg_proc.prosecdef` kembali `t`.

Butir 7 — verifikasi akhir: **BARU DIKERJAKAN.**

DB uji dibangun ulang dari nol: `npx supabase db reset` → 5 migrasi ter-apply (fase2, fase3, fase4, fase5, fase6) → `scripts/seed-dummy.ts` exit 0 → `pg_policies` = **22**.

Verifikasi asli (setelah `supabase db reset`):

```text
npx supabase db reset                 → Finished supabase db reset on branch stabilisasi.
npx tsx scripts/seed-dummy.ts         → Seeding completed successfully! (exit 0)
pg_policies (schema public)           → 22

npx tsx scripts/test-rls.ts           → 7/7 lulus    (exit 0)
npx tsx scripts/test-inventory-admin.ts → 9/9 lulus  (exit 0)
npx tsx scripts/test-role-matrix.ts   → 44/44 lulus  (exit 0)

bash scripts/run-db-checks.sh         → exit 0
  verify-loan-lifecycle.sql   → 10/10 PASS
  verify-security-definer.sql →  5/5  PASS
# urutan terbalik (matriks dulu, lalu SQL) juga exit 0

npx tsc --noEmit                      → exit 0
npm run lint                          → ✖ 16 problems (0 errors, 16 warnings)
npm run test                          → Test Files 9 passed (9) / Tests 54 passed (54)
npm run lint:md                       → 0 error
```

Uji negatif (bukti test tidak false-positive):

```text
ALTER FUNCTION labmanage.has_profile() SECURITY INVOKER;  -- sengaja rusak
bash scripts/run-db-checks.sh → EXIT=1
  1. helper SECURITY DEFINER + search_path               | FAIL  has_profile:def=false,sp=-
  3. dengan SECURITY DEFINER -> jalan normal             | FAIL  err="stack depth limit exceeded"
  4. policy profiles (memakai has_profile) tanpa rekursi | FAIL  err="stack depth limit exceeded"
  5. atribut helper tidak bocor setelah probe            | FAIL  has_profile:def=false
```

Ditemuan & diperbaiki saat pengerjaan:

1. **Stack lokal tidak bisa start** — port default 54321/54322 dipakai stack Supabase lain di mesin ini (`supabase_db_LabManage`, project `BrainStorm` juga jalan). `supabase/config.toml` dibuat ulang dengan port digeser (API 54521, DB 54522, studio 54523, smtp 54524, analytics 54527, pooler 54529) dan sekarang **dikomit** ke repo — tanpa itu, `npx supabase start` selalu gagal di mesin ini.
2. **Test yang bergantung pada UUID tetap** — `verify-security-definer.sql` sempat memakai UUID admin yang tertanam; UUID itu **berubah tiap `db reset`** (akun dibuat ulang) → skenario 3 & 4 FAIL (`hasil=false`, `baris=0`). Diperbaiki: UID dicari dinamis (`SELECT id FROM public.profiles WHERE role='admin' ORDER BY created_at LIMIT 1`) + pesan jelas kalau seed belum dijalankan.
3. **`ROLLBACK` di luar blok transaksi** — versi pertama skrip SQL menaruh `ROLLBACK` sendiri sehingga psql memberi warning "there is no transaction in progress" dan blok `DO` siguientes berjalan sebagai transaksi terpisah. Diperbaiki: blok `BEGIN … EXCEPTION` memakai savepoint implisit, dan skenario 5 baru memverifikasi atribut helper tidak bocor setelah probe.
4. **Runner salah pilih container** — `docker ps --filter label=…` mengembalikan 9 container; `head -1` mengambil `supabase_pg_meta` (tanpa `psql`) → "executable file not found". Diperbaiki dengan filter `grep -E '^supabase_db_'`.
5. **Prosa campuran bahasa di runbook** — dibersihkan (lihat Butir 3).
6. **Bug test: matriks role gagal setelah skrip SQL dijalankan** — `scripts/verify-loan-lifecycle.sql` membuat profil `uji.admin@labmanage.test` (role `admin`). `scripts/test-role-matrix.ts` mencari admin lewat `.eq('role','admin').single()` → 2 baris → `single()` mengembalikan null → crash (`Cannot read properties of null (reading 'id')`). Diperbaiki: cari admin lewat **email** (`AKUN.admin`), bukan role. `scripts/verify-security-definer.sql` punya masalah sama → lookup admin jadi email-first dengan fallback role. Diverifikasi: matriks 3× berturut-turut 44/44, dan urutan `test-role-matrix` → `run-db-checks` (atau sebaliknya) sama-sama exit 0.

Belum beres:

- `verify-security-definer.sql` butuh profil admin di DB uji → harus jalan **setelah** `seed-dummy.ts`. Kalau DB belum di-seed, skenario 3/4/5 FAIL dengan pesan "tidak ada profil admin — jalankan seed-dummy dulu".
- `scripts/run-db-checks.sh` belum jalan di runner GitHub Actions (branch belum dipush). Job `db` di `.github/workflows/ci.yml` sudah ditambah 2 langkah baru (matriks role + run-db-checks) tapi belum pernah dieksekusi CI.
- Skrip SQL memakai `psql` di dalam container — butuh Docker. Tidak ada padanan untuk stack hosted.
- `supabase/config.toml` mengunci port 54521/54522; kalau mesinmu memakai port itu untuk stack lain, sesuaikan.
- `verify-loan-lifecycle.sql` & `verify-security-definer.sql` membuat tabel sementara `_loan_verify` / `_secdef_verify` di `public` (dibuat `IF NOT EXISTS`, tidak dihapus). Tidak ganggu aplikasi, tapi menambah 2 objek di schema publik produksi kalau skrip dijalankan di sana — **jangan** dijalankan ke produksi.

Butuh darimu:

1. Konfirmasi tiga aturan hak akses yang dikunci di `docs/BACKLOG.md` (anggota tak boleh ubah status laporan; advisor boleh pinjam tapi tak boleh verifikasi; admin/advisor tak bisa presensi). Kalau salah satu perlu dilonggarkan, koreksi di policy — jangan di test.
2. Konfirmasi port lokal 54521/54522 di `supabase/config.toml` — aman untuk mesinmu, atau perlu geser lagi?
3. Keputusan: `docs/BACKLOG.md` butir 7 — `profiles_select_policy` mengizinkan anggota satu kelompok melihat profil teman sekelompok (termasuk email). Sudah lama jadi temuan, belum diputuskan.

File: `docs/RUNBOOK-PRODUKSI.md`, `docs/BACKLOG.md`, `docs/STATUS.md`, `docs/STABILISASI_REPORT.md`, `docs/laporan/00-RINGKASAN.md`, `docs/SETUP-TES.md`, `README.md`, `.env.example`, `supabase/config.toml`, `supabase/.gitignore`, `scripts/verify-security-definer.sql`, `scripts/run-db-checks.sh`, `scripts/test-role-matrix.ts`, `.github/workflows/ci.yml`. Commit: `9a7d7f6`, `51b9d15`, `68ab6e2`.

Skipped: e2e Playwright; eksekusi CI; percobaan `db push --remote` (produksi dilarang disentuh). Risiko: rekursi RLS pada helper `is_admin()` **tidak** terbukti (helper itu dipakai di RPC, bukan policy `profiles`, jadi tidak membentuk siklus) — `is_admin()` tetap dijaga atributnya oleh skenario 1; policy hosted belum diuji; `run-db-checks.sh` bergantung pada `docker ps` + label compose, tidak jalan di environment tanpa Docker.
