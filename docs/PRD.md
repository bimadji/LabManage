# PRD LabManage

## 1. Ringkasan

LabManage adalah sistem untuk mengatur fasilitas, penjadwalan, dan pemantauan lab Tim Robotik PENS/UKM. Sistem ini mencatat reservasi ruang dan alat, mencatat kehadiran anggota saat berada di lab, menampilkan inventaris dan ketersediaannya, serta menerima laporan kondisi fasilitas dari anggota. Admin UKM mengelola jadwal dan status perbaikan. Advisor dapat memantau kehadiran secara real-time. Produk berbentuk web responsif yang dibuka dari ponsel maupun komputer.

## 2. Latar belakang masalah

Anggota Tim Robotik bekerja di lab sampai larut malam, sering tanpa jadwal yang jelas. Hasil survei internal menunjukkan 4 dari 5 anggota (80%) merasa kelelahan dan kesulitan mengatur waktu. Sebanyak 2 dari 5 anggota (40%) melaporkan bahwa lingkungan lab tidak mendukung kerja mereka. Reservasi ruang dan alat masih dilakukan lewat pesan grup, sehingga jadwal sering bentrok. Laporan lampu mati, ventilasi bermasalah, atau alat rusak tersebar di berbagai kanal dan jarang ditindaklanjuti dengan cepat.

## 3. Tujuan

1. Menyediakan satu sumber jadwal untuk ruang dan alat lab.
2. Mencatat kehadiran anggota secara akurat sebagai dasar pemantauan jam kerja.
3. Membantu anggota menjaga jam kerja yang sehat, dengan jam operasional lab dan peringatan saat sesi masih terbuka pada malam hari.
4. Menyediakan kanal laporan fasilitas yang terpusat dengan alur status yang jelas.

## 4. Success metrics

| No | Metrik | Target |
| --- | --- | --- |
| M1 | Pengurangan lembur malam tidak terstruktur | minimal 35% dalam semester pertama |
| M2 | Pengurangan konflik reservasi ruang dan alat | hingga 90% |
| M3 | Visibilitas durasi kehadiran anggota | advisor dan admin dapat melihat durasi kehadiran secara real-time |
| M4 | Kecepatan respons perbaikan fasilitas | respons perbaikan menjadi lebih cepat lewat kanal laporan terpusat |

## 5. Non-goals

- Tidak ada aplikasi native untuk Android atau iOS. Produk hanya berupa web responsif.
- Tidak ada integrasi dengan sistem akademik kampus.
- Tidak ada fitur pembayaran.

## 6. Persona dan user stories

### 6.1 Persona

| Persona | Peran di sistem | Tanggung jawab | Kebutuhan utama |
| --- | --- | --- | --- |
| Anggota Tim Robotik | `anggota` | Memesan ruang dan alat untuk kegiatan tim, check-in dan check-out saat berada di lab, melapor kerusakan fasilitas | Melihat slot kosong dari ponsel, memesan tanpa bentrok, tahu kapan sudah terlalu lama di lab |
| Admin UKM | `admin` | Mengelola katalog alat, membatalkan reservasi yang bermasalah, mengubah status laporan fasilitas | Daftar reservasi dan pinjaman yang akurat, alur status laporan yang jelas |
| Advisor (dosen pembimbing) | `advisor` | Memantau kehadiran dan durasi kerja anggota | Melihat siapa yang sedang di lab dan sudah berapa lama, tanpa perlu mengubah data |

### 6.2 User stories

Modul A: reservasi ruang dan alat

- US-A1. Sebagai anggota, saya ingin melihat jadwal reservasi per hari, agar saya tahu slot yang kosong sebelum mengajukan reservasi.
  - AC-A1: daftar reservasi per hari menampilkan ruang, tim, waktu mulai, dan waktu selesai.
  - AC-A2: filter ruang hanya menampilkan reservasi untuk ruang yang dipilih.
- US-A2. Sebagai anggota, saya ingin mengajukan reservasi ruang atau alat, agar tim dapat memakai fasilitas tanpa bentrok.
  - AC-A3: pengajuan yang bertabrakan dengan reservasi aktif di ruang yang sama ditolak dengan pesan konflik.
  - AC-A4: pengajuan di luar jam operasional lab ditolak dengan pesan jam operasional.
  - AC-A5: reservasi yang berhasil disimpan tercatat atas nama pengaju.
