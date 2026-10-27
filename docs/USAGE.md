# Panduan Penggunaan — LabManage

Dokumen ini memandu pengoperasian dan navigasi fitur **LabManage** bagi seluruh peran pengguna laboratorium.

---

## 1. Navigasi Cepat Antar-Peran (Role Switcher)

Untuk keperluan pengujian antarmuka dan evaluasi sistem, tombol profil di pojok kanan atas bilah navigasi (*Header*) dilengkapi menu *Ganti Akun & Simulasi Peran*:

- **Ahmad Zaki Fauzan**: Peran **Admin** (Kepala Lab Robotika PENS).
- **Dimas Aditya**: Peran **Anggota** dari kelompok **Tim Riset EROS** (target 10 jam/minggu, presensi aktif).
- **Rina Kusuma**: Peran **Anggota** dari kelompok **UKM Roboholic** (status kelompok bebas target jam riset).
- **Dr. Ir. Budi Santoso, M.T.**: Peran **Advisor** (Dosen Pembina Tim Robotika).

Memilih salah satu akun akan secara otomatis menyesuaikan konteks izin, tampilan dashboard, dan ketersediaan tombol aksi di seluruh halaman.

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
   - Masukkan jumlah unit yang dipinjam.
   - Jelaskan keperluan riset atau proyek robotika Anda.
   - Tentukan tanggal perkiraan pengembalian alat.
4. Klik **Kirim Permohonan**.
5. Status permohonan dapat dipantau pada kartu *Pinjaman Alat Saya* di Beranda Utama.

---

## 4. Presensi Kehadiran Lab (Khusus Anggota Tim Riset)

1. Masuk sebagai anggota tim riset (misal: Dimas dari EROS).
2. Di Beranda Utama, lihat kartu **Absensi Kehadiran Lab**.
3. Klik tombol hijau **Check-In Sekarang** saat Anda tiba di lab dan memulai aktivitas mekatronika.
4. Timer durasi sesi aktif akan berjalan secara langsung (*live-timer*).
5. Klik tombol merah **Check-Out & Simpan** saat selesai berkegiatan. Durasi waktu sesi akan diakumulasikan ke pencapaian target mingguan (10 jam).

> **Catatan UKM**: Bagi anggota UKM Roboholic, kartu presensi digantikan dengan kotak informasi *UKM Roboholic: Bebas Target Jam Lab Mingguan*.

---

## 5. Pemesanan Ruangan & Arena Uji Coba

1. Buka menu **Jadwal Ruangan** atau klik tombol **Aksi Cepat $\rightarrow$ Pesan Ruangan** di bilah navigasi.
2. Pilih fasilitas yang diperlukan: *Arena Lapangan Kontes Robot*, *Ruang Mekanik & Fabrikasi*, atau *Ruang Diskusi & Software*.
3. Tentukan tanggal dan slot sesi waktu pemakaian.
4. Tuliskan deskripsi keperluan pengujian robotika dan jumlah peserta tim.
5. Klik **Konfirmasi Booking**.
6. Sistem akan otomatis memvalidasi ketersediaan waktu untuk memastikan tidak ada jadwal bentrok dengan tim lain.

---

## 6. Monitoring & Evaluasi Tim (Admin & Advisor)

1. Masuk sebagai Admin atau Advisor.
2. Buka menu **Monitoring Tim & UKM** di panel navigasi.
3. Gunakan filter tab di bagian atas:
   - **Semua Kelompok**: Tinjauan rekapitulasi seluruh mahasiswa lab.
   - **Tim Riset**: Fokus grafik pemenuhan target wajib 10 jam/minggu.
   - **UKM Roboholic**: Tinjauan anggota UKM robotika umum.
4. Amati grafik batang capaian jam mingguan terhadap garis referensi target 10 jam dan diagram donat okupansi fasilitas lab.
