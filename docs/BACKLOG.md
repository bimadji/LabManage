# BACKLOG — LabManage (di luar fase stabilisasi)

Daftar hal yang **sengaja tidak dikerjakan** pada fase stabilisasi. Bukan janji jadwal; urutan kasar dari yang paling berdampak.

## Nanti — fitur dari rencana lama (dihapus dari repo, jangan dikerjakan di stabilisasi)

| Item | Alasan ditunda |
|---|---|
| Rekap absensi mingguan/bulanan per anggota | Fitur baru, bukan perbaikan |
| Peringatan advisor untuk anggota KURANG + log notifikasi | Fitur baru |
| Notifikasi anggota (daftar + tandai dibaca) | Butuh tabel & halaman baru |
| Koreksi sesi lupa check-out oleh admin (dengan audit) | Fitur baru |
| Target jam riset dinamis (admin mengatur, bukan `kelompok.target_jam_mingguan`) | Butuh tabel pengaturan |
| Statistik admin (tren mingguan, rasio sesi malam) | Fitur baru |

## Nanti — temuan audit yang tidak memblokir tes nyata

1. **`.env.example` tidak ikut ter-commit.** `.gitignore` memakai `.env*` sehingga contoh env tidak pernah masuk repo. Perlu `!.env.example` di `.gitignore` (paket 7).
2. **Identitas & role masih dari mock/localStorage.** `role-context.tsx` memakai `MOCK_USERS_LIST` sebagai state awal dan menyimpan pilihan di `localStorage`. Belum ada login Supabase Auth (paket 2).
3. **Tidak ada guard server.** `/monitoring` hanya memblokir di sisi klien; belum ada middleware/pengecekan server component (paket 2).
4. **Advisor masih bisa menekan tombol verifikasi di UI.** RLS menolak tulisan, tetapi tombol tetap tampil (paket 2).
5. **Tombol "Ajukan Pinjam Barang" tampil untuk admin.** Baru ditolak saat submit (paket 2).
6. **Jam akumulasi mingguan masih `6.5` + tombol "Reset Demo".** Belum dihitung dari `attendance_sessions` (paket 3).
7. **Halaman Monitoring belum memakai data nyata.** Saat ini hanya menampilkan empty state (paket 3).
8. **Form booking belum mengirim tanggal/jam sebenarnya.** `startTime`/`endTime` belum diisi dari pilihan UI; validasi bentrok masih membandingkan label string (paket 4).
9. **`room_bookings.ruangan_id` berupa TEXT tanpa tabel ruangan.** Identitas ruangan hanya konstanta UI (paket 4, minimal konstanta bersama).
10. **`status-badge.tsx` punya blok `return` tak terjangkau** sehingga `dipinjam`/`ditangani`/`aktif` jatuh ke warna slate (paket 5).
11. **Enum DB `inventory_status` tidak punya `dipinjam`** padahal tipe TS memakainya (paket 5; perlu keputusan skema).
12. **7 error ESLint tersisa** (`no-empty-object-type` di input/textarea, `no-explicit-any` dan `set-state-in-effect` di role-context, `set-state-in-effect` di loan-request-sheet) — paket 5.
13. **Teks Inggris di UI:** `aria-label="Toggle menu"`, label `Off` di sidebar (paket 5).
14. **Duplikasi komponen Textarea** di `ui/input.tsx` dan `ui/textarea.tsx` (paket 5).
15. **Aksesibilitas:** belum ada skip link, `aria-expanded` pada toggle, `prefers-reduced-motion`, target sentuh 44px (paket 5).
16. **Tidak ada test otomatis** dan dua skrip verifikasi selalu exit 0 (paket 6).
17. **README salah:** Emerald `#047857` (kode `#22c55e`) dan "14 Kebijakan RLS" (aktual 23 `CREATE POLICY`) (paket 7).
18. **Build OOM di mesin RAM kecil.** Butuh `NODE_OPTIONS=--max-old-space-size=2048`; CI harus menyetel itu (paket 6).
19. **`profiles_select_policy` mengizinkan semua anggota satu kelompok melihat profil teman sekelompok** (termasuk email). Perlu keputusan apakah itu diinginkan.
20. **Tidak ada pembatalan booking / reservasi berulang.** Bukan kebutuhan tes nyata saat ini.
21. **`scripts/seed-dummy.ts` memakai `password123`** untuk 7 akun demo; hanya boleh untuk DB uji (paket 7).
