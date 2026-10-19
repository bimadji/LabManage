# Panduan penggunaan LabManage

Panduan ini menjelaskan cara menyiapkan lingkungan, memakai aplikasi per peran, dan menjalankan pemeriksaan kualitas.

## 1. Menyiapkan lingkungan

Prasyarat: Node.js 22 LTS, npm, dan Docker Desktop yang sedang berjalan.

```bash
npm ci                     # tooling dokumen + Supabase CLI
npm ci --prefix api
npm ci --prefix web
npm run db:start           # Supabase lokal di Docker
npx supabase status -o env # ambil URL dan kunci lokal
```

Isi tiga file env (semua diabaikan git):

| File | Variabel |
| --- | --- |
| `api/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `WEB_ORIGIN`, `JOB_SECRET` |
| `api/.env.test` | sama seperti `api/.env`, ditambah `DEMO_PASSWORD`; `SUPABASE_URL` wajib `127.0.0.1` atau `localhost` |
| `web/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

Menyiapkan database dan data demo:

```bash
npx supabase db reset   # terapkan migrasi + seed ruang dan alat
cd api && npm run db:seed-users
```

`db:seed-users` membuat tiga akun demo dan aktivitasnya. Aman dijalankan berulang.

| Akun | Peran |
| --- | --- |
| `anggota@labmanage.test` | anggota |
| `admin@labmanage.test` | admin |
| `advisor@labmanage.test` | advisor |

Kata sandi ketiganya adalah nilai `DEMO_PASSWORD` di `api/.env.test`.

## 2. Menjalankan aplikasi

```bash
npm run dev --prefix api   # http://localhost:4000
npm run dev --prefix web   # http://localhost:5173
```

Masuk di web memakai salah satu akun demo di atas.

## 3. Memakai aplikasi per peran

### Anggota

- **Jadwal** (`/jadwal`): daftar reservasi dua minggu ke depan, dikelompokkan per hari, bisa difilter per ruang.
- **Reservasi** (`/reservasi/baru`): pilih ruang atau alat, isi tim, waktu mulai, dan waktu selesai. Reservasi ditolak jika waktunya bertabrakan dengan reservasi aktif lain di ruang yang sama, atau jika berada di luar jam operasional 07:00–21:00 WIB.
- **Check-in / check-out**: lewat API `POST /attendance/check-in` dan `POST /attendance/check-out`. Satu anggota hanya boleh punya satu sesi terbuka.

### Admin

- Melihat semua reservasi, membatalkan reservasi siapa pun.
- Mengelola katalog alat: `POST /equipment`.
- Mengubah status laporan fasilitas: `baru → ditindaklanjuti → selesai`. Transisi lain ditolak.
- Melihat dashboard monitoring (`/monitor`).

### Advisor

- Melihat dashboard monitoring (`/monitor`): siapa yang sedang di lab, jam mulai, durasi berjalan, dan tanda jika sesi melewati 21:00 WIB. Daftar diperbarui otomatis lewat Supabase Realtime.
- Melihat semua laporan fasilitas tanpa bisa mengubahnya.
- Tidak dapat membuat reservasi, check-in, atau meminjam alat.

## 4. Endpoint yang sering dipakai

| Method | Path | Peran |
| --- | --- | --- |
| GET | `/health` | publik |
| GET | `/rooms` | semua peran |
| GET | `/reservations?from=&to=` | semua peran |
| POST | `/reservations` | anggota, admin |
| PATCH | `/reservations/:id/cancel` | pemilik, admin |
| POST | `/attendance/check-in` | anggota, admin |
| POST | `/attendance/check-out` | anggota, admin |
| GET | `/attendance/present` | admin, advisor |
| GET | `/equipment` | semua peran |
| POST | `/equipment` | admin |
| POST | `/equipment/:id/loans` | anggota, admin |
| PATCH | `/equipment/loans/:loanId/return` | peminjam, admin |
| POST | `/facility-reports` | anggota, admin |
| GET | `/facility-reports` | anggota (milik sendiri), admin, advisor (semua) |
| PATCH | `/facility-reports/:id/status` | admin |
| GET | `/notifications` | semua peran (milik sendiri) |
| PATCH | `/notifications/:id/read` | pemilik |
| POST | `/internal/jobs/overnight` | header `X-Job-Secret` |

Format error selalu `{"error":{"code":"...","message":"..."}}`. Error validasi menambahkan `issues` berisi daftar field.

## 5. Menjalankan pemeriksaan

```bash
cd api && npm run lint && npm test && npm run build
cd web && npm run lint && npm test && npm run build
npm run lint:md && npm run check:mermaid && npm run check:links
```

`check:mermaid` merender setiap blok Mermaid lewat `mmdc`, yang butuh Chromium. Setelah clone baru, jalankan sekali:

```bash
npm run setup:mermaid-browser
```

Responsivitas diperiksa pada lebar 375px, 768px, dan 1280px. Pada setiap lebar, jalankan di konsol browser:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

Nilai harus `true`.

## 6. Job peringatan malam

Sesi terbuka yang melewati 21:00 WIB ditandai `overNightLimit` pada `GET /attendance/present`, dan pemiliknya mendapat notifikasi lewat job:

```bash
curl -X POST http://localhost:4000/internal/jobs/overnight -H "X-Job-Secret: $JOB_SECRET"
```

`dedupe_key` `overnight:<userId>:<YYYY-MM-DD>` memastikan satu notifikasi per anggota per hari, berapa kali pun job dijalankan. Tanpa `JOB_SECRET` di env API, endpoint ini selalu 401.
