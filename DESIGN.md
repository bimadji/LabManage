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
