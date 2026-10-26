# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tim Robotik dengan tiga peran terautentikasi: anggota, admin, dan advisor. Anggota mengelola kegiatan pribadi; admin mengelola operasional dan persetujuan; advisor memantau kegiatan riset. Fase ini harus membuat orientasi pengguna baru jelas sekaligus menjaga efisiensi pemindaian tugas berulang untuk admin dan advisor.

## Product Purpose

LabManage membantu Tim Robotik menjalankan operasional laboratorium terpadu. Reservasi ruang, inventaris, kehadiran riset, laporan fasilitas, dan notifikasi berada dalam satu alur kerja berbasis peran. Pengguna harus dapat menemukan tugas yang relevan, memahami keadaan data, dan menyelesaikan aksi yang memang diizinkan tanpa menebak struktur aplikasi.

## Positioning

Satu sistem untuk menghubungkan penggunaan ruang, pencatatan kehadiran, pengambilan komponen, peminjaman barang, pelaporan fasilitas, dan tindak lanjut notifikasi dengan hak yang berbeda untuk setiap peran; bukan katalog inventaris atau absensi yang berdiri sendiri.

## Operating Context

Aplikasi web internal digunakan pada ponsel, tablet, dan desktop. Reservasi mengikuti jadwal dan zona waktu WIB. Inventaris membedakan komponen habis pakai dan barang yang dapat dipinjam. Kehadiran mencakup check-in/check-out, target riset, rekap, peringatan advisor, serta koreksi admin. Data demo lokal berasal dari seed Supabase; data tersebut bukan klaim penggunaan produksi.

## Capabilities and Constraints

- Stack yang sudah ada: React, React Router, Supabase Auth/Postgres, serta API internal. Fase 1 tidak mengubah endpoint, logika bisnis, RLS, atau hak akses.
- Pengguna masuk dengan email dan kata sandi. Semua alur yang sudah ada, state loading/error/empty, serta kontrak API harus tetap bekerja.
- Fase 2 nanti mengubah hak inventaris admin/advisor, akses Monitoring anggota, dan cakupan riwayat permintaan. Temuan tersebut tidak boleh diselesaikan diam-diam dalam Fase 1.
- Bahasa antarmuka adalah Bahasa Indonesia; identifier kode tetap Bahasa Inggris.
- Tidak ada kebutuhan yang dikonfirmasi untuk dependensi UI baru, platform native, atau sistem akun baru.

## Brand Commitments

Pertahankan nama LabManage, konten faktual, dan aset yang sudah ada. Pengguna mengonfirmasi tidak ada logo, warna institusi, atau identitas visual lain yang wajib dipertahankan. Arah visual lama bukan batas untuk overhaul yang disetujui.

## Evidence on Hand

Dokumen produk dan alur berada di `docs/PRD.md` dan `docs/USAGE.md`. Aplikasi dapat dijalankan dengan seed lokal untuk tiga akun demo. Bukti audit Fase 1 berada di `docs/ui-review/AUDIT-2026-10.md` dan `docs/ui-review/ui-overhaul-2026-10/`; keterbatasan bukti dicatat dalam audit. Tidak ada testimoni, metrik produksi, atau aset merek tambahan yang boleh direkayasa.

## Product Principles

- Tampilkan tugas dan informasi sesuai pekerjaan serta peran, tanpa menjadikan perbedaan izin sebagai sumber kebingungan.
- Utamakan status nyata dan tindakan yang dapat diselesaikan, bukan dekorasi atau klaim.
- Seimbangkan orientasi pengguna baru dengan kepadatan yang efisien untuk pekerjaan berulang.
- Pertahankan satu pola interaksi untuk tugas yang sama di semua halaman dan ukuran layar.

## Accessibility & Inclusion

Target Fase 1: kontras teks normal minimal 4.5:1, target sentuh minimal 44 × 44 CSS px, fokus keyboard terlihat, tidak ada overflow horizontal pada lebar 375/768/1280 CSS px, dukungan `prefers-reduced-motion`, dan status dibedakan melalui teks selain warna. Bukti pengukuran harus menyebut batas pengujian perangkat dan pembaca layar.
