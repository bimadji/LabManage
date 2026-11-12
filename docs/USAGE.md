# Panduan Penggunaan — LabManage

Dokumen ini memandu pengoperasian dan navigasi fitur **LabManage** bagi seluruh peran pengguna laboratorium.

---

## 1. Masuk ke Aplikasi

Seluruh pengguna masuk dengan akun masing-masing. Halaman **/login** meminta email dan kata sandi; peran dan kelompok otomatis diambil dari data akun tersebut, sehingga hak akses tidak bisa diganti dari sisi browser.

- **Admin** (Kepala Lab Robotika PENS): verifikasi peminjaman, pengelolaan inventaris, laporan kendala.
- **Anggota Tim Riset**: presensi lab dengan target jam mingguan, peminjaman alat, pemesanan ruang.
- **Anggota UKM Roboholic**: bebas target jam riset, tetap bisa meminjam alat dan memesan ruang.
- **Advisor** (Dosen Pembina): memantau jam riset dan rekap peminjaman; verifikasi tetap dilakukan Admin.

Untuk pengujian antarmuka tanpa database, jalankan dengan `NEXT_PUBLIC_DEMO_MODE=true`. Dalam mode ini aplikasi menampilkan banner **Mode Demo** dan tersedia menu simulator akun di pojok kanan atas (khusus mode demo).

---

## 2. Pengelolaan Inventaris Lab (Khusus Admin)

### 2.1 Menambah Barang Baru

1. Pastikan profil aktif Anda adalah **Admin**.
2. Masuk ke menu **Inventaris** melalui panel samping (*sidebar*).
3. Klik tombol **Tambah Barang Baru** berwarna ungu di bagian kanan atas banner.
4. Lengkapi formulir pendaftaran barang:
   - Nama komponen/alat.
   - Kode aset unik (misal: `LAB-MCU-05`).
   - Kategori instrumen.
   - Lokasi penyimpanan di rak/loker lab.
   - Jumlah unit awal ($\ge 1$).
   - Kepemilikan: Pilih *Milik Bersama Lab* atau kelompok spesifik.
5. Klik **Simpan Barang**. Data baru langsung terdaftar dan dapat ditelusuri.

### 2.2 Menambah Stok Unit Barang yang Sudah Ada

1. Pada katalog inventaris, temukan kartu barang yang ingin ditambah stoknya.
2. Klik tombol **+ Stok** pada kartu barang tersebut.
3. Masukkan jumlah unit tambahan yang diterima laboratorium (harus bilangan bulat $> 0$).
4. Klik **Tambah Unit**.
5. Stok total dan stok tersedia akan bertambah secara atomik di database. Jika status barang sebelumnya *Habis*, status otomatis beralih menjadi *Tersedia*.

---

## 3. Peminjaman Komponen Lab (Anggota & Advisor)

1. Buka menu **Inventaris**.
2. Temukan barang yang berstatus **Tersedia**, lalu klik tombol **Ajukan Pinjam**.
3. Di panel samping (*slide-over sheet*):
   - Masukkan jumlah unit yang dipinjam (maksimal = stok tersedia).
   - Jelaskan keperluan riset atau proyek robotika Anda.
   - Tentukan tanggal perkiraan pengembalian alat.
4. Klik **Ajukan Pinjaman**.
5. Permohonan tersimpan di database dengan status **Menunggu** dan dapat dipantau pada kartu *Pinjaman Alat Saya* di Beranda Utama.
6. Admin memverifikasi di **Kotak Masuk**: stok dipotong saat disetujui, dan pulih kembali saat barang ditandai dikembalikan (*Tandai Dikembalikan*).

> Admin tidak dapat membuat permohonan peminjaman (dilarang oleh aturan database), dan Advisor hanya memantau.

---

## 4. Presensi Kehadiran Lab (Khusus Anggota Tim Riset)

1. Masuk sebagai anggota tim riset.
2. Di Beranda Utama, lihat kartu **Absensi Kehadiran Lab**.
3. Klik tombol hijau **Check-In Sekarang** saat Anda tiba di lab dan memulai aktivitas mekatronika.
4. Timer durasi sesi aktif akan berjalan secara langsung (*live-timer*).
5. Klik tombol merah **Check-Out & Simpan** saat selesai berkegiatan. Durasi waktu sesi akan diakumulasikan ke pencapaian target mingguan (10 jam).

> **Catatan UKM**: Bagi anggota UKM Roboholic, kartu presensi digantikan dengan kotak informasi *UKM Roboholic: Bebas Target Jam Lab Mingguan*.

---

## 5. Pemesanan Ruangan & Arena Uji Coba

1. Buka menu **Jadwal Ruangan** atau klik tombol **Aksi Cepat $\rightarrow$ Pesan Ruangan** di bilah navigasi.
2. Pilih fasilitas yang diperlukan: *Arena Uji Coba KRAI / KRI*, *Ruang Mekanik & Fabrikasi*, atau *Ruang Diskusi & Pemrograman*.
3. Tentukan tanggal (kalender) dan slot sesi waktu (Pagi / Siang / Malam).
4. Tuliskan deskripsi keperluan pengujian robotika dan jumlah peserta tim.
5. Klik **Konfirmasi Booking**.
6. Sistem memvalidasi ketersediaan waktu (rentang jam) sebelum menyimpan, dan database menolak bentrok yang lolos dari pemeriksaan klien.

---

## 6. Monitoring & Evaluasi Tim (Admin & Advisor)

1. Masuk sebagai Admin atau Advisor.
2. Buka menu **Monitoring Tim & UKM** di panel navigasi.
3. Gunakan filter tab di bagian atas:
   - **Semua Kelompok**: Tinjauan rekapitulasi seluruh mahasiswa lab.
   - **Tim Riset**: Fokus grafik pemenuhan target wajib 10 jam/minggu.
   - **UKM Roboholic**: Tinjauan anggota UKM robotika umum.
4. Amati grafik batang capaian jam mingguan terhadap garis referensi target 10 jam dan diagram donat okupansi fasilitas lab.
