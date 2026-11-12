# Paket 4 — Booking ruangan yang benar: SELESAI

Dikerjakan:
- `src/lib/rooms.ts` (baru): konstanta tunggal `RUANGAN` (3 ruang: `arena-kontes`, `bengkel-mekanik`, `lab-utama`) berisi `id`, `nama`, `kode`, `kapasitas`, `deskripsi`, dan `slotWaktu`. `toWibIso(tanggal, jam)` mengubah `YYYY-MM-DD` + `HH:MM` (WIB) ke ISO UTC, mengembalikan `null` bila tidak valid. `overlaps()` membandingkan rentang waktu. `todayWib()`/`addDaysWib()` memakai zona `Asia/Jakarta`.
- `src/components/overlays/room-booking-dialog.tsx`: field "Hari / Tanggal" diganti input `type="date"` (min = hari ini), "Sesi Waktu" dari `SLOT_WAKTU`, "Pilih Ruangan" dari `RUANGAN`. Submit mengirim `startTime`/`endTime` nyata. Tidak ada lagi `new Date()` fallback.
- `src/contexts/data-context.tsx`: cek bentrok klien memakai `overlaps()` + perbandingan `roomId` (bukan label string). Pesan: "Ruangan {nama} sudah dipesan pada jam tersebut. Silakan pilih slot lain."
- `friendlyError()` juga menangkap pelanggaran exclusion constraint (23P01 / "exclusion constraint") dan menampilkan pesan Indonesia yang sama.
- `src/app/jadwal/page.tsx`: daftar ruang + filter memakai `RUANGAN` dan mencocokkan `roomId`.

Verifikasi asli (build + browser + DB uji lokal 127.0.0.1:54521):
- `npx tsc --noEmit` → exit 0.
- `NODE_OPTIONS=--max-old-space-size=2048 npx next build` → exit 0.
- Browser, login `dimas.eros@labmanage.test`, Aksi Cepat → "Pesan Ruang / Fasilitas":
  - Dialog menampilkan 3 ruangan dari konstanta: "Arena Uji Coba KRAI / KRI (Kapasitas: 25)", "Ruang Mekanik & Fabrikasi (Kapasitas: 15)", "Ruang Diskusi & Pemrograman (Kapasitas: 20)"; slot "08:00 - 12:00 / 13:30 - 17:30 / 18:30 - 21:30 WIB".
  - Booking tanggal 2026-11-20 slot siang → sukses. DB: `{"ruangan_id":"arena-kontes","nama_ruangan":"Arena Uji Coba KRAI / KRI","waktu_mulai":"2026-11-20T06:30:00+00:00","waktu_selesai":"2026-11-20T10:30:00+00:00","keperluan":"Uji booking paket 4","status":"aktif"}` (06:30 UTC = 13:30 WIB — sesuai slot yang dipilih).
  - Booking ulang tanggal & slot sama → ditolak dengan pesan "Ruangan Arena Uji Coba KRAI / KRI sudah dipesan pada jam tersebut. Silakan pilih slot lain."
- Bug yang ditemukan & diperbaiki saat tes: input tanggal yang tidak valid (hasil ketik otomatis browser) membuat `new Date(...).toISOString()` melempar `RangeError: Invalid time value` dan crash halaman. Sekarang `toWibIso()` mengembalikan `null` dan form menampilkan "Tanggal atau jam sesi tidak valid. Silakan pilih ulang."

Belum beres:
- Skema DB belum punya tabel `ruangan`; `room_bookings.ruangan_id` tetap `TEXT` dan identitas ruangan dijaga oleh konstanta aplikasi. Tidak diubah (butir 3 hanya minta konstanta bersama; tabel baru = perubahan skema besar).
- Booking yang sudah ada di DB memakai `nama_ruangan` berbeda ("Arena Lapangan Kontes" dari seed lama). Tampil di jadwal apa adanya; tidak dinormalkan.
- Tidak ada tombol batal/ubah booking (di luar scope).

Butuh darimu:
1. Konfirmasi nama ruangan kanonik yang dipakai di seed (`scripts/seed-dummy.ts` masih menulis "Arena Lapangan Kontes"). Kalau mau diseragamkan ke `RUANGAN[].nama`, perlu suntik seed (perubahan data uji saja).

File: `src/lib/rooms.ts`, `src/components/overlays/room-booking-dialog.tsx`, `src/contexts/data-context.tsx`, `src/app/jadwal/page.tsx`. Commit: `117939d`.

Skipped: pengujian otomatis untuk `overlaps()`/`toWibIso()` (runner test belum ada — Paket 6). Risiko: constraint GiST DB tetap penjaga terakhir, tetapi hanya aktif bila `waktu_mulai`/`waktu_selesai` terisi — kini selalu terisi dari form.
