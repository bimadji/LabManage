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
