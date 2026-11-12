# Paket 3 — Presensi dan jam riset yang benar: SELESAI

Dikerjakan:
- `src/lib/attendance.ts` (baru): perhitungan jam dari baris nyata `attendance_sessions`. `getWeekRange()` menghasilkan rentang Senin–Minggu zona `Asia/Jakarta`; `minutesWithin()` memotong sesi di batas periode; `hoursForUser()` menjumlahkan per user; `openSessionFor()` mencari sesi tanpa `check_out`.
- `src/contexts/attendance-context.tsx`: `weeklyAccumulatedHours` sekarang `useMemo` dari `attendanceSessions` milik user yang login. Angka fiktif `6.5` dan `resetWeeklyDemo` dihapus. `weeklyTargetHours` dari `kelompok.target_jam_mingguan`. Setelah check-in/check-out, data dimuat ulang dari DB (`refreshData()`), lalu sesi aktif dipulihkan dari baris DB (reload tidak menghilangkan sesi). Ditambah `hasOpenSession`.
- Label hardcode "Target Wajib: 10 Jam / Minggu" → `Target Wajib: {weeklyTargetHours} Jam / Minggu` (`attendance-widget.tsx`); teks "Target 10 jam tercapai!" → "Target {weeklyTargetHours} jam tercapai!".
- `src/app/monitoring/page.tsx`: `MOCK_TEAM_MONITORING` dan okupansi hardcode (45/35/20%) diganti kueri nyata — anggota dari `profiles` (role anggota + kelompok), jam dari agregat `attendance_sessions`, utilisasi ruangan dihitung dari jam booking `room_bookings` pada minggu berjalan (persentase dari 168 jam/minggu). Data kosong → `EmptyState` ("Belum ada data jam riset" / "Belum ada pemesanan ruangan").
- `src/components/widgets/team-overview-widget.tsx`: rewritten memakai data nyata (anggota, jam, status di lab).
- `src/components/layout/sidebar.tsx`: pill "Off" → "Nonaktif"; peringatan amber saat ada sesi terbuka ("lupa check-out").
- Guard role di monitoring dipindah setelah semua hook (aturan react-hooks), tetap sama secara perilaku.

Verifikasi asli (build + browser + DB uji lokal 127.0.0.1:54521):
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → `✖ 26 problems (7 errors, 19 warnings)`. 7 error: 3× `no-empty-object-type` (input.tsx 4:18, 24:18; textarea.tsx 4:18), 4× `set-state-in-effect` (loan-request-sheet.tsx 39:7, home-banner.tsx 19:21 & 62:5, data-context.tsx 301:7). Semua milik Paket 5.
- `NODE_OPTIONS=--max-old-space-size=2048 npx next build` → exit 0.
- Browser, login `dimas.eros@labmanage.test`:
  - Sidebar: `Target Jam Lab Nonaktif 12.5 Jam Target: 10 Jam` (dihitung dari DB).
  - Widget: `Akumulasi Minggu Ini: 12.5 Jam 100% Target 10 jam tercapai!`. Teks "6.5" = false, "Reset Demo" = false.
  - Klik "Check-In Sekarang" → `Sedang di Lab`, `DURASI SESI AKTIF 00:00:02 Live Timer Mulai sejak: 02.43 WIB`, tombol jadi "Check-Out & Simpan".
  - Klik "Check-Out & Simpan" → kembali `Belum Check-In`; setelah reload angkanya tetap `12.5 Jam`.
  - DB (`attendance_sessions` milik Dimas): `{"check_in":"2026-11-12T19:43:04.866+00:00","check_out":"2026-11-12T19:43:15.046+00:00"}` → sesi benar-benar tersimpan.
- Browser, login `admin.lab@labmanage.test`, buka `/monitoring`: `Semua Kelompok (6 Anggota)`, bar chart Dimas/Farhan/Bayu, tabel rekap `Dimas Aditya ... 12.5 Jam Tuntas (125%) 13 Nov, 02.43`, `Farhan Yudha ... 6 Jam Kurang 4.0 Jam`, `Rina Kusuma ... UKM - Bebas Jam (UKM) Belum pernah`; okupansi `Arena Lapangan Kontes 2%` (dihitung dari booking nyata).

Belum beres:
- Baris uji `Uji Anggota (UJI-002)` dari skrip `verify-loan-lifecycle.sql` ikut muncul di monitoring karena memakai `profiles` sungguhan. Bersih saat reset DB uji.
- Koreksi sesi lupa check-out oleh admin **tidak** dikerjakan (sesuai keputusan: itu backlog).
- Perhitungan durasi sesi memakai `Math.round` per menit; durasi < 30 detik tercatat 0 menit (batas akurasi, bukan bug).

Butuh darimu:
1. Konfirmasi aturan hitung: sesi yang belum ditutup dihitung sampai sekarang, dan durasi dipotong di batas minggu. Benar untuk target mingguan?

File: `src/lib/attendance.ts`, `src/contexts/attendance-context.tsx`, `src/app/monitoring/page.tsx`, `src/components/widgets/team-overview-widget.tsx`, `src/components/widgets/attendance-widget.tsx`, `src/components/layout/sidebar.tsx`. Commit: `349e688`.

Skipped: unit test untuk `src/lib/attendance.ts` (butuh runner test — Paket 6). Risiko: agregasi client-side mengunduh semua sesi yang terlihat RLS; untuk skala lab ini cukup, untuk skala besar perlu view/RPC.
