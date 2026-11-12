# Paket 1 — Data harus nyata dan tersimpan: SEBAGIAN

Dikerjakan:
- `updateLoanRequestStatus`/`updateReportStatus` di `src/contexts/data-context.tsx` menulis ke Supabase (RPC `verifikasi_pinjam`/`selesaikan_pinjam`, update `reports`), bukan state React.
- Migrasi baru `supabase/migrations/20261112_fase4_loan_lifecycle.sql`: `verifikasi_pinjam` (potong stok saat disetujui, tolak bila kurang), `selesaikan_pinjam` (pulihkan stok + `tanggal_kembali`), kolom `judul/lokasi/jenis` untuk `reports`. SECURITY DEFINER + `search_path` aman + GRANT ke `authenticated`.
- Semua jalur tulis yang pernah "berpura-pura sukses" dihapus: `addInventoryItem`, `addStockToItem`, `addLoanRequest`, `addRoomBooking`, `addLabReport`, `checkIn`, `checkOut`. Error Supabase tampil ke user (`role="alert"`). Jalur "item id non-UUID dipatch lokal" dihapus.
- MOCK_* hanya aktif bila `NEXT_PUBLIC_DEMO_MODE=true` (`src/lib/demo.ts`). Produksi mulai dari array kosong + `isLoading` + `loadError`; `src/components/layout/app-shell.tsx` menampilkan skeleton dan `ErrorState` + "Muat Ulang Data". Mode demo menampilkan banner "Mode Demo — data contoh, perubahan tidak disimpan" dan memblokir semua aksi tulis.
- Satu `fetchSnapshot()` membaca `inventory_items`, `loan_requests` (+relasi item/profile/kelompok), `room_bookings`, `reports`, `attendance_sessions`, `kelompok` lewat klien anon sehingga RLS berlaku per role.

Verifikasi asli:
- `npx tsc --noEmit` → exit 0.
- `npm run lint` → `✖ 20 problems (7 errors, 13 warnings)`; 7 error semuanya pre-existing (no-empty-object-type di input/textarea, no-explicit-any + set-state-in-effect di role-context, set-state-in-effect di loan-request-sheet). Error yang sempat muncul di data-context sudah dihapus.
- `NODE_OPTIONS=--max-old-space-size=2048 npx next build` → exit 0, 7 rute ter-prerender.
- `npx next start -p 3126` + curl → `/`, `/inventaris`, `/jadwal`, `/kotak-masuk`, `/monitoring` semua 200.
- `curl http://localhost:3126/ | grep -c "Jetson Orin|Osiloskop|Soldering Station"` → 0 (tidak ada mock di HTML produksi).
- Browser (Chromium, produksi, tanpa akses Supabase dari mesin): `Gagal Memuat Data dari Database TypeError: Failed to fetch Muat Ulang Data`.
- Mode demo via dev server: banner `Mode Demo — data contoh, perubahan tidak disimpan` + item contoh tampil.

Belum beres:
- SQL belum pernah dieksekusi ke DB nyata saat paket ini selesai → status SEBAGIAN. ( Dibuktikan pada Paket 1b.)
- Identitas user masih mock (`usr-*`), sehingga tulisan RLS akan ditolak sampai ada login nyata.
- `npm run build` tanpa `NODE_OPTIONS` OOM di mesin ini (RAM kecil).
- Tombol "Ajukan Pinjam" masih tampil untuk admin; advisor masih melihat tombol verifikasi.

Butuh darimu:
1. Akses DB uji (diberikan lewat `SUPABASE_TEST_*`) untuk menjalankan migrasi dan menguji RPC stok end-to-end.
2. Konfirmasi aturan stok: stok dipotong saat **disetujui**, bukan saat diajukan.

File: `src/contexts/data-context.tsx`, `src/contexts/attendance-context.tsx`, `supabase/migrations/20261112_fase4_loan_lifecycle.sql`, `src/lib/demo.ts`. Commit: `8bcd1e4`, `5cfbd4b`.

Skipped: tidak menjalankan skrip RLS/seed saat itu (belum ada DB uji). Risiko: seluruh jalur tulis baru belum pernah menyentuh DB nyata saat paket ini ditutup.
