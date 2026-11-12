# Laporan Stabilisasi LabManage

Fase stabilisasi: memperbaiki bug, menyambungkan data ke database, menutup celah akses. Bukan pengembangan fitur.

| Paket | Status | Catatan |
|---|---|---|
| 1 — Data nyata & tersimpan | **SEBAGIAN** | Aksi tulis/verifikasi/laporan kini menulis DB; stok pulih atomik via RPC; fallback palsu dihapus; MOCK_* hanya di mode demo. Belum diuji ke DB hidup (mesin audit tanpa akses jaringan Supabase) dan identitas user masih mock (paket 2). |
| 2 — Autentikasi & hak akses | BELUM | — |
| 3 — Presensi & jam riset | BELUM | — |
| 4 — Booking ruangan | BELUM | — |
| 5 — Bug kecil terlihat user | BELUM | — |
| 6 — Test & pengaman | BELUM | — |
| 7 — Kesiapan tes nyata | BELUM | — |

---

## Paket 1 — Data harus nyata dan tersimpan

Status: **SEBAGIAN**.

### Yang dikerjakan

1. **Aksi verifikasi & status tersimpan ke DB.** `src/contexts/data-context.tsx`:
   - `updateLoanRequestStatus(id, status, note)` → RPC `verifikasi_pinjam` (setuju/tolak) atau `selesaikan_pinjam` (selesai). Tidak ada lagi mutasi state lokal.
   - `updateReportStatus(id, status)` → `update reports ... select("id")`; bila 0 baris terpengaruh (RLS/milik orang lain) mengembalikan error jujur.
2. **Siklus pinjam + stok atomik.** Migrasi baru `supabase/migrations/20261112_fase4_loan_lifecycle.sql` (migrasi lama tidak disentuh):
   - `verifikasi_pinjam(p_loan_id, p_setuju, p_alasan)`: cek role admin, kunci baris `loan_requests` (`FOR UPDATE`), saat setuju kunci `inventory_items`, tolak bila `stok_tersedia < jumlah`, potong stok, set status `habis` bila tersisa 0. Tolak tidak menyentuh stok (belum pernah dipotong).
   - `selesaikan_pinjam(p_loan_id)`: hanya dari status `disetujui`, pulihkan stok dengan `LEAST(stok_total, stok_tersedia + jumlah)` dan `tanggal_kembali = NOW()`, status `selesai`.
   - Keduanya `SECURITY DEFINER`, `search_path = public, pg_temp`, `GRANT EXECUTE` hanya ke `authenticated`.
   - UI: tombol **"Tandai Dikembalikan"** muncul di `review-request-sheet.tsx` saat status `disetujui`; tombol setujui/tolak hanya untuk status `menunggu`.
3. **Fallback palsu dihapus.** `addInventoryItem`, `addStockToItem`, `addLoanRequest`, `addRoomBooking`, `addLabReport`, `checkIn`, `checkOut` kini mengembalikan `{ success:false, error }` saat Supabase gagal. Jalur "item id non-UUID dipatch lokal" dihapus. Setiap dialog menampilkan pesan error (`role="alert"`).
4. **MOCK_* hanya mode demo.** `src/lib/demo.ts` (`NEXT_PUBLIC_DEMO_MODE === "true"`). State awal provider = array kosong + `isLoading`; `app-shell.tsx` menampilkan skeleton saat memuat dan `ErrorState` + tombol "Muat Ulang Data" saat gagal. Mode demo menampilkan banner kuning "Mode Demo — data contoh, perubahan tidak disimpan" dan memblokir semua aksi tulis. Monitoring & ringkasan tim memakai mock hanya saat demo, selain itu empty state.
5. **Kueri baca baru.** Satu `fetchSnapshot()` memuat `inventory_items`, `loan_requests` (+relasi item/profile/kelompok), `room_bookings`, `reports`, `attendance_sessions`, `kelompok`. Semua lewat klien anon sehingga RLS berlaku per role.

### Verifikasi (output asli)

```
$ npx tsc --noEmit
TSC OK (exit 0)

$ npm run lint
✖ 20 problems (7 errors, 13 warnings)
  - 7 error semuanya pre-existing: no-empty-object-type (input.tsx 4:18, 24:18; textarea.tsx 4:18),
    no-explicit-any (role-context.tsx 33:51), set-state-in-effect (role-context.tsx 67:9,
    loan-request-sheet.tsx 38:7)
  (sebelum paket ini: 9 error — 1 error baru yang saya buat di data-context sudah dihapus)

$ NODE_OPTIONS=--max-old-space-size=2048 npx next build
EXIT=0, 7 rute ter-prerender (/, /inventaris, /jadwal, /kotak-masuk, /monitoring, /_not-found, /icon.svg)

$ npx next start -p 3126 + curl tiap rute
/ -> 200, /inventaris -> 200, /jadwal -> 200, /kotak-masuk -> 200, /monitoring -> 200

$ curl http://localhost:3126/ | grep -c "Jetson Orin|Osiloskop|Soldering Station"
0        # tidak ada data mock di HTML produksi
$ curl ... | grep -c 'aria-busy'
1        # skeleton tampil saat memuat
```

Verifikasi browser (Chromium, produksi, tanpa akses Supabase dari mesin ini):

```
main text: "Gagal Memuat Data dari Database TypeError: Failed to fetch Muat Ulang Data"
```

Verifikasi mode demo (`next dev` dengan `NEXT_PUBLIC_DEMO_MODE=true`):

```
GET / -> 200
banner  : "Mode Demo — data contoh, perubahan tidak disimpan"
mock item: "Jetson Orin", "Osiloskop" tampil
```

Catatan build: `next build` OOM bila heap kecil. `1536` gagal pada fase "Collecting page data"; `2048` lulus. Build varian demo (`NEXT_PUBLIC_DEMO_MODE=true`) **gagal** di mesin ini karena kehabisan RAM (`memory allocation of 11468800 bytes failed`, worker exit 9/134) — bukan error kode; mode demo diverifikasi lewat dev server.

### Yang belum beres

- **Belum diuji terhadap database hidup.** Mesin audit tidak bisa resolve `zbiqklnktocnqmjyiyjs.supabase.co` (`getaddrinfo ENOTFOUND`), jadi RPC stok, RLS, dan persistensi belum dibuktikan runtime. Yang ada: tsc/lint/build + kode + SQL.
- **Migrasi belum diterapkan** ke project Supabase mana pun (tidak saya jalankan, sesuai aturan).
- **Identitas user masih mock.** `currentUser.id` = `usr-*` (mock), bukan `auth.uid()`. Akibatnya insert `reports`/`loan_requests`/`attendance_sessions` akan ditolak RLS sampai paket 2 selesai. Ini bukan regresi: sebelumnya pun tulisan ditolak, hanya disembunyikan.
- **7 error ESLint** tersisa (daftar di atas) — paket 5.
- Tombol "Ajukan Pinjam" masih tampil untuk admin; advisor masih melihat tombol verifikasi (paket 2).

### Butuh keputusan / akses

1. **Akses DB uji**: perlu project/branch Supabase uji + kredensial agar saya bisa menerapkan migrasi dan menguji RPC stok end-to-end. Tanpa itu paket 1 tidak bisa dinaikkan ke SELESAI.
2. **Aturan stok**: saya putuskan stok dipotong saat **disetujui**, bukan saat diajukan. Alasannya: permohonan `menunggu` belum tentu disetujui. Konfirmasi bila stok harus dipesan sejak pengajuan.
