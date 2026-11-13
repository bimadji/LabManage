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

## Keputusan hak akses yang sudah dikunci (Paket 2b & 2c)

Tiga aturan ini **sengaja** ditutup di DB (policy RLS) + UI. Bukan bug, bukan feature — hasil baca PRD §3 dan matriks role. Kalau nanti aturan berubah, ubah policy-nya (migrasi baru), bukan longgarkan test.

| Aturan | Kenapa | Di mana ditegakkan |
|---|---|---|
| **Anggota tidak boleh mengubah status laporannya sendiri** — hanya Admin yang boleh (termasuk anggota yang membuat laporan itu) | PRD §3: verifikasi laporan = Admin. Sebelumnya anggota bisa menutup laporannya sendiri | `reports_update_policy` (fase 5) — `current_role() = 'admin'` |
| **Advisor boleh mengajukan pinjam, tapi tidak boleh memverifikasi/menolak/selesaikan** | PRD §3 "Pinjam Alat Lab & Barang Terbuka" = Ya; verifikasi = Admin | `loan_insert_policy` (boleh) vs `loan_update_admin` + RPC `verifikasi_pinjam`/`selesaikan_pinjam` (hanya Admin) |
| **Admin & Advisor tidak bisa mencatat presensi (check-in/out)** — hanya anggota tim riset | Absensi adalah catatan anggota; widget UI juga hanya untuk anggota | `attendance_insert_tim_riset` / `attendance_update_tim_riset` (fase 5) — `role = 'anggota'` + kelompok `tim_riset` |

**Kalau nanti admin perlu mencatat kehadiran** (mis. mencatat sesi untuk anggota yang lupa check-out), itu butuh **RPC terpisah** yang memeriksa admin — bukan melonggarkan policy `attendance_sessions` (kalau dilonggarkan, admin/advisor bisa mengisi sesi untuk kelompok mana pun). Yang tidak masuk backlog sebagai "belum dikerjakan" karena memang fitur baru, belum diminta.

## Nanti — temuan audit yang tidak memblokir tes nyata

1. **CI belum pernah jalan** di GitHub Actions (branch `stabilisasi` belum di-push). Job `db` (Supabase lokal di runner) belum terverifikasi.
2. **Data uji dari `scripts/test-inventory-admin.ts` dan `scripts/test-role-matrix.ts`** — matriks role sudah dibersihkan otomatis; skrip inventaris masih menambah baris `TEST-ITEM-*` tiap dijalankan.
3. **Tidak ada tabel `ruangan`** — `room_bookings.ruangan_id` berupa `TEXT`; identitas ruangan dijaga konstanta `src/lib/rooms.ts`.
4. **Nama ruangan seed lama tidak kanonik** — `scripts/seed-dummy.ts` masih menulis "Arena Lapangan Kontes", sedangkan konstanta memakai "Arena Uji Coba KRAI / KRI".
5. **Agregasi absensi di sisi klien** — seluruh sesi yang terlihat RLS diunduh ke browser; perlu view/RPC untuk skala besar.
6. **Tabel `reports` belum punya halaman rekap khusus** — laporan masuk via dialog dan tampil di Kotak Masuk.
7. **`profiles_select_policy` mengizinkan anggota satu kelompok melihat profil teman sekelompok** (termasuk email). Perlu keputusan apakah itu diinginkan.
8. **16 warning lint tersisa** — import tak terpakai, `window.location.href` (2 lokasi), `exhaustive-deps`. Bukan error.
9. **Kontrol sekunder masih < 44 px** (badge, avatar, beberapa select). Target sentuh 44 px dijamin untuk tombol & link utama.
10. **Tidak ada tombol batal/ubah booking.** Tidak diminta.
11. **Durasi sesi dibulatkan ke menit** — sesi < 30 detik tercatat 0 menit.
12. **Tidak ada monitoring uptime** aplikasi di produksi.
13. **Tidak ada reset kata sandi / "ingat saya"** di halaman login.
14. **`user_id` yang ditulis masih ambil dari `profiles.id`** (yang nilainya = `auth.uid()`), bukan memanggil `auth.uid()` langsung. Setara secara RLS, tapi lebih tegas bila ditulis eksplisit.
