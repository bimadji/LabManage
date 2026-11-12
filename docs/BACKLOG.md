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

1. **CI belum pernah jalan** di GitHub Actions (branch `stabilisasi` belum di-push). Job `db` (Supabase lokal di runner) belum terverifikasi.
2. **Data uji dari skrip tidak dibersihkan** — `scripts/test-inventory-admin.ts` menambah baris inventaris `TEST-ITEM-*` tiap dijalankan.
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
