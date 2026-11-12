# QA Checklist — Uji Manual LabManage

Dipakai staf laboratorium & anggota tim riset saat uji nyata.
Setiap skenario: tandai **Lolos** / **Gagal** (tulis detail singkat). Laporkan bug ke maintainer.

## Persiapan

- [ ] Masuk ke aplikasi (alamat produksi / lokal) dan halaman login tampil dalam Bahasa Indonesia.
- [ ] Login dengan akun uji. Akun uji dibuat lewat Supabase (`auth.users`) + baris `profiles` (lihat `docs/SETUP-TES.md`).
- [ ] Tiap akun punya `profiles.role` dan `profiles.kelompok_id` yang benar. Role terbaca di pojok kanan atas.
- [ ] Buka DevTools → Network: tidak ada error 4xx/5xx saat memuat Beranda.

---

## A. Admin Lab (Kepala Laboratorium)

| # | Skenario | Expected | Hasil |
|---|---|---|---|
| A1 | Login sebagai admin | Beranda menampilkan sapaan "Pak {nama}" dan menu Kotak Masuk | |
| A2 | Inventaris → "Tambah Barang Baru" | Form muncul; nama, kode, kategori, lokasi, jumlah, kepemilikan wajib | |
| A3 | Simpan barang tanpa kode | Error jelas, barang TIDAK tersimpan | |
| A4 | Simpan barang valid | Barang muncul di katalog **setelah refresh halaman** | |
| A5 | Klik "+ Stok" pada barang | Stok bertambah; kartu item di DB bertambah | |
| A6 | Tambah stok dengan jumlah 0 atau negatif | Ditolak, pesan error | |
| A7 | Inventaris | TIDAK ada tombol "Ajukan Pinjam Barang" | |
| A8 | Kotak Masuk → "Tinjau Permohonan" → Setujui | Status jadi "Disetujui", stok berkurang, tetap setelah refresh | |
| A9 | Setujui dengan stok kurang | Ditolak: "Stok tersedia tidak mencukupi" | |
| A10 | Tolak dengan alasan | Status "Ditolak", alasan tersimpan, stok TIDAK berubah | |
| A11 | Borrow berstatus "Disetujui" → "Tandai Dikembalikan" | Status "Selesai", stok pulih | |
| A12 | Klik "Tandai Dikembalikan" dua kali | Ditolak, stok TIDAK pulih dua kali | |
| A13 | Laporan lab → "Tandai Ditangani" | Status laporan berubah, tetap setelah refresh | |
| A14 | Monitoring | Grafik jam riset + okupansi ruangan + tabel rekap terisi dari data | |
| A15 | Rebooking ruang di jam yang sudah dipakai | Ditolak: "Ruangan sudah dipesan pada jam tersebut" | |

## B. Anggota Tim Riset

| # | Skenario | Expected | Hasil |
|---|---|---|---|
| B1 | Login sebagai anggota tim riset | Kartu absensi tampil dengan target jam dari kelompok | |
| B2 | Check-In | Timer berjalan; jam menit brutal tampil | |
| B3 | Refresh halaman saat sesi aktif | Sesi tetap aktif (tidak hilang) | |
| B4 | Check-Out | Timer berhenti; akumulasi minggu bertambah | |
| B5 | Tutup browser tanpa check-out, lalu login lagi | Peringatan "lupa check-out" tampil | |
| B6 | Inventaris → "Ajukan Pinjam Barang" | Form memuat identitas pemohon otomatis | |
| B7 | Ajukan pinjam melebihi stok | Ditolak di form dengan sisa stok | |
| B8 | Ajukan pinjam valid | Status "Menunggu" di Permintaan Saya, tetap setelah refresh | |
| B9 | Buka `/monitoring` langsung | Dialihkan ke Beranda | |
| B10 | Booking ruang dengan tanggal + slot jam | Booking tersimpan dengan tanggal & jam yang dipilih | |
| B11 | Booking ruang yang sama di slot sama | Ditolak | |

## C. Anggota UKM (Roboholic)

| # | Skenario | Expected | Hasil |
|---|---|---|---|
| C1 | Login sebagai anggota UKM | Kartu "Status Kelompok: UKM Roboholic / Bebas Target Jam Lab Mingguan" | |
| C2 | Tidak ada tombol Check-In di Beranda | Tidak ada tombol check-in | |
| C3 | Coba pinjam barang milik lab | Boleh (dapat dipinjam lintas kelompok) | |
| C4 | Coba pinjam barang milik kelompok lain | Ditolak / tidak terlihat | |

## D. Advisor (Dosen Pembina)

| # | Skenario | Expected | Hasil |
|---|---|---|---|
| D1 | Login sebagai advisor | Menu Monitoring tampil | |
| D2 | Buka `/monitoring` | Bisa melihat (hanya memantau) | |
| D3 | Kotak Masuk | Melihat semua permohonan, TIDAK ada tombol "Tinjau Permohonan" | |
| D4 | Halaman detail laporan | Hanya tombol "Detail Laporan", tanpa aksi tulis | |
| D5 | Coba akses `/monitoring` sebagai anggota | Dialihkan ke Beranda | |

## E. Cross-role & Keamanan

| # | Skenario | Expected | Hasil |
|---|---|---|---|
| E1 | Buka aplikasi tanpa login | Dialihkan ke halaman login | |
| E2 | Klik "Keluar dari akun" | Kembali ke halaman login, data tidak tampil | |
| E3 | Ganti kata sandi akun uji | Login lama gagal, login baru berhasil | |

> Catatan: seluruh penolakan hak akses ditegakkan di server (proxy) dan PostgreSQL RLS. Memalsukan role di browser tidak memberi akses.

## F. Laporan bug

Sertakan: peran & akun, langkah (1..n), hasil yang diharapkan, hasil sebenarnya, pesan error (kutipan utuh), screenshot, waktu kejadian (WIB).
