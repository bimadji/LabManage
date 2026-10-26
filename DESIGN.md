# DESIGN LabManage

Status: dunia visual **Agenda regu yang terukur**, dipilih pengguna untuk overhaul Fase 1. Berlaku pada shell dan permukaan operasional web. Audit dan keputusan arah: `docs/ui-review/AUDIT-2026-10.md` serta `.impeccable/decision-direction.json`.

## Tesis

Satu agenda kerja menghubungkan waktu, entitas, dan status. Antarmuka mengutamakan pekerjaan yang dapat dipindai dan tindakan yang sah, bukan kartu dashboard dekoratif, gambar hero, atau navigasi yang memenuhi viewport pertama.

- **Agenda, bukan poster.** Tanggal, jam, nama entitas, dan status membentuk ritme baca yang konsisten.
- **Konteks sebelum aksi.** Identitas akun, tujuan aktif, metadata, dan konsekuensi status tersedia sebelum pengguna mengirim perubahan.
- **Satu dunia, tugas berbeda.** Jadwal, inventaris, kehadiran, monitoring, laporan, dan notifikasi memakai token serta aturan interaksi yang sama tanpa menyamakan proses bisnisnya.
- **Pulih dengan konteks.** Error menjelaskan kegagalan dan menyediakan retry pada resource yang sama. Filter dan input tidak dibuang oleh tampilan.

## Bahasa visual

| Token                                 | Nilai     | Fungsi                                              |
| ------------------------------------- | --------- | --------------------------------------------------- |
| `--color-background`                  | `#f4f6f3` | Kertas sejuk di belakang area kerja                 |
| `--color-foreground`                  | `#172d35` | Tinta untuk judul dan isi                           |
| `--color-primary`, `--color-rail`     | `#164e5a` | Rail biru-petro dan aksi utama                      |
| `--color-secondary`, `--color-accent` | `#b94d25` | Aksi kerja dan fokus yang menonjol, digunakan hemat |
| `--color-card`                        | `#ffffff` | Panel form, ledger, dan isi berulang                |
| `--color-link`                        | `#0f4552` | Tautan konten pada latar terang                     |
| `--color-link-hover`                  | `#0a323b` | Tautan konten saat hover                            |
| `--color-muted`                       | `#e7ede8` | Bidang pembeda sekunder                             |
| `--color-surface-summary`             | `#f1f5f2` | Kartu ringkasan dan notifikasi belum dibaca         |
| `--color-surface-alert`               | `#fdf3f2` | Kartu kegagalan dan konteks yang perlu dipulihkan   |
| `--color-muted-foreground`            | `#475569` | Metadata pada latar terang                          |
| `--color-border`                      | `#c5cfca` | Garis aturan dan batas kontrol                      |
| `--color-destructive`                 | `#b91c1c` | Error dan tindakan destruktif                       |
| `--color-success`                     | `#25634b` | Status positif, selalu disertai teks                |
| `--color-rail-ink`                    | `#f8faf7` | Teks terang pada rail                               |

Radius kontrol 6 px; kartu memakai `--radius-card` 10 px dan `--shadow-card` yang tipis untuk memisahkan isi berulang dari kertas halaman. Tidak ada gradien, ilustrasi, atau ikon sebagai pengganti label. Garis 1 px dan ruang kosong tetap menjadi pembeda utama kelompok. Skala spasi 4/8/12/16/24/32 px memakai `--space-1` sampai `--space-6`.

Tipografi memakai system sans (`system-ui`, Segoe UI, Roboto), dasar 16 px, line-height 1,5. Judul halaman responsif 26–32 px; judul bagian 18 px. Jam, durasi, jumlah, dan metrik memakai angka tabular agar kolom mudah dibandingkan. Keterangan tetap berupa teks, bukan warna atau bentuk saja.

## Struktur aplikasi

### Mobile, di bawah 768 px

