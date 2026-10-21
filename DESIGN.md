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
