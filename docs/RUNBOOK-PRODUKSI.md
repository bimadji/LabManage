# Runbook Produksi — LabManage

Langkah applying skema & deploy aplikasi ke **Supabase hosted** + **Vercel**.
Dokumen ini **tidak pernah dijalankan** oleh agen — hanya ditulis. Semua perintah sudah diverifikasi ada di CLI (`npx supabase ... --help`, versi 3.1.0) atau ditandai sebagai **TIDAK TERVERIFIKASI**.

Penanggung jawab per langkah: **Pemilik** (manusia, Muchammad/Andi — pemilik repo) atau **Agen** (asisten AI). Yang tidak boleh dilakukan agen: sentuh DB produksi tanpa SLOT_JEDA_MIGRASI.

> ⚠️ Sebelum mulai, baca butir "Butuh darimu" di `docs/laporan/00-RINGKASAN.md` — terutama butir 2 (migrasi produksi belum pernah ter-apply) dan butir 1 (akun produksi belum ada).

---

## 0. Prasyarat

| Kebutuhan | Detail |
|---|---|
| Supabase CLI | `npx supabase --version` → 3.1.0 (sudah dipakai di repo) |
| Node | 22 (sesuai CI) |
| Login CLI | `npx supabase login` (perlu token akses; **Pemilik** yangdoing) |
| Project ref | diketahui dari Dashboard → Project Settings → Reference ID |
| Password DB | diminta saat `link`/`db push` ke hosted |

---

## 1. Backup dulu (WAJIB, sebelum apa pun)

**Pemilik.**

Opsi A — dump logis (ringkas, bisa dijalankan di mana saja):


```bash
npx supabase db dump --remote --file backup-$(date +%Y%m%d-%H%M).sql
```

Opsi B — backup fisik Supabase (PITR, opsional tapi lebih aman):

```bash
npx supabase backups list --remote
npx supabase backups restore --remote --timestamp <timestamp-yang-ingin>
```

> Catatan: `backups restore` menulis ke database — **jangan** dipakai untuk "mencoba". Hanya untuk pemulihan insiden.

**Cara memastikan berhasil:** file `.sql` ada di disk dan ukurannya > 0; atau `backups list` menampilkan entri baru.

**Kalau backup gagal: STOP. Jangan lanjut ke langkah 2.**

---

## 2. Bandingkan versi migrasi lokal vs remote (READ-ONLY)

**Agen atau Pemilik.** Dua perintah read-only:

```bash
npx supabase migration list --local
npx supabase migration list --remote
```

**Cara memastikan berhasil:** bandingkan kolom version. Local = 5 file (`20261027000100`, `20261027000200`, `20261112`, `20261113000100`, `20261113000200`). Remote = apa yang sudah tercatat di `supabase_migrations.schema_migrations`.

### Urutan kelima migrasi aktif

Diterapkan berurutan di DB uji lokal (`npx supabase start` → "Applying migration …"):

| Urutan | Nama file | Isi | Migrasi baru? |
|---|---|---|---|
| 1 | `20261027000100_fase2_group_based_schema.sql` | skema kelompok, `profiles`, policy RLS dasar, helper `labmanage.current_role()` / `current_kelompok_id()` / `current_kelompok_jenis()` | bukan (versi diubah dari `20261027`) |
| 2 | `20261027000200_fase3_admin_inventory_management.sql` | RPC `tambah_stok_inventory` + policy inventaris admin | bukan (versi diubah dari `20261027`) |
| 3 | `20261112_fase4_loan_lifecycle.sql` | RPC `verifikasi_pinjam` / `selesaikan_pinjam`, kolom `judul`/`lokasi`/`jenis` pada `reports` | ya |
| 4 | `20261113000100_fase5_profile_guard.sql` | helper `labmanage.has_profile()`; semua policy wajib profil; `reports_update_policy` jadi Admin-saja; `attendance_sessions` khusus anggota tim riset | ya |
| 5 | `20261113000200_fase6_rpc_role_guard.sql` | helper `labmanage.is_admin()` (NULL-safe); 3 RPC admin-only memakai guard itu | ya |

> Angka `20261112` (fase 4) **tidak** berawalan `20261113` — itu disengaja, dua migrasi baru harus punya versi berbeda agar CLI tidak menolak versi kembar (error yang pernah terjadi: `duplicate key value violates unique constraint "schema_migrations_pkey"`).

