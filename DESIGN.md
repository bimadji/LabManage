# DESIGN LabManage

Status: draft, belum disetujui. Arah ini adalah fallback dari panduan UX umum, karena query `ui-ux-pro-max` tidak menghasilkan pola yang cocok untuk aplikasi booking lab.

## Prinsip

- Fungsi dulu: jadwal, reservasi, dan stok harus bisa dibaca dan dipakai dalam tiga ketukan.
- Konsisten dengan tampilan yang sudah ada. Perubahan bertahap, bukan redesign.

## Palet

Ikuti variabel CSS yang sudah ada di `web/src/index.css`. Tidak ada warna baru tanpa alasan kontras.

- Teks utama: kontras minimal 4.5:1 terhadap latar.
- Status: AMAN, MENIPIS, HABIS, TERSEDIA, DIPINJAM dibedakan dengan label teks, bukan warna saja.

## Tipografi

- Font sistem yang sudah dipakai. Ukuran dasar 16px.
- Judul halaman 1.5rem (mobile), 1.75rem (≥768px).

## Komponen

- Tombol dan tautan interaktif: tinggi minimum 44px, jarak antar target minimal 8px.
- Error: `role="alert"` di atas aksi.
- Kondisi kosong: jelaskan dan beri satu aksi berikutnya.

## Spasi dan layout

- Skala spasi dari variabel `--space-*`.
- Tanpa scroll horizontal pada 375, 768, dan 1280 px.
- Navigasi mobile: grid 2x2 (sudah ada, `@media (max-width: 767px)`).

## Aksesibilitas

- Fokus keyboard terlihat.
- Animasi dinonaktifkan untuk `prefers-reduced-motion` (sudah ada).

## Tugas 3A — Jadwal

