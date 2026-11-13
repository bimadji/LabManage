# Setup & Uji Nyata — LabManage

Panduan singkat untuk menyiapkan aplikasi agar bisa dites sungguhan oleh staf laboratorium dan anggota tim riset.

## 1. Yang dibutuhkan

- Node.js 22 (`.nvmrc` tidak ada, tapi CI memakai Node 22)
- Akun Supabase (proyek uji/lokal, **jangan** pakai produksi untuk data uji)
- Docker Desktop — hanya untuk Supabase lokal (opsional)

## 2. Menjalankan dengan Supabase lokal (disarankan untuk uji)

```bash
npm ci
npx supabase start         # menjalankan stack lokal (butuh Docker)
# supabase/config.toml sudah ada di repo: port API 54521, DB 54522
# (digeser dari default 5432x karena port itu dipakai stack Supabase lain di mesin ini)
npx supabase status -o env > supabase.env   # nilai URL & key lokal
```

Salin isi `supabase.env` ke `.env.local` (ubah nama variabel bila perlu):

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY dari supabase.env>
SUPABASE_SECRET_KEY=<SERVICE_ROLE_KEY dari supabase.env>
```

Terapkan skema (semua migrasi, urut nama file):

```bash
npx supabase db reset      # drop + apply supabase/migrations/*
```

Buat akun demo + data awal (khusus DB uji):

```bash
npx tsx scripts/seed-dummy.ts
```

Jalankan aplikasi:

```bash
npm run dev                # http://localhost:3000
```

Akun demo hasil seed (semua kata sandi `password123`, **khusus DB uji**):

| Peran | Email | Nama |
|---|---|---|
| Admin | `admin.lab@labmanage.test` | Ahmad Zaki Fauzan |
| Anggota Tim Riset | `dimas.eros@labmanage.test` | Dimas Aditya |
| Anggota Tim Riset | `farhan.eros@labmanage.test` | Farhan Yudha |
| Anggota Tim Riset | `bayu.eira@labmanage.test` | Bayu Setiawan |
| Anggota UKM | `rina.robo@labmanage.test` | Rina Kusuma |
| Anggota UKM | `doni.robo@labmanage.test` | Doni Pratama |
| Advisor | `budi.advisor@labmanage.test` | Dr. Ir. Budi Santoso |

## 3. Membuat akun nyata (untuk uji nyata, bukan demo)

Akun produksi tidak boleh memakai `password123`. Cara membuatnya:

- Di Supabase Dashboard → **Authentication → Users → Add user** (email + password buatan sendiri, centang **Auto Confirm User**), lalu catat UUID user tersebut.
- Buat kelompok bila belum ada (SQL Editor):

```sql
INSERT INTO public.kelompok (nama, jenis, target_jam_mingguan)
VALUES ('Tim Riset EROS', 'tim_riset', 10), ('Roboholic', 'ukm', NULL);
```

- Isi baris `profiles` (SQL Editor):

```sql
INSERT INTO public.profiles (id, nama, nim, role, kelompok_id, email)
VALUES (
  '<UUID dari Authentication>',
  'Nama Lengkap',
  'NIM/NIP',
  'anggota',            -- admin | anggota | advisor
  '<UUID kelompok dari tabel kelompok>',
  'email@domain'
);
```

- Bagikan kredensial ke pengguna lewat kanal resmi lab. Jangan menyimpan kata sandi di repo.

## 4. Reset data uji

- **Reset total DB lokal**: `npx supabase db reset` lalu `npx tsx scripts/seed-dummy.ts`.
- **Bersihkan data uji dari skrip**: skrip `scripts/test-*.ts` membuat baris inventaris uji berprefiks `TEST-ITEM-`; hapus manual bila perlu:

```sql
DELETE FROM public.inventory_items WHERE kode LIKE 'TEST-ITEM-%';
```

- **Reset akun demo**: `npx tsx scripts/seed-dummy.ts` (idempoten).

## 5. Menjalankan pengujian otomatis

```bash
npx tsc --noEmit        # type check
npm run lint            # harus 0 error
npm run test            # unit test (vitest)
npm run build           # butuh NODE_OPTIONS bila RAM kecil
```

Uji hak akses & siklus pinjam (butuh DB uji lokal; keluar non-zero bila gagal):

```bash
# Isi .env.test.local dengan SUPABASE_TEST_URL & SUPABASE_TEST_ANON_KEY lokal
npx tsx scripts/test-rls.ts              # 7/7   RLS inti per peran
npx tsx scripts/test-inventory-admin.ts  # 9/9   stok, verifikasi, penyelesaian
npx tsx scripts/test-role-matrix.ts      # 44/44 matriks hak akses 4 peran
```

Uji SQL langsung di database (memakai container DB dari `supabase/config.toml`):

```bash
# Semua skrip SQL sekaligus (siklus pinjam + konfigurasi SECURITY DEFINER)
bash scripts/run-db-checks.sh            # 15/15 PASS

# Satu per satu
docker exec -i <container-db> psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < scripts/verify-loan-lifecycle.sql     # 10/10 PASS
docker exec -i <container-db> psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < scripts/verify-security-definer.sql  # 5/5 PASS
```

> `verify-security-definer.sql` **gagal** (exit non-zero) kalau helper `labmanage.has_profile()` atau `labmanage.is_admin()` kehilangan `SECURITY DEFINER` atau `search_path`-nya dilepas. Uji negatifnya sudah dilakukan: menurunkan `has_profile()` ke `SECURITY INVOKER` → 3 skenario FAIL + exit 1.

## 6. Mode demo (tanpa database)

Untuk presentasi lokal tanpa Supabase:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Banner kuning "Mode Demo — data contoh, perubahan tidak disimpan" muncul di aplikasi dan semua aksi tulis ditolak. **Jangan nyalakan di produksi.**

## 7. Melapor bug

Sertakan info berikut (lihat `docs/QA-CHECKLIST.md` untuk daftar skenario):

1. Peran & akun yang dipakai.
2. Langkah reproduksi bernomor.
3. Hasil yang diharapkan vs hasil sebenarnya.
4. Pesan error **utuh** (kutipan, bukan ringkasan).
5. Screenshot.
6. Waktu kejadian (WIB) dan URL yang dipakai.
