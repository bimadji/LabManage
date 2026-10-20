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
| `api/.env.test` | sama seperti `api/.env`; `SUPABASE_URL` wajib `127.0.0.1` atau `localhost` |
| `web/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

Menyiapkan database dan data demo:

```bash
npx supabase db reset   # terapkan migrasi + seed ruang dan alat
cd api && npm run db:seed-users
```

`db:seed-users` membuat tiga akun demo dan aktivitasnya. Aman dijalankan berulang.

| Akun | Kata sandi | Peran |
| --- | --- | --- |
| `anggota@labmanage.test` | `anggota123` | anggota |
| `admin@labmanage.test` | `admin123` | admin |
| `advisor@labmanage.test` | `advisor123` | advisor |

## 2. Menjalankan aplikasi

```bash
npm run dev --prefix api   # http://localhost:4000
npm run dev --prefix web   # http://localhost:5173
```

Masuk di web memakai salah satu akun demo di atas.

## 3. Memakai aplikasi per peran

### Notifikasi pribadi (semua peran)

Buka **Notifikasi** (`/notifikasi`) untuk melihat pesan akun Anda, terbaru terlebih dahulu: reservasi, lembur, laporan fasilitas, dan inventaris. Setiap pesan menampilkan waktu dalam WIB serta label **Belum dibaca** atau **Sudah dibaca**. Tekan **Tandai sudah dibaca** pada pesan yang belum dibaca; jika penyimpanan gagal, status tetap dipertahankan dan aksi dapat dicoba lagi.

Gunakan **Muat ulang** untuk mengambil pesan dan status terbaru, atau **Coba lagi** jika daftar gagal dimuat. Admin dan advisor juga hanya melihat notifikasi miliknya sendiri.

### Anggota

- **Jadwal** (`/jadwal`): daftar reservasi dua minggu ke depan, dikelompokkan per hari, bisa difilter per ruang.
- **Reservasi** (`/reservasi/baru`): pilih ruang atau alat, isi tim, waktu mulai, dan waktu selesai. Reservasi ditolak jika waktunya bertabrakan dengan reservasi aktif lain di ruang yang sama, atau jika berada di luar jam operasional 07:00–21:00 WIB.
- **Kehadiran** (`/kehadiran`): tekan **Check-in** saat mulai riset, lalu **Check-out** saat selesai. Halaman menampilkan sesi sendiri yang terakhir, waktu mulai/selesai dalam WIB, dan durasi. Sesi aktif tetap terlihat setelah halaman dimuat ulang; data diperbarui setiap 30 detik dan saat kembali ke tab. Satu anggota hanya boleh punya satu sesi terbuka. Jika koneksi gagal, gunakan **Coba lagi** sebelum mengirim aksi berikutnya.
- **Laporan fasilitas** (`/laporan-fasilitas`): pilih kategori lampu, ventilasi, atau kerusakan; isi lokasi dan deskripsi 5–1000 karakter. Anggota melihat laporan miliknya sendiri beserta status tindak lanjutnya.
- **Inventaris** (`/inventaris`): daftar komponen habis pakai dan barang satuan. Komponen diberi tanda `HABIS` (stok 0), `MENIPIS` (stok ≤ minimum), atau `AMAN`; barang diberi tanda `TERSEDIA` atau `DIPINJAM` beserta nama peminjam. Pencarian dan filter jenis/status berjalan di browser.
- **Lapor ambil komponen**: tombol `Lapor ambil` membuka form jumlah dan catatan. Laporan berstatus `MENUNGGU` sampai admin mengonfirmasi; stok baru berkurang saat dikonfirmasi.
- **Ajukan pinjam barang**: hanya untuk barang `TERSEDIA`. Isi keperluan (wajib) dan perkiraan tanggal kembali (opsional). Permintaan berstatus `MENUNGGU` sampai disetujui admin.
- **Permintaan saya** (`/inventaris/permintaan-saya`): status laporan ambil dan permintaan pinjam, catatan admin, serta tombol `Batalkan` selama permintaan pinjam masih `MENUNGGU`.

### Admin

- **Kehadiran** (`/kehadiran`): check-in/check-out dan melihat sesi pribadi dengan alur yang sama seperti anggota.
- Melihat semua reservasi, membatalkan reservasi siapa pun.
- **Inventaris**: membuat item (`/inventaris/baru`), mengubah jumlah komponen, menandai barang kembali, mengubah detail, dan menghapus item dari halaman detail `/inventaris/:id`.
- **Kotak masuk inventaris** (`/inventaris/kotak-masuk`): mengonfirmasi atau menolak laporan ambil komponen, serta menyetujui atau menolak permintaan pinjam barang. Badge di samping tautan `Inventaris` menunjukkan jumlah permintaan yang masih menunggu.
- Setiap perubahan jumlah, konfirmasi, persetujuan, dan pengembalian tercatat di riwayat item beserta aktor dan waktunya.
- **Laporan fasilitas** (`/laporan-fasilitas`): melihat semua laporan, membuat laporan, serta mengubah status dengan tombol **Tindak lanjuti**, lalu **Tandai selesai**. Alurnya `baru → ditindaklanjuti → selesai`; transisi lain ditolak. Pelapor mendapat notifikasi saat status berubah.
- Melihat dashboard monitoring (`/monitor`).

### Advisor

- Melihat dashboard monitoring (`/monitor`): siapa yang sedang di lab, jam mulai, durasi berjalan, dan tanda jika sesi melewati 21:00 WIB. Daftar diperbarui otomatis lewat Supabase Realtime.
- **Laporan fasilitas** (`/laporan-fasilitas`): melihat semua laporan dan statusnya tanpa formulir pembuatan atau tombol perubahan status.
- Melihat inventaris dan kotak masuk permintaan (`/inventaris/kotak-masuk`) tanpa tombol aksi; advisor tidak dapat mengajukan permintaan atau mengubah item.
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
| GET | `/attendance/me` | anggota, admin (sesi sendiri yang terakhir beserta `durationMinutes`; `null` jika belum ada) |
| GET | `/inventory?kind=&flag=&q=` | semua peran |
| POST | `/inventory` | admin |
| PATCH | `/inventory/:id` | admin |
| DELETE | `/inventory/:id` | admin |
| PATCH | `/inventory/:id/quantity` | admin |
| PATCH | `/inventory/:id/return` | admin |
| GET | `/inventory/:id/history` | semua peran |
| POST | `/component-requests` | anggota, admin |
| GET | `/component-requests?status=` | anggota (milik sendiri), admin, advisor (semua) |
| PATCH | `/component-requests/:id/confirm` | admin |
| PATCH | `/component-requests/:id/reject` | admin |
| PATCH | `/component-requests/:id/read` | admin |
| POST | `/loan-requests` | anggota, admin |
| GET | `/loan-requests?status=` | anggota (milik sendiri), admin, advisor (semua) |
| PATCH | `/loan-requests/:id/approve` | admin |
| PATCH | `/loan-requests/:id/reject` | admin |
| PATCH | `/loan-requests/:id/cancel` | pemilik |
| PATCH | `/loan-requests/:id/read` | admin |
| GET | `/inventory/pending-count` | admin |
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
