# Rencana implementasi rekap advisor (Tugas 2C)

> **For agentic workers:** Use superpowers:executing-plans untuk implementasi dan superpowers:requesting-code-review untuk review akhir.

**Goal:** Advisor melihat rekap semua anggota dan mengirim peringatan untuk anggota KURANG.

**Architecture:** Halaman `/monitor/rekap` memakai API absensi yang sudah tersedia, ditautkan dari Monitoring. Panel periode dan identitas sesi di-remount agar respons lama tidak menimpa data baru. Peringatan tetap memakai kebijakan server untuk minggu berjalan.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library; tanpa dependensi baru.

**Spec:** `docs/HANDOVER.md`, bagian D/E dan G Tugas 2C; `DESIGN.md`; kontrak di `api/src/attendance/research.ts`.

## Batasan

- Branch `helper-6-rekap-advisor-web` dari main setelah PR #32 merged; satu PR untuk 2C.
- Bahasa Indonesia, tanggal WIB, 375/768/1280px tanpa overflow; target sentuh utama minimal 44px.
- Tidak mengubah API, migrasi, logika bisnis, atau data pengguna; tidak reset database.
- UI hanya advisor; API/RLS tetap menjadi penegak hak akses.
- Merge PR 2C menunggu persetujuan tersendiri.

## Fokus review

- Periode historis/bulanan tidak boleh menyebabkan pengiriman peringatan minggu berjalan tanpa konteks yang jelas.
- Respons terlambat dari filter/akun lama tidak muncul pada tampilan baru.
- Klik ganda tidak mengirim dua permintaan; konflik deduplikasi dan target tercapai ditampilkan jujur.
- Status target memakai nilai server, termasuk tepat batas; angka tampilan tidak menentukan kelayakan.
- Pergantian sesi advisor ke anggota menghapus data advisor dan tombol aksi.

## Tahap tunggal: halaman advisor, test, dan dokumentasi

**Berkas:** buat `web/src/pages/AdvisorAttendancePage.tsx` dan test tetangganya; ubah `web/src/App.tsx`, `web/src/pages/MonitorPage.tsx`, `web/src/index.css`, `docs/USAGE.md`, dan test pergantian sesi bila diperlukan.

**Kontrak:** GET `/attendance/summary?period=week|month&date=YYYY-MM-DD` tanpa userId mengembalikan `period`, `targetMinutes`, `weeklyTargetMinutes`, `members` berisi identitas, durasi, sesi, status, dan rincian harian. POST `/attendance/warnings` menerima `{ userId, note }` dengan catatan maksimum 1000 karakter; tampilkan pesan kesalahan server termasuk `WARNING_ALREADY_SENT` dan `TARGET_MET`.

- [x] Tulis test melalui App: daftar semua anggota, tanggal WIB, filter periode, loading/error/retry/kosong, guard peran/profil, serta respons usang.
- [x] Tulis test pengiriman: catatan opsional/trim, satu POST saat klik ganda, sukses, gagal/retry, konflik deduplikasi/target, dan tanpa pengiriman pada bulan/minggu historis.
- [x] Jalankan `npm test --prefix web -- src/pages/AdvisorAttendancePage.test.tsx`; amati kegagalan karena halaman belum ada.
- [x] Implementasikan halaman mengikuti pola halaman rekap pribadi dan API yang ada; hubungkan route yang keyed oleh session.user.id dan tautan Monitoring untuk advisor.
- [x] Buktikan pergantian sesi dengan hook autentikasi/profil asli, lalu jalankan seluruh test web.
- [x] Dokumentasikan alur advisor serta batas peringatan di USAGE; periksa browser 375/768/1280, termasuk loading/kosong/error, guard, dan alur peringatan API lokal dengan fixture terpisah.
- [x] Minta review independen; tangani temuan penting dengan test regresi.
- [x] Fetch dan merge origin/main sesuai E; jalankan lint/test/build API dan web, lint Markdown/tautan/Mermaid, serta diff check. Catat hasil sebenarnya.
- [ ] Commit Conventional Commit, push branch helper, buat PR ke main dan periksa CI. Perbarui checkpoint; jangan merge PR baru tanpa izin.