Header rail ringkas memuat identitas LabManage, tombol **Menu**, dan **Keluar**. Navigasi tertutup tidak dirender dalam layout maupun urutan fokus. Tombol mengumumkan **Buka navigasi**/**Tutup navigasi**, `aria-expanded`, dan `aria-controls`. Perpindahan route menutup menu. Konten tugas muncul langsung setelah header.

### Tablet dan desktop, mulai 768 px

Rail sticky selebar 220 px memuat tujuh tujuan utama, subtautan role yang sah, dan identitas akun. Area kerja mengambil sisa lebar dengan `minmax(0, 1fr)`. Padding area kerja bertambah pada 1280 px; tidak ada sidebar kedua atau dashboard sambutan.

Skip link **Lewati ke konten utama** menjadi target Tab pertama, menuju satu `<main id="main-content">`. Tujuan utama memakai `aria-current="page"`; subtautan aktif memakai `aria-current="location"`. Kotak masuk membawa badge jumlah pending untuk admin tanpa mengubah nama tujuan.

## Signature move: ledger kerja

Jadwal mengelompokkan reservasi per hari. Pada desktop, tanggal menjadi rail 144 px di kiri dan daftar waktu–ruang/tim–status berada di kanan. Pada mobile, tanggal berada di atas entri. Formatter WIB, rentang 14 hari, filter, dan status bisnis tetap menjadi sumber kebenaran.

Pola yang sama diterapkan sesuai tugas:

- **Inventaris:** nama item adalah fokus; jenis, kategori, lokasi, stok, peminjam, dan status membentuk metadata stabil. Form ambil/pinjam dibuka melalui disclosure berlabel, bukan modal atau perpindahan fokus otomatis.
- **Kehadiran dan monitoring:** waktu, durasi, target, dan peringatan menjadi data utama. Aksi refresh/check-in/check-out berada dekat konteksnya.
- **Rekap dan admin:** filter periode berada dalam panel; metrik dan rincian harian mengikuti, tanpa mengganti tabel/daftar bermakna menjadi kartu kosmetik.
- **Permintaan dan notifikasi:** entitas, pemohon, status, waktu, catatan, dan aksi mempunyai urutan stabil. Status selalu tertulis.
- **Form:** label terlihat, bantuan dekat dengan kontrol, validasi native dan pesan server dipertahankan, serta aksi submit tidak bergeser ke pola baru.

## Kartu dan tautan

Semua panel memakai `.card` dengan batas 1 px, radius 10 px, dan bayangan tipis yang sama. Varian memiliki fungsi, bukan dekorasi acak: `.card-summary` untuk ringkasan, `.card-alert` untuk error yang dapat dipulihkan, `.card-empty` dengan batas putus-putus untuk keadaan kosong, dan `.card-interactive` untuk kartu inventaris. Kartu interaktif terangkat 2 px saat hover; transisinya hanya memakai `transform` dan otomatis hilang pada reduced motion. Notifikasi belum dibaca memakai surface ringkasan serta badge teks, bukan warna saja.

Tautan konten memakai warna tema dan garis bawah melalui aturan global `a` serta kelas `.link`; tidak ada biru/ungu bawaan browser. `.link-back` khusus navigasi kembali memakai ghost button dan chevron CSS. `.btn-ghost` untuk aksi sekunder dan `.btn-ghost-danger` untuk aksi destruktif sekunder. Aksi utama tetap `.button`. Rail, merek, skip link, dan tombol mempertahankan gaya komponennya sendiri.

## Interaksi dan aksesibilitas

- Target kontrol minimum **44 × 44 px**, termasuk tombol keputusan yang sempit.
- Teks normal minimal **4,5:1**; teks besar mengikuti ambang WCAG yang sesuai.
- Fokus keyboard terlihat pada tautan, tombol, field, disclosure, dan skip link. Urutan fokus mengikuti urutan DOM; navigasi tertutup tidak ikut menerima fokus.
- Disclosure memakai tombol dengan `aria-expanded`, `aria-controls`, dan region `aria-labelledby`. Region inventaris tetap mounted dengan `hidden` agar input tidak hilang saat ditutup.
- Loading memakai `role="status"`; kegagalan memakai `role="alert"`. Status bisnis tidak dibedakan hanya melalui warna.
- `prefers-reduced-motion: reduce` menghilangkan animasi/transisi. Tidak ada autoplay atau gerakan dekoratif.
- `document.documentElement.scrollWidth <= window.innerWidth` wajib pada 375, 768, dan 1280 px. Grid dan anak fleksibel menggunakan `min-width: 0`; teks panjang dibungkus tanpa memotong isi bermakna.

## Subnavigasi inventaris

Halaman inventaris memakai segmented control datar di bawah judul: satu baris `Link` berikon SVG internal, bukan tab ber-JavaScript. Tautan aktif ditandai `aria-current="page"` dan `box-shadow`, jadi status tidak bergantung pada warna saja. Susunan mengikuti hak akses yang sudah ada: admin melihat Katalog, Kotak masuk, dan Riwayat permintaan; advisor melihat Katalog, Permintaan saya, dan Kotak masuk baca-saja; anggota melihat Katalog dan Permintaan saya. Detail item dan `/inventaris/baru` tetap menandai Katalog aktif karena keduanya bercabang dari katalog.

Badge permintaan pending dibaca dari satu provider bersama (`PendingRequestsProvider`) dan dipakai rail serta subnav. Provider hanya memanggil `/inventory/pending-count` untuk admin dan hanya saat pathname berubah, sehingga sidebar dan subnav pada halaman yang sama tidak menggandakan request. Di ponsel setiap tautan setinggi 44 px dalam satu kolom; mulai 640 px menjadi 46 px dan mengalir satu baris.

## Grafik attendance

Grafik Monitoring memakai SVG dan CSS internal; tidak ada Recharts, visx, motion library, ikon eksternal, Tailwind, atau shadcn. Alasannya: kebutuhan hanya tiga bentuk tetap (batang harian, garis tren mingguan, progress target), sedangkan library grafik akan menambah dependency runtime dan lapisan aksesibilitas yang tetap harus ditulis ulang.

- **Aktivitas harian** (advisor dan admin): batang durasi per hari pada periode terpilih, dengan label nilai di atas batang dan tanggal di sumbu bawah. Hari tanpa aktivitas tetap muncul agar periode terbaca utuh.
- **Tren mingguan** (admin saja): garis total jam per minggu dengan titik berlabel nilai. Sesi yang melewati 21:00 WIB dilaporkan sebagai kolom tersendiri di tabel, bukan sebagai warna berbeda pada garis. Tidak ada tooltip hover; nilai selalu terbaca dari label SVG dan tabel.
- **Progress target** (advisor dan admin): badge status dari server (`KURANG`/`TERCAPAI`), persen, sisa menit, dan `role="progressbar"` dengan `aria-valuenow`, `aria-valuemax`, serta `aria-valuetext`. Nama anggota tidak diulang di dalam komponen karena heading kartu sudah menyebutnya.

Setiap grafik memenuhi pola gambar kompleks W3C: judul terlihat, ringkasan `role="img"` ber-`aria-label` (periode, total, jumlah sesi), dan tabel alternatif di dalam `<details><summary>` yang dapat dibuka dengan keyboard. Grafik statis tidak memasang handler keyboard kustom; `summary` native sudah fokusabel dan 44 px.

Data selalu datang dari halaman; komponen grafik tidak memanggil API dan tidak mengubah peran. Halaman tetap memakai tiga endpoint Monitoring yang sudah ada (`/attendance/present`, `/attendance/summary`, `/attendance/statistics`), tanpa request `summary` berulang dan tanpa `/attendance/statistics` untuk advisor.

Durasi live dihitung dari `checkedInAt` terhadap waktu sekarang dengan interval 60 detik, bukan dari `durationMinutes` yang hanya snapshot historis. KPI historis mengikuti periode terpilih dan tetap terpisah dari KPI live.

Motion memakai satu entrance per halaman (`page-enter`, 180 ms) pada `.workspace main`, transisi hover 150–180 ms, dan press `translateY(1px)`. Skeleton hanya muncul saat resource benar-benar dimuat (live, rekap advisor, statistik admin) dan tetap membawa `role="status"`, `aria-busy`, serta teks status untuk pembaca layar. `prefers-reduced-motion: reduce` mematikan animasi, transisi, dan smooth scroll.

### Referensi dan lisensi

Diperiksa 2026-10-26:

- Efferd Dashboard 2, `https://21st.dev/@efferd/templates/dashboard-2` dan `https://efferd.com/view/dashboard-2` — MIT untuk komponen dengan pembuat/slug sama. Dipakai sebagai referensi proporsi kartu dan kepadatan grafik, bukan kode yang disalin.
- Duralux, `https://21st.dev/@themeocean/templates/duralux-admin-dashboard-react-js-template` dan `https://duralux-react-dashboard.vercel.app/` — berbayar/All Rights Reserved; hanya inspirasi visual, tidak ada aset atau kode yang dipakai.
- Pulse AI, `https://21st.dev/@emmanuelajako406/templates/pulse-ai` dan `https://pulse-ai-one-ashy.vercel.app/` — lisensi tidak ditemukan; tidak ada aset atau kode yang dipakai.
- W3C WAI, `https://www.w3.org/WAI/tutorials/images/complex/` — pola gambar kompleks dengan tabel alternatif yang diadopsi untuk ketiga grafik.
- Recharts dan visx dipertimbangkan lalu ditolak karena alasan dependency dan aksesibilitas di atas.

### Dampak bundle

Baseline sebelum fase ini: JS 563,95 kB (gzip 156,41 kB), CSS 26,61 kB (gzip 5,12 kB). Setelah subnav, timer live, grafik, dan skeleton: JS 575,10 kB (gzip 159,37 kB), CSS 30,20 kB (gzip 5,83 kB). Selisih +11,15 kB JS (+2,96 kB gzip) dan +3,59 kB CSS (+0,71 kB gzip), seluruhnya kode aplikasi tanpa dependency baru. Warning Vite di atas 500 kB sudah ada sejak baseline dan tidak berubah sifatnya.

## Kontrak yang tidak berubah pada Fase 1

Perubahan dunia visual tidak mengubah endpoint, payload, validasi, kalkulasi, React Query/fetch/state, kondisi guard, RLS, atau izin. Monitoring anggota, cakupan Permintaan saya, serta hak inventaris admin/advisor tetap sesuai build awal dan ditangani terpisah pada Fase 2. Discoverability Kotak masuk advisor diperbaiki karena akses bacanya sudah sah.

Tidak ada dependency UI, pembatalan baru, filter bisnis baru, bulk action, pagination, atau penghapusan route dalam overhaul ini.

## Bukti dan batas metode

Audit awal beserta 90 capture baseline tersimpan di `docs/ui-review/ui-overhaul-2026-10/before/`. Capture after memakai akun demo, route, seed, dan lebar CSS 375/768/1280 yang sama di `docs/ui-review/ui-overhaul-2026-10/after/`. Pengukuran DOM melengkapi capture untuk overflow, target, label, keyboard, reduced motion, serta role; capture bukan bukti API atau izin.

Model pada sesi implementasi tidak menerima input gambar. Karena itu dokumen ini tidak mengklaim inspeksi piksel atau perbandingan visual subjektif dari PNG. Kontras diperiksa melalui computed CSS dan pasangan warna; gradien/gambar tidak dipakai dalam dunia final.
