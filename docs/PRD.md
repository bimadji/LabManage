# PRD — LabManage: Sistem Manajemen Laboratorium Robotika PENS

## 1. Ringkasan Eksekutif

Laboratorium Robotika Politeknik Elektronika Negeri Surabaya (PENS) menaungi dua kategori kelompok kegiatan mahasiswa dengan tata kelola dan mandat yang berbeda:

1. **Tim Riset Robotika Nasional**: Memiliki target jam riset wajib mingguan (10 jam/minggu) untuk persiapan kompetisi robotika nasional (KRI/KRAI/KRSRI/KRSBI).
2. **Unit Kegiatan Mahasiswa (UKM) Robotika**: Wadah eksplorasi minat bakat mahasiswa robotika umum, seperti **Roboholic**, yang tidak dibebani target jam riset mingguan namun membutuhkan akses inventaris dan pemakaian fasilitas perakitan lab secara teratur.

Penggunaan bersama ruangan fisik, instrumen uji, dan komponen riset tanpa sistem kendali digital memicu bentrok jadwal lapangan, hilangnya riwayat peminjaman modul berharga, serta tidak terukurnya pemenuhan jam riset mahasiswa. **LabManage** hadir sebagai platform terintegrasi berbasis Web untuk menyelesaikan permasalahan koordinasi tersebut dengan pengamanan hak akses data berbasis peran dan kelompok.

---

## 2. Sasaran Produk (Goals & Non-Goals)

### Sasaran Utama (Goals)

- **Kendali Kepemilikan & Visibilitas Inventaris**: Membedakan kepemilikan aset lab (milik bersama laboratorium vs milik eksklusif tim riset vs milik UKM) dengan penegakan izin baca-tulis menggunakan PostgreSQL Row Level Security (RLS).
- **Pencegahan Bentrok Fasilitas (Anti-Collision)**: Mengeliminasi tabrakan jadwal pemakaian arena uji coba lapangan kontes dan bengkel mekanik menggunakan constraint waktu GiST pada basis data.
- **Diferensiasi Presensi Berbasis Kelompok**: Menyediakan pencatatan waktu presensi live-timer bagi anggota tim riset dan menonaktifkan fitur target jam secara otomatis untuk anggota UKM.
- **Akuntabilitas & Manajemen Stok**: Memastikan penambahan stok unit barang hanya dapat dilakukan oleh Kepala Lab (Admin) melalui operasi atomik database (`SELECT ... FOR UPDATE`) untuk mencegah kondisi balapan (*race condition*).

### Bukan Sasaran Produk (Non-Goals)

- LabManage tidak menggantikan sistem akademik kampus (SIAKAD PENS) atau absensi perkuliahan resmi.
- LabManage bukan sistem pengadaan atau transaksi keuangan jual-beli alat.

---

## 3. Matriks Peran Pengguna (Role Matrix)

| Kemampuan Sistem | Admin Lab (Kepala Lab) | Anggota Tim Riset | Anggota UKM (Roboholic) | Advisor (Dosen Pembina) |
|---|:---:|:---:|:---:|:---:|
| **Tambah Barang Baru** | Ya | Tidak (RLS Blocked) | Tidak (RLS Blocked) | Tidak (RLS Blocked) |
| **Tambah Stok Unit Barang** | Ya (RPC Atomik) | Tidak | Tidak | Tidak |
| **Pinjam Alat Lab & Barang Terbuka** | Tidak (Ditolak Aturan) | Ya | Ya | Ya |
| **Presensi Sesi Jam Lab** | Tidak Wajib | Ya (Target 10 Jam) | Tidak (Bebas Jam) | Tidak Wajib |
| **Pemesanan Ruangan / Arena** | Ya | Ya | Ya | Ya |
| **Akses Halaman Monitoring Tim** | Ya | Tidak (Dialihkan / Blokir) | Tidak (Dialihkan / Blokir) | Ya |
| **Verifikasi Permintaan & Laporan** | Ya | Tidak | Tidak | Memantau Saja |

---

## 4. Persyaratan Fungsional Inti

### 4.1 Modul Inventaris Terpadu

- Setiap item inventaris memiliki atribut: `nama`, `kode` (unik), `kategori`, `lokasi`, `stok_total`, `stok_tersedia`, `status` (`tersedia`, `dipinjam`, `rusak`, `habis`), `pemilik_kelompok_id`, dan `dapat_dipinjam_kelompok_lain`.
- Filter katalog di antarmuka memisahkan: *Semua Aset*, *Milik Bersama Lab*, *Milik Kelompok Saya*, dan *Bisa Dipinjam Lintas Kelompok*.
- Tombol penambahan barang dan penambahan stok hanya dirender pada sesi pengguna dengan peran Admin.

### 4.2 Modul Peminjaman Komponen

- Permohonan pinjam mencatat peminjam, kelompok asal, item, jumlah unit, keperluan proyek, dan rencana tanggal pengembalian.
- Peran Admin tidak diizinkan membuat permohonan pinjam untuk mencegah konflik kepentingan verifikasi.
- Pengembalian dan penolakan pinjaman secara otomatis memulihkan jumlah `stok_tersedia`.

### 4.3 Modul Presensi & Pelacak Jam Riset

- Anggota tim riset mencatat waktu masuk melalui tombol *Check-In* yang mengaktifkan penghitung durasi sesi aktif (*live timer*).
- Tombol *Check-Out* mengakumulasi jam ke progres mingguan terhadap target wajib 10 jam.
- Bagi anggota UKM Roboholic, antarmuka menyembunyikan timer dan menampilkan kartu status kelompok bebas jam riset.

### 4.4 Modul Pemesanan Ruangan

- Memfasilitasi reservasi Arena Lapangan Kontes, Ruang Mekanik & Fabrikasi, serta Ruang Diskusi Software.
- Validasi anti-bentrok diterapkan di sisi klien sebelum kirim dan divalidasi mutlak di database via PostgreSQL Exclusion Constraint GiST (`ruangan_id WITH =`, `tstzrange(waktu_mulai, waktu_selesai) WITH &&`).

### 4.5 Modul Monitoring & Evaluasi

- Khusus diakses oleh Admin Lab dan Advisor.
- Menampilkan grafik distribusi jam riset anggota tim terhadap target 10 jam mingguan, persentase utilisasi ruangan, dan tabel rekapitulasi status kehadiran mahasiswa.
