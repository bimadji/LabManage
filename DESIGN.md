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