---

## 3. Rename `20261027` → `20261027000100` / `20261027000200`

**Kalau langkah 2 menunjukkan remote SUDAH punya versi `20261027`** (artinya produksi pernah menerapkan migrasi versi lama):

Masalah: versi `20261027` tercatat di `schema_migrations`, sedangkan repo kini memakai `20261027000100`/`20261027000200`. `supabase db push` akan mencoba menerapkan ulang kedua file (isinya idempoten, jadi aman) **tapi** CLI bisa menolak karena "duplicate version".

Dua jalur, pilih satu (keduanya butuh **`--dry-run` lebih dulu**):

**Jalur A (disarankan, tanpa sentuh DB lewat SQL):** biarkan CLI menerapkan ulang. File migrasi bersifat idempoten (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` + `CREATE POLICY`), jadi apply ulang aman.

```bash
npx supabase db push --remote --dry-run     # <- selalu lihat ini dulu
npx supabase db push --remote
```

**Jalur B (kalau CLI menolak versi kembar):** samakan versi remote dengan repo via SQL Editor (Dashboard → SQL Editor), **hanya** baris riwayat:

```sql
-- baca dulu (read-only)
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- ubah HANYA bila versi lama tercatat sebagai 20261027
UPDATE supabase_migrations.schema_migrations
SET version = '20261027000100', name = 'fase2_group_based_schema'
WHERE version = '20261027';
```

> Baris `20261027` di riwayat lama hanya mewakili satu file (fase 2), sedangkan fase 3 punya nama sendiri — **periksa baris mana yang ada** sebelum mengubah. Kalau keduanya tercatat sebagai `20261027`, tidak bisa dipetakan satu-satu; pakai Jalur A.

**Flag yang diverifikasi ada:** `db push --dry-run`, `--remote`, `--include-all`, `--password`, `--include-seed`, `--skip-vault` (dari `npx supabase db push --help`).
**TIDAK TERVERIFIKASI:** perilaku `--include-all` untuk kasus versi kembar (dokumentasi CLI menyebut "include all migrations not found in the migration history table" — belum diuji di DB nyata).

**Cara memastikan berhasil:** `npx supabase migration list --remote` menampilkan 5 versi repo, dan `supabase db push --remote --dry-run` keluar tanpa error.

---

## 4. Terapkan migrasi ke produksi

**Pemilik** (agen hanya boleh bila ada SLOT_JEDA_MIGRASI eksplisit).


```bash
npx supabase db push --remote --dry-run
npx supabase db push --remote
```

**Cara memastikan berhasil:**

```sql
-- cek versi sudah lengkap
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- cek objek penting ada
SELECT count(*) AS policies FROM pg_policies WHERE schemaname = 'public';
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND proname IN
 ('tambah_stok_inventory','verifikasi_pinjam','selesaikan_pinjam','is_admin');
```

Harus ada 22 policy aktif dan 4 fungsi (termasuk `labmanage.is_admin()`).

**Kalau gagal di tengah:** tidak ada migrasi parsial yang merusak — semua file idempoten, jadi `db push --remote` bisa diulang.

### 4b. ⚠️ Dampak fase 5 & fase 6: user tanpa profil TERKUNCI

**Pemilik.** Dua migrasi terakhir mengunci data untuk user yang ada di `auth.users` tapi **tidak punya baris di `profiles`**:

- `fase5` — semua policy RLS mensyaratkan `labmanage.has_profile()`. User tanpa profil **tidak bisa membaca maupun menulis apa pun** (termasuk `kelompok`, `inventory_items`, `room_bookings`).
- `fase6` — RPC admin-only (`tambah_stok_inventory`, `verifikasi_pinjam`, `selesaikan_pinjam`) memakai `labmanage.is_admin()`, jadi user tanpa profil tidak bisa memanggilnya.

Efek di aplikasi: user seperti itu **tidak bisa login** (proxy mengalihkan ke `/login?alasan=belum-terdaftar` dengan pesan "Akunmu belum didaftarkan oleh admin lab"). Ini memang perilaku yang diinginkan, tapi kalau ada user lama yang belum pernah dibuatkan profil, mereka terkunci setelah migrasi.

**Cari user seperti itu (READ-ONLY, SQL Editor):**

```sql
SELECT u.id, u.email, u.created_at, p.id IS NULL AS tanpa_profil
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at;
```

**Cara memastikan berhasil:** query di atas mengembalikan **0 baris**. Kalau ada baris, buat profilnya (langkah 6) **sebelum** menjalankan `db push --remote` — atau setelahnya, tapi siapkan akun tersebut.

### 4c. Buat profil untuk user yang terkunci (bila ada)

**Pemilik**, di SQL Editor — untuk tiap UUID hasil query 4b:

```sql
INSERT INTO public.profiles (id, nama, nim, role, kelompok_id, email)
VALUES (
  '<UUID dari query 4b>',
  'Nama Lengkap',
  'NIM/NIP',
  'anggota',                                   -- admin | anggota | advisor
  (SELECT id FROM public.kelompok WHERE nama = 'Tim Riset EROS'),
  'email@domain'
);
```

**Cara memastikan berhasil:** ulangi query 4b → 0 baris; user tersebut bisa login dan role-nya tampil benar.

---

## 5. Matikan sign-up publik (sebelum inviting user)

**Pemilik.** Supabase Dashboard → **Authentication → Sign In / Providers → Email** → matikan **"Allow new users to sign up"**.

**Cara memastikan berhasil:** mencoba mendaftar lewat UI menampilkan error 403, dan user yang sudah ada tetap bisa login.

**Alasan:** tanpa ini, siapa pun bisa membuat akun; user tanpa baris `profiles` tidak bisa apa-apa (RLS + guard), tapi tetap menambah beban.

---

## 6. Buat akun + baris profiles

**Pemilik.** Satu cara yang sudah dipakai di repo (Dashboard):

**Cara 1 (Dashboard):** Authentication → Users → **Add user** (email + password buatan sendiri, centang **Auto Confirm User**), lalu catat UUID.

**Cara 2 (admin API dari CLI/SQL):** **TIDAK TERVERIFIKASI** untuk Supabase hosted di luar Dashboard.

Setelah UUID didapat, isi profil (**Pemilik**, SQL Editor):

```sql
-- kelompok dulu (kalau belum ada)
INSERT INTO public.kelompok (nama, jenis, target_jam_mingguan)
VALUES ('Tim Riset EROS', 'tim_riset', 10), ('Tim Riset EIRA', 'tim_riset', 10), ('Roboholic', 'ukm', NULL)
ON CONFLICT (nama) DO NOTHING;

-- profil untuk tiap akun (UUID dari Authentication)
INSERT INTO public.profiles (id, nama, nim, role, kelompok_id, email)
VALUES (
  '<UUID>',
  'Nama Lengkap',
  'NIM/NIP',
  'anggota',                                   -- admin | anggota | advisor
  (SELECT id FROM public.kelompok WHERE nama = 'Tim Riset EROS'),
  'email@domain'
);
```

**Cara memastikan berhasil:** login di aplikasi → role & kelompok tampil benar di pojok kanan atas; user tanpa baris `profiles` melihat pesan "Akunmu belum didaftarkan oleh admin lab".

**Jangan** memakai `scripts/seed-dummy.ts` untuk produksi — skrip itu menolak URL non-lokal (guard `isLocalUrl()`), dan akunnya berpassword `password123`.

---

## 7. Env Vercel

**Pemilik.** Vercel → Project → Settings → Environment Variables (Production **dan** Preview):

| Key | Nilai | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | public, ikut ter-inline ke browser |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key | public, aman untuk browser |
| `SUPABASE_SECRET_KEY` | service role key | **RAHASIA** — hanya untuk server; jangan pernah di-expose ke browser |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | `true` hanya untuk presentasi lokal |

> `NEXT_PUBLIC_*` ter-inline saat build → kalau diubah, wajib redeploy.
> `SUPABASE_SECRET_KEY` dibaca server (skrip seed) — jangan ditaruh di `NEXT_PUBLIC_*`.

**Cara memastikan berhasil:** redeploy, lalu `curl -sI https://<domain-produksi>` dan cek halaman login muncul (200) tanpa error env.

---

## 8. Deploy preview dulu, baru produksi

**Pemilik.**

1. Push branch `stabilisasi` (agent tidak boleh push — pemilik yang push):

   ```bash
   git push origin stabilisasi
   ```

2. Vercel: buat **Preview Deployment** untuk branch tersebut (otomatis via integrasi Git, atau `vercel` CLI).
3. Uji preview dengan akun uji (satu per peran): login, inventaris, pinjam, check-in, booking, monitoring.
4. Checklist manual: `docs/QA-CHECKLIST.md`.

**Cara memastikan berhasil:** preview bisa login dan seluruh skenario pada checklist lulus; tidak ada error 5xx di Vercel logs.

---

## 9. Produksi

**Pemilik.** Setelah preview hijau:

1. Merge `stabilisasi` → `main` (squash / PR review).
2. Vercel: promote preview menjadi Production Deployment (atau push ke `main` bila repo memakai auto-deploy).
3. Verifikasi setelah deploy (Pemilik):

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://<domain-produksi>/login
   ```

   Lalu login manual dengan akun uji per peran.

**Cara memastikan berhasil:** 200 di `/login`; login 4 peran berhasil; monitoring menolak anggota; RLS menolak aksi terlarang (bisa dicek dari log Supabase → Logs → Postgres).

---

## 10. Rollback

**Tiga tingkat, pilih sesuai severity:**

| Tingkat | Cara | Kapan | Pelaksana |
|---|---|---|---|
| A. Rollback aplikasi | Vercel → Deployments → pilih deployment sebelumnya → **Promote to Production** | Bug di kode frontend, skema aman | Pemilik (5 menit) |
| B. Rollback skema via SQL | Jalankan SQL pembatal secara manual di SQL Editor (mis. `DROP FUNCTION public.selesaikan_pinjam(UUID);` + `DROP POLICY ...`) | RPC baru merusak data | Pemilik + SLOT_JEDA_MIGRASI |
| C. Restore penuh | `npx supabase db dump` sebelum langkah 1 → pulihkan ke DB baru, atau `backups restore` (PITR) | Kerusakan data | Pemilik, siapkan DB baru lebih dulu |

**Penting:** skema **tidak** bisa di-`git revert` di produksi — migrasi sudah tercatat. Untuk rollback skema, tulis **migrasi baru** (bukan edit file lama) yang mengembalikan objek ke kondisi sebelumnya, lalu `db push --remote` lagi.

**Cara memastikan berhasil (rollback A):** `/login` versi lama muncul; coba satu alur utama.

---

## Ringkasan Tanggung Jawab

| # | Langkah | Pelaksana | Verifikasi |
|---|---|---|---|
| 1 | Backup DB | Pemilik | file dump / entri backup muncul |
| 2 | Bandingkan versi migrasi | Agen / Pemilik | `migration list --local` vs `--remote` |
| 3 | Tangani versi kembar 20261027 | Pemilik | `migration list --remote` = 5 versi repo |
| 4 | `db push --remote` | Pemilik (+SLOT_JEDA_MIGRASI) | 22 policy + 4 fungsi ada |
| 5 | Matikan sign-up publik | Pemilik | signup ditolak, login lama jalan |
| 6 | Buat akun + profiles | Pemilik | login per peran, role & kelompok benar |
| 7 | Env Vercel | Pemilik | preview & produksi pakai env yang sama |
| 8 | Deploy preview | Pemilik | QA checklist lulus di preview |
| 9 | Produksi | Pemilik | 200 di /login, 4 peran masuk |
| 10 | Rollback bila perlu | Pemilik | rollback A/B/C sesuai severity |

## Yang TIDAK TERVERIFIKASI

1. Perilaku `db push --remote` pada remote yang sudah punya versi `20261027` — **belum pernah diuji ke DB hosted**. Jalur A & B di langkah 3 disusun berdasarkan perilaku CLI, bukan percobaan nyata.
2. `--include-all` untuk kasus versi kembar — flag ada, efeknya belum diuji.
3. `supabase backups restore --timestamp` — flag terverifikasi ada, prosedurnya belum dicoba (sengaja tidak; pemulihan berisiko).
4. Urutan persis langkah 5–6 (matikan sign-up dulu vs. buat akun dulu) — **tidak diverifikasi**; urutan dipilih demi keamanan (tutup pintu sebelum membuka akun).
5. Apakah Supabase hosted memakai prefix `supabase_migrations` untuk `schema_migrations` — **TIDAK TERVERIFIKASI** untuk project ini; query di langkah 4 memakai asumsi lokal.
