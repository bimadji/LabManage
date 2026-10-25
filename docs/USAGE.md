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

| File            | Variabel                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `api/.env`      | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `WEB_ORIGIN`, `JOB_SECRET` |
| `api/.env.test` | sama seperti `api/.env`; `SUPABASE_URL` wajib `127.0.0.1` atau `localhost`                           |
| `web/.env`      | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`                                        |

Menyiapkan database dan data demo:

```bash
npx supabase db reset   # terapkan migrasi + seed ruang dan alat
cd api && npm run db:seed-users
```

`db:seed-users` membuat tiga akun demo dan aktivitasnya. Aman dijalankan berulang.

| Akun                     | Kata sandi   | Peran   |
| ------------------------ | ------------ | ------- |
| `anggota@labmanage.test` | `anggota123` | anggota |
| `admin@labmanage.test`   | `admin123`   | admin   |
| `advisor@labmanage.test` | `advisor123` | advisor |

## 2. Menjalankan aplikasi

```bash
npm run dev --prefix api   # http://localhost:4000
npm run dev --prefix web   # http://localhost:5173
```

Masuk di web memakai salah satu akun demo di atas. Pada layar sempit, buka **Menu** untuk menampilkan navigasi; menu menutup setelah tujuan dipilih. Mulai lebar 768 px, navigasi tampil sebagai rail di sisi kiri. **Lewati ke konten utama** tersedia sebagai target Tab pertama untuk pengguna keyboard. Subtautan di bawah **Inventaris**, **Monitoring**, dan **Kehadiran** membuka halaman turunan yang tersedia bagi peran aktif.

## 3. Memakai aplikasi per peran

### Notifikasi pribadi (semua peran)

Buka **Notifikasi** (`/notifikasi`) untuk melihat pesan akun Anda, terbaru terlebih dahulu: reservasi, lembur, laporan fasilitas, dan inventaris. Setiap pesan menampilkan waktu dalam WIB serta label **Belum dibaca** atau **Sudah dibaca**. Tekan **Tandai sudah dibaca** pada pesan yang belum dibaca; jika penyimpanan gagal, status tetap dipertahankan dan aksi dapat dicoba lagi.

Gunakan **Muat ulang** untuk mengambil pesan dan status terbaru, atau **Coba lagi** jika daftar gagal dimuat. Admin dan advisor juga hanya melihat notifikasi miliknya sendiri.

### Anggota

- **Jadwal** (`/jadwal`): daftar reservasi dua minggu ke depan, dikelompokkan per hari, bisa difilter per ruang.
- **Reservasi** (`/reservasi/baru`): pilih ruang atau alat, isi tim, waktu mulai, dan waktu selesai. Reservasi ditolak jika waktunya bertabrakan dengan reservasi aktif lain di ruang yang sama, atau jika berada di luar jam operasional 07:00–21:00 WIB.
- **Kehadiran** (`/kehadiran`): tekan **Check-in** saat mulai riset, lalu **Check-out** saat selesai. Halaman menampilkan sesi sendiri yang terakhir, waktu mulai/selesai dalam WIB, dan durasi. Sesi aktif tetap terlihat setelah halaman dimuat ulang; data diperbarui setiap 30 detik dan saat kembali ke tab. Satu anggota hanya boleh punya satu sesi terbuka. Jika koneksi gagal, gunakan **Coba lagi** sebelum mengirim aksi berikutnya.
- **Rekap dan peringatan saya** (`/kehadiran/rekap`), dibuka dari halaman Kehadiran: pilih mingguan/bulanan dan tanggal dalam periode WIB, lalu tekan **Tampilkan**. Rekap memuat total jam, target, status KURANG/TERCAPAI, jumlah sesi, tingkat kehadiran, dan rincian per hari. **Muat ulang** memperbarui rekap serta peringatan; riwayat peringatan menampilkan semua periode dengan target/durasi saat dikirim. Buka **Notifikasi** untuk menandai pesan sudah dibaca. Jika satu bagian gagal dimuat, bagian lainnya tetap tersedia dan tombol coba lagi disediakan.
- **Laporan fasilitas** (`/laporan-fasilitas`): pilih kategori lampu, ventilasi, atau kerusakan; isi lokasi dan deskripsi 5–1000 karakter. Anggota melihat laporan miliknya sendiri beserta status tindak lanjutnya.
- **Inventaris** (`/inventaris`): daftar komponen habis pakai dan barang satuan. Komponen diberi tanda `HABIS` (stok 0), `MENIPIS` (stok ≤ minimum), atau `AMAN`; barang diberi tanda `TERSEDIA` atau `DIPINJAM` beserta nama peminjam. Pencarian dan filter jenis/status berjalan di browser.
- **Lapor ambil komponen**: tombol `Lapor ambil` membuka form jumlah dan catatan. Laporan berstatus `MENUNGGU` sampai admin mengonfirmasi; stok baru berkurang saat dikonfirmasi.
- **Ajukan pinjam barang**: hanya untuk barang `TERSEDIA`. Isi keperluan (wajib) dan perkiraan tanggal kembali (opsional). Permintaan berstatus `MENUNGGU` sampai disetujui admin.
- **Permintaan saya** (`/inventaris/permintaan-saya`): status laporan ambil dan permintaan pinjam, catatan admin, serta tombol `Batalkan` selama permintaan pinjam masih `MENUNGGU`.

### Admin

- Dari Monitoring, buka **Statistik, target, dan koreksi absensi** (`/monitor/admin`). Pilih minggu/bulan, tanggal WIB, dan jumlah minggu tren (1–52) untuk melihat total jam, rata-rata mingguan, kehadiran, jumlah anggota KURANG, serta porsi sesi lewat 21:00 WIB. Statistik anggota dan ringkasan memakai hasil perhitungan server; target historis mengikuti target yang berlaku saat dimuat.
- **Target mingguan** menerima menit bulat 0–10080 dan berlaku global bagi anggota. Simpan target untuk memperbarui statistik; target bulanan dihitung proporsional terhadap panjang bulan.
- **Koreksi sesi terbuka**: isi waktu check-out yang sebenarnya dalam **WIB** dan alasan 5–1000 karakter. Waktu harus sesudah check-in dan tidak di masa depan. Hanya sesi terbuka yang dapat ditutup; bila anggota sudah check-out, server menolak koreksi dan menampilkan alasannya. Riwayat menampilkan waktu selesai, alasan, aktor, waktu pencatatan, dan identitas audit. Gunakan **Muat ulang semua** untuk menyegarkan data; draf formulir akan dimuat ulang juga.

- **Kehadiran** (`/kehadiran`): check-in/check-out dan melihat sesi pribadi dengan alur yang sama seperti anggota.
- Melihat semua reservasi, membatalkan reservasi siapa pun.
- **Inventaris**: membuat item (`/inventaris/baru`), mengubah jumlah komponen, menandai barang kembali, mengubah detail, dan menghapus item dari halaman detail `/inventaris/:id`.
- **Kotak masuk inventaris** (`/inventaris/kotak-masuk`): mengonfirmasi atau menolak laporan ambil komponen, serta menyetujui atau menolak permintaan pinjam barang. Badge di samping subtautan **Kotak masuk** menunjukkan jumlah permintaan yang masih menunggu.
- Setiap perubahan jumlah, konfirmasi, persetujuan, dan pengembalian tercatat di riwayat item beserta aktor dan waktunya.
- **Laporan fasilitas** (`/laporan-fasilitas`): melihat semua laporan, membuat laporan, serta mengubah status dengan tombol **Tindak lanjuti**, lalu **Tandai selesai**. Alurnya `baru → ditindaklanjuti → selesai`; transisi lain ditolak. Pelapor mendapat notifikasi saat status berubah.
- Melihat dashboard monitoring (`/monitor`).

### Advisor

- Melihat dashboard monitoring (`/monitor`): siapa yang sedang di lab, jam mulai, durasi berjalan, dan tanda jika sesi melewati 21:00 WIB. Daftar diperbarui otomatis lewat Supabase Realtime.
- Dari Monitoring, buka **Rekap anggota dan peringatan** (`/monitor/rekap`): pilih minggu/bulan dan tanggal WIB untuk melihat durasi, target, sesi, status KURANG/TERCAPAI, dan rincian harian semua anggota. **Muat ulang rekap** mengambil kondisi terbaru.
- **Kirim peringatan** tersedia untuk anggota KURANG pada rekap minggu berjalan, dengan catatan opsional maksimal 1000 karakter. Pilih **Minggu ini** saat sedang melihat bulan atau minggu historis. Server memeriksa target terbaru dan membatasi satu peringatan per anggota per hari; kegagalan ditampilkan tanpa mengklaim pesan terkirim. Advisor tidak dapat mengubah target atau mengoreksi absensi.
- **Laporan fasilitas** (`/laporan-fasilitas`): melihat semua laporan dan statusnya tanpa formulir pembuatan atau tombol perubahan status.
- Melihat inventaris dan kotak masuk permintaan (`/inventaris/kotak-masuk`) tanpa tombol keputusan; kotak masuk hanya menampilkan permintaan `menunggu`. Advisor dapat mengajukan lapor ambil dan permintaan pinjam inventaris, tetapi tidak dapat mengubah item atau memutuskan permintaan.
- Tidak dapat membuat reservasi, check-in, atau meminjam alat.

## 4. Endpoint yang sering dipakai

| Method | Path                                          | Peran                                                                                        |
| ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/health`                                     | publik                                                                                       |
| GET    | `/rooms`                                      | semua peran                                                                                  |
| GET    | `/reservations?from=&to=`                     | semua peran                                                                                  |
| POST   | `/reservations`                               | anggota, admin                                                                               |
| PATCH  | `/reservations/:id/cancel`                    | pemilik, admin                                                                               |
| POST   | `/attendance/check-in`                        | anggota, admin                                                                               |
| POST   | `/attendance/check-out`                       | anggota, admin                                                                               |
| GET    | `/attendance/present`                         | admin, advisor                                                                               |
| GET    | `/attendance/me`                              | anggota, admin (sesi sendiri yang terakhir beserta `durationMinutes`; `null` jika belum ada) |
| GET    | `/attendance/target`                          | semua peran                                                                                  |
| PUT    | `/attendance/target`                          | admin                                                                                        |
| GET    | `/attendance/summary?period=&date=&userId=`   | anggota (sendiri), admin/advisor (anggota pilihan atau semua)                                |
| GET    | `/attendance/statistics?period=&date=&weeks=` | admin                                                                                        |
| GET    | `/attendance/warnings?userId=`                | anggota (sendiri), admin/advisor (semua)                                                     |
| POST   | `/attendance/warnings`                        | advisor                                                                                      |
| PATCH  | `/attendance/:id/correct-check-out`           | admin                                                                                        |
| GET    | `/attendance/corrections?userId=`             | anggota (sendiri), admin/advisor (semua)                                                     |
| GET    | `/inventory?kind=&flag=&q=`                   | semua peran                                                                                  |
| POST   | `/inventory`                                  | admin                                                                                        |
| PATCH  | `/inventory/:id`                              | admin                                                                                        |
| DELETE | `/inventory/:id`                              | admin                                                                                        |
| PATCH  | `/inventory/:id/quantity`                     | admin                                                                                        |
| PATCH  | `/inventory/:id/return`                       | admin                                                                                        |
| GET    | `/inventory/:id/history`                      | semua peran                                                                                  |
| POST   | `/component-requests`                         | anggota, advisor                                                                             |
| GET    | `/component-requests?status=`                 | anggota (milik sendiri), admin, advisor (semua)                                              |
| PATCH  | `/component-requests/:id/confirm`             | admin                                                                                        |
| PATCH  | `/component-requests/:id/reject`              | admin                                                                                        |
| PATCH  | `/component-requests/:id/read`                | admin                                                                                        |
| POST   | `/loan-requests`                              | anggota, advisor                                                                             |
| GET    | `/loan-requests?status=`                      | anggota (milik sendiri), admin, advisor (semua)                                              |
| PATCH  | `/loan-requests/:id/approve`                  | admin                                                                                        |
| PATCH  | `/loan-requests/:id/reject`                   | admin                                                                                        |
| PATCH  | `/loan-requests/:id/cancel`                   | pemilik                                                                                      |
| PATCH  | `/loan-requests/:id/read`                     | admin                                                                                        |
| GET    | `/inventory/pending-count`                    | admin                                                                                        |
| POST   | `/facility-reports`                           | anggota, admin                                                                               |
| GET    | `/facility-reports`                           | anggota (milik sendiri), admin, advisor (semua)                                              |
| PATCH  | `/facility-reports/:id/status`                | admin                                                                                        |
| GET    | `/notifications`                              | semua peran (milik sendiri)                                                                  |
| PATCH  | `/notifications/:id/read`                     | pemilik                                                                                      |
| POST   | `/internal/jobs/overnight`                    | header `X-Job-Secret`                                                                        |

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
document.documentElement.scrollWidth <= window.innerWidth;
```

Nilai harus `true`.

## 6. Job peringatan malam

Sesi terbuka yang melewati 21:00 WIB ditandai `overNightLimit` pada `GET /attendance/present`, dan pemiliknya mendapat notifikasi lewat job:

```bash
curl -X POST http://localhost:4000/internal/jobs/overnight -H "X-Job-Secret: $JOB_SECRET"
```

`dedupe_key` `overnight:<userId>:<YYYY-MM-DD>` memastikan satu notifikasi per anggota per hari, berapa kali pun job dijalankan. Tanpa `JOB_SECRET` di env API, endpoint ini selalu 401.

## 7. Backend absensi riset

Tugas 2A menyediakan API berikut dengan header `Authorization: Bearer <JWT>`. UI anggota tersedia pada `/kehadiran/rekap` (Tugas 2B), UI advisor pada `/monitor/rekap` (Tugas 2C), dan UI admin pada `/monitor/admin` (Tugas 2D). Check-in/check-out dan halaman notifikasi yang sudah ada tetap dapat digunakan.

### Periode dan perhitungan

- `period` adalah `week` (default) atau `month`; `date` adalah tanggal kalender valid `YYYY-MM-DD`, default hari ini dalam WIB.
- Minggu berlangsung Senin 00:00 sampai Senin berikutnya 00:00 WIB; bulan mengikuti kalender. Batas akhir tidak termasuk periode.
- Sesi dibagi pada batas hari/periode dan dibatasi waktu sekarang, termasuk sesi terbuka. Akumulasi memakai milidetik, kemudian dikonversi ke menit pecahan tanpa pembulatan sebelum membandingkan target. Presisi timestamp di bawah milidetik dipotong agar SQL dan JavaScript konsisten.
- Target mingguan global default 600 menit (10 jam). Target bulanan = target mingguan × jumlah hari bulan ÷ 7. `KURANG` berarti total menit di bawah target; tepat target berstatus `TERCAPAI`.
- Hari hadir memiliki durasi positif. `attendanceRate` = hari hadir ÷ hari kalender yang sudah berlalu dalam periode, termasuk hari berjalan; 0 untuk periode yang belum dimulai.
- `averageWeeklyHours` = total jam ÷ (jumlah hari periode ÷ 7). Minggu/bulan berjalan tetap memakai panjang periode penuh.
- `overNightSessionRatio` = sesi dengan irisan positif setelah 21:00 sampai 24:00 WIB ÷ jumlah sesi dalam periode. Sesi lintas tengah malam tetap dihitung sekali; bagian sesi di luar periode tidak dihitung.
- Rekap memakai roster anggota dan target yang berlaku saat permintaan, termasuk untuk periode historis. Log peringatan menyimpan snapshot target dan durasi saat dikirim.

`GET /attendance/summary` mengembalikan `{period, weeklyTargetMinutes, targetMinutes, members}`. `period` berisi `kind`, `start`, `end` (ISO UTC), dan `days` (tanggal WIB). Setiap anggota berisi `userId`, `fullName`, `totalMinutes`, `totalHours`, `sessionCount`, `targetMinutes`, `status`, `days` (`date`, `minutes`, `sessionCount`), `daysPresent`, `elapsedDays`, `attendanceRate`, `averageWeeklyHours`, `overNightSessionCount`, dan `overNightSessionRatio`.

Anggota hanya dapat membaca rekap sendiri; permintaan `userId` orang lain mendapat 403. Admin/advisor dapat memilih satu anggota atau menghilangkan `userId` untuk seluruh anggota. Profil admin/advisor tidak termasuk roster riset.

`GET /attendance/statistics` menambahkan `aggregate` dan `trend` pada respons rekap. `weeks` adalah integer 1–52 (default 8); tren berakhir pada minggu yang mengandung tanggal pilihan. Agregat berisi jumlah anggota, total menit/jam, jumlah sesi, jumlah anggota KURANG, rata-rata jam mingguan per anggota, tingkat kehadiran keseluruhan, serta jumlah/rasio sesi malam. Rasio memakai jumlah pembilang dan penyebut keseluruhan, bukan rata-rata rasio sesi per anggota. Setiap baris tren memiliki periode minggu dan agregat yang sama. Daftar dibaca berhalaman secara internal agar tidak terpotong batas 1.000 baris Supabase.

### Target, peringatan, dan koreksi

- `PUT /attendance/target`: body `{"weeklyTargetMinutes":600}`; integer 0–10080. Respons `{weeklyTargetMinutes, updatedAt, updatedBy}` juga dipakai GET. Hanya admin dapat mengubah target; aktor/waktu audit berasal dari database.
- `POST /attendance/warnings`: body `{"userId":"<uuid>","note":"Jadwalkan riset"}`. Catatan opsional, maksimal 1.000 karakter setelah trim. Advisor hanya dapat mengingatkan anggota KURANG pada **minggu berjalan**, bukan periode yang sedang dilihat di UI.
- Satu anggota menerima maksimal satu peringatan per tanggal WIB, lintas advisor dan permintaan bersamaan. Notifikasi jenis `kehadiran` dan log dibuat dalam satu transaksi. Target tercapai atau kuota harian terpakai menghasilkan 409 (`TARGET_MET`/`WARNING_ALREADY_SENT`). Penerima yang bukan anggota menghasilkan 404.
- Respons peringatan dan daftar riwayat memuat `id`, `userId`, `advisorId`, `weekStart`, `warningDate`, `note`, `message`, `totalMinutes`, `targetMinutes`, `notificationId`, `createdAt`. Notifikasi dapat dibaca dan ditandai melalui halaman `/notifikasi`.
- `PATCH /attendance/:id/correct-check-out`: body `{"checkedOutAt":"2026-10-20T18:00:00+07:00","reason":"Lupa check-out setelah riset"}`. Admin hanya dapat menutup sesi yang masih terbuka; waktu selesai harus setelah mulai dan tidak melebihi sekarang. Alasan wajib 5–1.000 karakter setelah trim.
- Koreksi dan audit disimpan atomik. Respons koreksi/riwayat berisi `id`, `attendanceId`, `userId`, `actorId`, `oldCheckedOutAt`, `checkedOutAt`, `reason`, `createdAt`. Sesi yang sudah ditutup menghasilkan 409 `SESSION_NOT_OPEN`.
- Riwayat peringatan/koreksi hanya dapat dibaca pemilik, admin, dan advisor. Klien tidak dapat menulis atau menghapus log langsung. Advisor tidak dapat mengubah sesi; koreksi admin ke sesi anggota wajib melalui endpoint/RPC agar tercatat.

### Memperbarui database lokal tanpa reset

Untuk database lokal yang sudah berisi data, terapkan hanya migrasi tertunda:

```bash
npm run db:start
npx supabase migration up --local
npm test --prefix api
```

Migrasi menambahkan target awal hanya jika belum ada. Tidak perlu reset database untuk pembaruan ini. CI menguji seluruh urutan migrasi pada Supabase baru.

Seed akun demo menambahkan tiga sesi selesai minggu lalu (termasuk lintas tengah malam), satu sesi terbuka, serta satu peringatan historis dengan snapshot 360/600 menit dan notifikasi terkait. Target yang sudah diatur admin dipertahankan. `npm run db:seed-users --prefix api` membuat ulang aktivitas akun demo; jalankan hanya pada lingkungan demo yang memang hendak diisi ulang. Untuk memeriksa perubahan tanpa mengganti aktivitas pengguna lokal, jalankan test yang memakai fixture pengguna terpisah.