- Halaman `/jadwal` memakai daftar per tanggal: tanggal sebagai penanda, jam dan ruang sebagai informasi utama, tim sebagai teks pendukung, status aktif/dibatalkan dengan label teks. Di desktop tanggal berada di kolom kiri; di ponsel di atas daftar. Palet, font sistem, radius, dan skala spasi tetap mengikuti variabel yang ada.
- Referensi yang ditinjau pada 22 Oktober 2026: [Modern Timeline oleh Caio Bonato di 21st.dev](https://21st.dev/@chowlol202/components/modern-timeline). Pola pengelompokan tanggal dan kartu dipilih karena cocok untuk membaca urutan reservasi. Animasi, gambar, progress, serta layout horizontal dari referensi tidak diperlukan untuk jadwal ini.
- Pemeriksaan sumber: metadata `license` kosong dan `license_url` tidak tersedia pada halaman tersebut, sehingga kode/aset komponen tidak diambil. Referensi hanya inspirasi susunan informasi; JSX/CSS ditulis sendiri dengan React + Vite yang sudah ada. Dependensi sumber yang tercantum adalah `lucide-react` dan `framer-motion`, dengan ShadCN UI/Tailwind pada deskripsinya; tidak ada yang ditambahkan ke proyek.
- Audit awal direkonstruksi karena file lokal `UI-REVIEW.md` lama tidak tersedia: nama ruang/tim panjang menyebabkan overflow; zona WIB dan status aktif belum eksplisit; kondisi kosong belum punya aksi. Perbaikan dibatasi ke Jadwal, tanpa mengubah API, rentang dua minggu, filter, atau aturan reservasi.
- Bukti sebelum/sesudah pada 375 dan 1280px disimpan di `docs/ui-review/helper-8/` dan disertakan dalam PR. Pengujian juga mencakup 768px, teks panjang, fokus keyboard, kontras teks/badge, loading, kosong, error, serta filter ruang. Semua data pada screenshot adalah data simulasi.

## Tugas 3B — Reservasi baru

- Halaman `/reservasi/baru` mengelompokkan isian menjadi Ruang dan tim serta Waktu penggunaan memakai `fieldset`/`legend`. Satu kolom pada ponsel, dua kolom mulai 768px; tombol simpan terpisah dengan garis pembatas. Palet, font, radius, spasi, dan kontrol native tetap mengikuti proyek.
- Referensi yang diperiksa 22 Oktober 2026: [Form](https://21st.dev/@shadcn/components/form) dan [Input](https://21st.dev/@shadcn/components/input) dari shadcn/ui di 21st.dev. Pola label, bantuan isian, dan pesan error cocok untuk form reservasi singkat. Keduanya mencantumkan lisensi MIT. Form mencantumkan dependensi `react-hook-form`, Radix Slot/Label, dan `sonner`; contoh kalender juga memakai Zod/resolver, `date-fns`, serta `lucide-react`. Tidak ada dependensi/kode/aset sumber yang diambil; pola diadaptasi dengan JSX, elemen HTML native, dan CSS proyek.
- Audit awal menunjukkan nama ruang panjang membuat form melebar (scrollWidth 1226/1242/1370 pada 375/768/1280). Lebar minimum grid, fieldset, dan input dibatasi agar form tetap berada di layar. Kondisi memuat/kosong/gagal daftar ruang diberi pesan; form belum dapat dikirim sampai tersedia pilihan dan isian dikunci selama penyimpanan. Error API mempertahankan isian agar dapat dicoba kembali.
- Jam operasional tetap 07:00–21:00 WIB. Bantuan isian menjelaskan perilaku yang sudah ada: `datetime-local` mengikuti zona waktu perangkat. Validasi rentang, konversi waktu, payload API, aturan konflik, dan navigasi setelah simpan tidak diubah.
- Screenshot sebelum/sesudah 375/1280 ada di `docs/ui-review/helper-9/`, dengan data simulasi. Verifikasi mencakup 768px, teks panjang, fokus keyboard, kontras, state form, penyimpanan nyata menggunakan fixture lokal, konflik, dan percobaan ulang.

## Tugas 3C — Katalog Inventaris

- Halaman `/inventaris` memisahkan filter dalam panel, menampilkan jumlah hasil, serta menyediakan tombol Hapus filter ketika pencarian/filter aktif. Katalog kosong dibedakan dari hasil pencarian kosong. Kartu menempatkan jenis dan badge status di atas nama item, kategori/lokasi diberi label, dan tombol permintaan dipisahkan dari informasi stok. Satu kolom pada ponsel dan dua kolom mulai 768px memberi ruang bagi form permintaan. Palet, font, radius, dan spasi tetap mengikuti proyek.
- Referensi yang diperiksa 22 Oktober 2026: [Card oleh shadcn/ui di 21st.dev](https://21st.dev/@shadcn/components/card). Pemisahan kepala, isi, dan aksi kartu cocok untuk membaca ketersediaan item sebelum mengajukan permintaan. Halaman mencantumkan lisensi MIT dan dependensi contoh `lucide-react`; contoh juga menggunakan komponen shadcn dan kelas Tailwind. Pola diadaptasi dengan JSX/CSS sendiri, tanpa mengambil kode/aset atau menambah dependensi.
- Audit awal: nama item, kategori, lokasi, dan peminjam yang panjang membuat scrollWidth 1258/1615/2033 pada viewport 375/768/1280; badge menempel pada aksi; pencarian kosong belum memiliki cara cepat menghapus filter. Lebar minimum kartu/form/kontrol dibatasi dan teks dibungkus. Status memuat, jumlah hasil, serta keberhasilan permintaan diumumkan melalui `role="status"`; error tetap memakai `role="alert"`.
- Filter lokal, perhitungan badge, akses anggota/admin/advisor, payload ambil/pinjam, dan aturan stok/persetujuan tetap. Screenshot sebelum/sesudah 375/1280 di `docs/ui-review/helper-10/` memakai data simulasi. Verifikasi browser mencakup 768px, teks panjang, fokus keyboard, kontras, loading/kosong/error, reset filter, form ambil/pinjam, pending, sukses, percobaan ulang, serta tampilan admin/advisor. API inventaris dalam pemeriksaan browser disimulasikan; autentikasi memakai akun uji lokal yang dibersihkan setelah selesai.

## Tugas 3D — Detail item Inventaris

- Halaman `/inventaris/:id` memisahkan informasi item, kontrol pengelolaan admin, dan riwayat. Informasi dan kontrol berada dalam dua kolom mulai 768px, bertumpuk pada ponsel; anggota/advisor hanya melihat informasi dan riwayat. Palet, font, radius, dan spasi mengikuti proyek. Riwayat memakai daftar bernama dan waktu semantik.
- Referensi yang diperiksa 22 Oktober 2026: [Card](https://21st.dev/@shadcn/components/card) dan [Form](https://21st.dev/@shadcn/components/form) dari shadcn/ui di 21st.dev. Pemisahan informasi dan aksi kartu serta pengelompokan label/isian cocok untuk halaman detail. Keduanya mencantumkan lisensi MIT. Contoh Card memakai `lucide-react`; Form mencantumkan `react-hook-form`, Radix Slot/Label, dan `sonner`, dengan Zod/resolver, `date-fns`, dan `lucide-react` pada contoh. Tidak ada kode/aset sumber atau dependensi baru yang diambil; pola diadaptasi dengan JSX, elemen HTML native, dan CSS proyek.
- Audit awal: teks panjang membuat scrollWidth 2257/2474/2602 pada viewport 375/768/1280. Lebar minimum kartu/form/kontrol dibatasi dan teks dibungkus. Kontrol dikunci selama penyimpanan untuk mencegah pengiriman ganda, keberhasilan diumumkan melalui `role="status"`, dan error mempertahankan isian untuk percobaan ulang. Gagal memuat memiliki tombol Coba lagi; menutup form edit mengembalikan fokus ke Ubah item.
- Endpoint, payload, validasi stok, perhitungan badge, konfirmasi hapus, serta aturan akses tetap. Bukti sebelum/sesudah 375/1280 disimpan di `docs/ui-review/helper-11/`. Pemeriksaan juga mencakup 768px, teks panjang, fokus/hover, kontras, loading/error/item hilang, riwayat kosong, pending/sukses/error aksi, percobaan ulang, pengembalian barang, dan tampilan anggota/advisor. Data inventaris dan respons API pada browser disimulasikan; akun autentikasi uji Supabase lokal dibersihkan setelah pengujian.

## Tugas 3E — Item inventaris baru

- Halaman `/inventaris/baru` mengelompokkan isian menjadi Informasi item serta Jenis dan stok menggunakan `fieldset`/`legend`. Satu kolom pada ponsel dan dua kolom mulai 768px mengikuti pola form Reservasi. Bantuan yang terhubung lewat `aria-describedby` menjelaskan lokasi opsional serta perbedaan komponen habis pakai dan barang satuan. Palet, font, radius, dan spasi tetap mengikuti proyek.
- Referensi yang diperiksa 23 Oktober 2026: [Form](https://21st.dev/@shadcn/components/form) dan [Input](https://21st.dev/@shadcn/components/input) dari shadcn/ui di 21st.dev, untuk pengelompokan label, bantuan, dan pesan error. Keduanya mencantumkan lisensi MIT. Form mencantumkan `react-hook-form`, Radix Slot/Label, dan `sonner`; contohnya juga memakai Zod/resolver, `date-fns`, dan `lucide-react`. Contoh Input menggunakan komponen Input/Label/Button shadcn. Tidak ada kode/aset sumber atau dependensi baru yang diambil; adaptasi memakai HTML native, JSX, dan CSS proyek.
- Audit awal: pesan error tanpa spasi membuat scrollWidth 3419/3435/3563 pada viewport 375/768/1280. Grid, fieldset, dan isian dibatasi lebarnya, pesan dibungkus. Pemuatan profil dan penyimpanan diumumkan melalui `role="status"`; seluruh isian dikunci selama simpan. Error memakai `role="alert"` dan mempertahankan isian untuk percobaan ulang. Tampilan non-admin menyediakan tautan kembali ke inventaris.
- Payload komponen/barang, trim nama/kategori/lokasi, lokasi kosong yang tidak dikirim, validasi API, akses admin, dan navigasi ke katalog setelah sukses tetap. Screenshot sebelum/sesudah 375/1280 berada di `docs/ui-review/helper-12/`; pengujian juga mencakup 768px, bantuan jenis, pending, error/retry, sukses/navigasi, teks panjang, fokus/hover, kontras, serta akses anggota/advisor. Data dan API inventaris browser disimulasikan; akun autentikasi uji lokal dibersihkan setelah selesai.

## Tugas 3F — Permintaan saya dan Kotak masuk inventaris

- Kedua halaman memakai kartu dengan informasi permintaan, badge status berteks, dan aksi yang dipisahkan garis pembatas. Daftar bernama dibagi menjadi Laporan ambil dan Permintaan pinjam; satu kolom pada ponsel dan dua kolom mulai 768px. Filter Kotak masuk berada dalam panel. Palet, font, radius, dan spasi mengikuti proyek.
- Referensi yang diperiksa 23 Oktober 2026: [Card oleh shadcn/ui di 21st.dev](https://21st.dev/@shadcn/components/card), untuk pemisahan kepala/isi/aksi kartu dan form di dalam kartu. Lisensi MIT dan dependensi contoh `lucide-react` diperiksa; contoh juga menggunakan komponen shadcn dan kelas Tailwind. Tidak mengambil kode/aset atau menambah dependensi; adaptasi memakai JSX, HTML native, dan CSS proyek.
- Audit awal: teks panjang membuat scrollWidth Permintaan saya 2590/2589/2717 dan Kotak masuk 2520/2519/2647 pada viewport 375/768/1280. Teks dibungkus dan lebar minimum kartu/form/kontrol dibatasi. Loading dan hasil aksi diumumkan melalui `role="status"`; error memakai `role="alert"` dan gagal memuat menyediakan Coba lagi. Tombol dikunci selama aksi/refetch, serta filter Kotak masuk dikunci saat pengiriman keputusan.
- Test mereproduksi pengiriman ganda pada pembatalan/keputusan dan ID alasan penolakan yang sama antar kartu. Ref sinkron mencegah pengiriman ganda; `useId` menghubungkan tiap label dengan inputnya sendiri. Form penolakan baru ditutup setelah sukses agar error mempertahankan catatan untuk percobaan ulang. Endpoint, payload, status/filter, syarat tombol berdasarkan peran/status, dan penandaan dibaca tetap.
- Delapan screenshot sebelum/sesudah kedua halaman pada 375/1280 tersedia di `docs/ui-review/helper-13/`. Verifikasi juga mencakup 768px, teks panjang, fokus/hover, kontras, loading/kosong/error baca dan retry, pending/error/sukses pembatalan, konfirmasi/persetujuan/penolakan, retry catatan, filter kosong, serta advisor tanpa aksi keputusan. API permintaan browser disimulasikan dan payload diperiksa; autentikasi memakai akun uji lokal yang dibersihkan setelah selesai.

## Tugas 3G â€” Kehadiran dan rekap anggota

- Halaman `/kehadiran` menyusun judul sesi dan status dalam satu kepala yang dapat membungkus pada layar sempit. Waktu check-in, check-out, dan durasi dikelompokkan sebagai daftar definisi; tombol aksi dipisahkan garis pembatas dan tetap memiliki target minimum 44px. Halaman `/kehadiran/rekap` menempatkan status target berdampingan dengan badge berlabel, memberi jarak antara filter, rekap, dan peringatan, serta menampilkan hari dalam dua kolom mulai 768px. Warna, font, radius, dan spasi memakai token yang sudah ada.
- Referensi yang diperiksa 25 Oktober 2026: [Card](https://21st.dev/@shadcn/components/card) dan [Form](https://21st.dev/@shadcn/components/form) dari shadcn/ui di 21st.dev. Susunan kepala/isi/aksi pada Card sesuai untuk sesi dan status target; pola label dan kontrol pada Form sesuai untuk filter periode. Keduanya mencantumkan lisensi MIT. Card mencantumkan `lucide-react`; Form mencantumkan `react-hook-form`, Radix Slot/Label, dan `sonner`. Tidak ada kode/aset sumber atau dependensi baru yang diambil; adaptasi memakai JSX, HTML semantik, dan CSS proyek.
- Aturan check-in/out, durasi, pemuatan ulang, periode, ringkasan, dan peringatan tidak diubah. Screenshot sebelum/sesudah 375/1280 disimpan di `docs/ui-review/helper-14/`; verifikasi mencakup 768px, state dan teks panjang, fokus keyboard, kontras, target sentuh, serta overflow.

## Tugas 3H - Monitoring, rekap advisor, statistik admin

- Monitoring mengelompokkan nama anggota, status sesi, waktu mulai, dan durasi dalam kartu yang dapat membungkus pada layar sempit. Tautan berdasarkan peran berada pada baris yang dapat membungkus. Rekap advisor dan statistik admin memakai panel terpisah untuk filter, ringkasan, sesi terbuka, koreksi, dan tren; grid bertambah dari satu kolom pada ponsel menjadi dua mulai 768px dan tiga mulai 1280px.
- Referensi yang diperiksa 25 Oktober 2026: [Card](https://21st.dev/@shadcn/components/card) dan [Form](https://21st.dev/@shadcn/components/form) dari shadcn/ui di 21st.dev. Struktur kepala/isi kartu cocok untuk sesi monitoring dan anggota, sementara pola label dan kontrol cocok untuk filter. Keduanya mencantumkan lisensi MIT; contoh Card menggunakan `lucide-react`, sedangkan Form mencantumkan `react-hook-form`, Radix Slot/Label, dan `sonner`. Tidak mengambil kode/aset dan tidak menambah dependensi; pola disusun ulang memakai JSX semantik dan CSS proyek.
- Perubahan hanya pada hierarki informasi, pembungkusan teks, panel, dan grid. Aturan absensi, target, koreksi, akses, dan permintaan API tetap.