- US-A3. Sebagai anggota, saya ingin membatalkan reservasi milik saya, agar slot tersebut kembali tersedia untuk tim lain.
  - AC-A6: pembatalan oleh pemilik mengubah status reservasi menjadi dibatalkan, dan slotnya kembali kosong.
  - AC-A7: anggota tidak dapat membatalkan reservasi milik anggota lain.
- US-A4. Sebagai admin, saya ingin membatalkan reservasi siapa pun, agar jadwal yang bermasalah dapat diperbaiki.
  - AC-A8: admin dapat membatalkan reservasi anggota mana pun, dan tindakan itu tercatat pada reservasi.

Modul B: kehadiran dan durasi

- US-B1. Sebagai anggota, saya ingin melakukan check-in saat tiba di lab, agar kehadiran saya tercatat.
  - AC-B1: check-in membuka sesi dengan waktu mulai saat tombol ditekan.
  - AC-B2: check-in saat masih ada sesi terbuka ditolak dengan pesan yang jelas.
- US-B2. Sebagai anggota, saya ingin melakukan check-out saat meninggalkan lab, agar durasi kerja saya tercatat dengan akurat.
  - AC-B3: check-out menutup sesi terbuka dan menyimpan durasi kerja.
  - AC-B4: check-out tanpa sesi terbuka ditolak dengan pesan yang jelas.
- US-B3. Sebagai advisor, saya ingin melihat anggota yang sedang berada di lab beserta durasinya secara real-time, agar saya dapat memantau jam kerja mereka.
  - AC-B5: daftar anggota aktif diperbarui tanpa perlu memuat ulang halaman.
  - AC-B6: sesi yang masih terbuka setelah 21:00 WIB ditandai.
- US-B4. Sebagai anggota, saya ingin mendapat peringatan saat sesi saya masih terbuka setelah 21:00 WIB, agar saya ingat untuk pulang.
  - AC-B7: peringatan muncul di daftar notifikasi untuk setiap sesi terbuka yang melewati 21:00 WIB, tanpa duplikat pada hari yang sama.

Modul C: inventaris dan laporan fasilitas

- US-C1. Sebagai anggota, saya ingin melihat katalog alat beserta jumlah yang tersedia, agar saya tahu alat mana yang bisa dipinjam.
  - AC-C1: setiap alat menampilkan total jumlah dan jumlah yang tersedia.
  - AC-C2: jumlah tersedia sama dengan total dikurangi pinjaman yang belum dikembalikan.
- US-C2. Sebagai anggota, saya ingin meminjam alat dan menandai pengembaliannya, agar stok selalu akurat.
  - AC-C3: pinjaman yang melebihi stok tersedia ditolak.
  - AC-C4: anggota hanya dapat menandai pengembalian untuk pinjaman miliknya.
- US-C3. Sebagai admin, saya ingin mengelola katalog alat, agar data inventaris sesuai kondisi lab.
  - AC-C5: hanya admin yang dapat menambah atau mengubah data alat.
- US-C4. Sebagai anggota, saya ingin melaporkan lampu mati, ventilasi bermasalah, atau kerusakan, agar pengurus segera menindaklanjuti.
  - AC-C6: laporan wajib memuat kategori, lokasi, dan deskripsi minimal 5 karakter.
  - AC-C7: anggota dapat melihat status semua laporan yang ia buat.
- US-C5. Sebagai admin, saya ingin mengubah status laporan fasilitas, agar pelapor tahu perkembangannya.
  - AC-C8: status hanya dapat berpindah berurutan: baru, ditindaklanjuti, selesai.
  - AC-C9: setiap perubahan status membuat satu notifikasi untuk pelapor.
- US-C6. Sebagai advisor, saya ingin melihat seluruh laporan fasilitas, agar saya dapat memantau respons pengurus.
  - AC-C10: advisor dapat melihat semua laporan beserta statusnya, tanpa dapat mengubahnya.
