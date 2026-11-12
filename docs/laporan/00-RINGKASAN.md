# Ringkasan Stabilisasi — LabManage

Tanggal: 2026-11-12. Branch: `stabilisasi` (belum di-push, belum di-deploy).

## Status per paket

| Paket | Status | Catatan satu baris |
|---|---|---|
| 1 — Data nyata & tersimpan | SELESAI | Semua aksi tulis ke DB; stok atomik via RPC; fallback palsu dihapus; MOCK_* hanya mode demo. |
| 1b — Verifikasi database | SELESAI | 3 migrasi ter-apply di DB uji; 10 skenario SQL + 9 skenario API + 7 skenario RLS lulus. |
| 2 — Autentikasi & hak akses | SEBAGIAN | Supabase Auth + guard server + role dari `profiles` jalan; test otomatis per role belum ada. |
| 3 — Presensi & jam riset | SELESAI | Jam dari `attendance_sessions`, 11 unit test, monitoring data nyata, empty state jelas. |
| 4 — Booking ruangan | SELESAI | Tanggal+jam nyata, bentrok berbasis rentang, GiST sebagai penjaga terakhir. |
| 5 — Bug kecil terlihat user | SELESAI | Badge sesuai DESIGN.md, lint 0 error, teks Indonesia, skip link/aria/reduced-motion/44px. |
| 6 — Test & pengaman | SEBAGIAN | 32 unit test + CI + QA checklist; CI belum pernah jalan. |
| 7 — Kesiapan tes nyata | SEBAGIAN | Env, SETUP-TES, README, STATUS siap; belum ada akun produksi. |

## Yang paling mendesak butuh keputusan/akses darimu

1. **Akun produksi belum ada.** Hanya akun seed `password123` untuk DB uji. Perlu keputusan siapa yang membuat & membagikan kredensial ke staf/anggota. → `docs/SETUP-TES.md` §3.
2. **Migrasi produksi belum pernah ter-apply.** Dua migrasi lama berubah nama (versi `20261027` → `20261027000100`/`20261027000200`) karena bentrok versi di `schema_migrations`. Kalau DB produksi sudah punya versi `20261027`, versi barunya akan ter-apply ulang (idempoten, tapi perlu penyesuaian manual). Perlu keputusan kapan & oleh siapa.
3. **Deploy produksi masih versi lama** (tanpa login, masih role switcher). Perlu push branch + CI hijau dulu, lalu deploy.
4. **CI belum pernah jalan** di GitHub Actions — job `db` (Supabase lokal di runner) belum terverifikasi di runner sungguhan.
5. **Aturan stok**: dipotong saat **disetujui** (bukan saat diajukan) — sudah diterapkan di kode & PRD §4.2, tetap perlu konfirmasi.
6. **Perubahan ukuran tombol** (semua tombol utama 44 px) mengubah tampilan — konfirmasi dulu kalau tidak diinginkan.

## Keputusan default yang diambil (karena tidak bisa ditanyakan)

- Aturan stok: dipotong saat disetujui; tolak tidak menyentuh stok; selesai memulihkan stok + `tanggal_kembali`.
- Enum `inventory_status` **tidak** diubah; tipe TS diselaraskan (hapus `dipinjam`), status `habis` dipakai untuk stok 0.
- Mode demo tetap ada, default mati (`NEXT_PUBLIC_DEMO_MODE=false`), banner "Mode Demo" terlihat.
- Ruangan: satu konstanta `src/lib/rooms.ts`; tidak membuat tabel `ruangan`.
- Advisor = pantau saja; admin tidak melihat tombol ajukan pinjam.
- Role switcher hanya di mode demo; produksi memakai Supabase Auth.
- Nama file migrasi lama diubah agar versinya unik (CLI gagal dengan versi kembar).

## Yang tidak teruji karena tidak ada akses

| Hal | Alasan |
|---|---|
| Perilaku di DB Supabase **produksi** | Tidak boleh disentuh; semua uji memakai Supabase lokal (Docker). |
| Job CI `db` di runner GitHub | Branch belum di-push, CI belum dijalankan. |
| RLS & RPC di Supabase **hosted** | Hanya DB lokal yang teruji; `auth.uid()` hosted sedikit berbeda implementasi. |
| Akun nyata & alur_reset password produksi | Belum ada akun riil. |
| Uji beban (skala banyak anggota) | Agregasi absensi masih di sisi klien. |
| `docs/TUGAS-STABILISASI.md` masih gagal `npm run lint:md` (MD040) | File instruksi milikmu; tidak saya ubah. |

## Ringkasan verifikasi

```bash
npx tsc --noEmit        → exit 0
npm run lint            → 0 error, 16 warning
npm run test            → 32 test lulus, 5 file
npm run build           → exit 0 (NODE_OPTIONS=--max-old-space-size=2048/4096)
npm run lint:md         → 1 error (file instruksi milikmu, TUGAS-STABILISASI.md)
npx tsx scripts/test-rls.ts           → exit 0, 7/7 PASS
npx tsx scripts/test-inventory-admin.ts → exit 0, 9/9 PASS
psql -f scripts/verify-loan-lifecycle.sql → 10/10 PASS, exit 0
```

## Dokumen

- Laporan per paket: `docs/laporan/PAKET-1.md` … `PAKET-7.md`
- Status fitur: `docs/STATUS.md`
- Pekerjaan yang ditunda: `docs/BACKLOG.md`
- Skenario uji manual: `docs/QA-CHECKLIST.md`
- Cara setup & akun nyata: `docs/SETUP-TES.md`
