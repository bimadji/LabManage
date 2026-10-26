# Rencana Fase 1 — Overhaul UI/UX LabManage

Tanggal: 25 Oktober 2026
Branch: `feat/ui-overhaul`
Spec: `docs/ui-review/AUDIT-2026-10.md`, `PRODUCT.md`, `.impeccable/surfaces/web-src-app-tsx.md`
Mode: Operate, code-led; arah pengguna **Agenda regu yang terukur**.

## Tujuan dan non-tujuan

Mengganti dunia visual dan struktur interaksi berdasarkan audit aplikasi nyata. Shell harus efisien pada 375/768/1280 px; pekerjaan, entitas, status, dan aksi harus memiliki hierarki yang konsisten.

Tidak mengubah endpoint, payload, validasi, logika bisnis, RLS, guard API, maupun hak role. Tidak menambah pembatalan reservasi, filter bisnis, bulk action, pagination, atau dependency. Jangan menghapus Monitoring anggota atau mengubah cakupan Permintaan saya sampai Fase 2.

## Batas teknis global

- Bahasa UI/dokumen Indonesia; identifier Inggris.
- Gunakan pola React/CSS dan test repo yang sudah ada; tanpa library UI baru.
- Semua perubahan perilaku memakai RED → GREEN. Test bisnis/akses/action dipertahankan; jangan menggantinya dengan test kelas/screenshot.
- Target kontrol ≥44 px, teks normal ≥4,5:1, fokus terlihat, status berbasis teks, reduced motion, dan tidak ada overflow horizontal.
- Satu commit per tugas yang koheren. Setiap tugas menjalankan test cakupannya; suite penuh pada verifikasi akhir.
- Jangan menjalankan comp round. `build-phase start --direction none` salah memilih jalur comp-led; arah final sudah disetujui dan mode tetap code-led. Jangan menandai comp/hero/plate selesai.

## Kontrak antar-tugas

1. **Shell** mempertahankan `<main>` sebagai satu-satunya landmark konten dan menambahkan `id="main-content"` untuk skip link. Route dan elemen page tetap dirender `Routes` yang sama.
2. **Navigasi** mempertahankan tujuh tujuan utama untuk semua role. Subtautan hanya mengekspos route yang sudah dapat diakses: Kotak masuk admin/advisor, Tambah item admin, statistik admin, rekap advisor, Rekap saya anggota.
3. **Jadwal dan inventaris** boleh memiliki state reload lokal; signature hook/loader lain tidak berubah. Retry memanggil endpoint yang sama dan mempertahankan filter lokal.
4. **Inventaris** mempertahankan `ItemCard`, kedua form, `canRequest`, dan semua payload. Trigger disclosure memperoleh ID region; tidak memindahkan fokus otomatis.
5. **Token dan kelas bersama** dipakai halaman lain tanpa framework komponen baru. Tambahan komponen hanya jika menghilangkan duplikasi nyata.
6. **Evidence akhir** memakai route dan seed yang sama dengan baseline. Dokumen dunia final ditulis setelah implementasi, bukan sebelumnya.

Pre-flight: kontrak 1–2 dikonsumsi seluruh halaman; kontrak 3–4 menghubungkan shell, jadwal, dan inventaris; kontrak 5 menghubungkan semua tugas markup/CSS. Tidak ada perubahan API bersama. Tidak ada konflik yang diketahui sebelum membaca brief tugas.

## Task 1 — Rekam audit, arah, dan rencana

**Files:** `PRODUCT.md`, `docs/ui-review/AUDIT-2026-10.md`, `docs/ui-review/ui-overhaul-2026-10/before/`, `.impeccable/decision-direction.json`, `.impeccable/mocks/decision/`, `.impeccable/surfaces/`, `.impeccable/critique/`, rencana ini.

1. Pastikan bukti baseline dan audit lengkap, tanpa perubahan kode aplikasi.
2. Sertakan batas pixel analysis, keputusan pengguna, lisensi referensi, serta batas Fase 2.
3. Jangan commit token, `.tmp/`, log, atau state live-server.

**Expected:** commit dokumentasi saja; `git status` tidak menunjukkan perubahan tracked di `api/`, `web/`, atau `supabase/`.

## Task 2 — Shell responsif dan wayfinding

**Files:** `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/index.css`, `web/src/auth/SignIn.tsx` hanya bila struktur login memerlukan penyesuaian.

1. RED: test skip link → `#main-content`, satu main, toggle mobile dengan `aria-expanded`/`aria-controls`, semua tujuh tujuan utama, subtautan role yang sah, identitas role, dan badge admin pada Kotak masuk. Mock `apiFetch` untuk count; jangan menguji kelas CSS.
2. Jalankan test App; **Expected:** gagal karena kontrol/landmark/subtautan belum ada.
3. Implementasikan rail desktop 220 px, toggle navigasi mobile, grup navigasi, subtautan role, skip link, identitas akun, dan target logout. Tutup menu setelah perpindahan route tanpa mengubah route guard.
4. Terapkan palet kertas sejuk/tinta/rail/aksen, type scale produk tetap, angka tabular, state interaksi, fokus, 44 px, reduced motion, dan gaya login yang selaras.
5. Jalankan test App; **Expected:** semua test App lulus, termasuk autentikasi lama.
6. Smoke browser anggota/admin/advisor pada 375/768/1280; buka/tutup menu, keyboard skip link, route aktif, badge admin, dan Kotak masuk advisor.

**Expected:** menu mobile tidak mengambil 273 px saat tertutup; desktop memakai rail; tidak ada route atau permission baru.

**Commit:** `feat(web): rombak shell dan wayfinding responsif`

## Task 3 — Jadwal sebagai ledger kerja dan retry lokal

**Files:** `web/src/pages/SchedulePage.tsx`, `web/src/pages/SchedulePage.test.tsx`, `web/src/index.css`.

1. RED: kegagalan fetch awal menampilkan alert dengan `Coba lagi`; klik memuat ulang kedua resource dan menampilkan data setelah berhasil. Filter ruang yang dipilih tidak berubah selama retry.
2. **Expected:** test gagal pada tombol retry yang belum ada.
3. Tambahkan reload token/handler lokal dengan cleanup yang sama; jangan mengubah rentang 14 hari atau endpoint.
4. Susun ulang baris menjadi ledger waktu–ruang/tim–status; tanggal tetap `formatDay`, jam tetap `formatTime`, status tetap teks. Loading/empty/error tetap dapat diumumkan.
5. Jalankan test Schedule; **Expected:** retry dan seluruh kontrak filter/status lama lulus.
6. Smoke mobile dan desktop, termasuk filter kosong dan reduced motion.

**Commit:** `feat(web): susun jadwal sebagai ledger kerja`

## Task 4 — Inventaris, disclosure, dan pemulihan

**Files:** `web/src/pages/InventoryPage.tsx`, `web/src/pages/InventoryPage.test.tsx`, `web/src/index.css`; halaman turunan hanya untuk konsistensi header/tautan yang sah.

1. RED: retry inventaris setelah kegagalan, mempertahankan query/jenis/status; trigger `Lapor ambil`/`Ajukan pinjam` mempunyai `aria-controls` dan membuka region berlabel; advisor mendapat tautan Kotak masuk read-only.
2. **Expected:** test gagal pada retry/hubungan disclosure/tautan advisor.
3. Tambahkan reload lokal tanpa mengubah `filterItems`, `itemBadge`, atau request. Gunakan `useId` untuk region. Nama item menjadi fokus visual; kategori/lokasi/stok/peminjam/status/aksi memakai urutan stabil.
4. Pertahankan `canRequest = profile !== null && profile.role !== 'advisor'`, disabled stok nol, payload, pesan, fokus setelah filter, dan anti-double-submit.
5. Jalankan test Inventory; **Expected:** seluruh test baru dan lama lulus.
6. Smoke permintaan komponen dan barang pada satu akun yang sah tanpa mengubah seed secara tidak sengaja; bila smoke membuat data, catat dan pulihkan seed setelah evidence. Untuk audit ini cukup buka/tutup disclosure dan validasi client bila tidak perlu mutasi.
7. Periksa `/inventaris/:id`, `/inventaris/permintaan-saya`, `/inventaris/kotak-masuk`, `/inventaris/baru`; jangan mengubah cakupan data maupun keputusan.

**Commit:** `feat(web): perjelas katalog dan permintaan inventaris`

## Task 5 — Konsistensi halaman operasional

**Files:** halaman `Attendance`, `Monitor`, `AdminAttendance`, `AdvisorAttendance`, `MyAttendanceSummary`, `FacilityReports`, `Notifications`, `NewReservation`, `InventoryItem/New`, `MyRequests`, `InventoryInbox`; test terkait hanya bila perilaku/markup accessible berubah; `web/src/index.css`.

1. Petakan header, aksi, form, metrics, tabel, status, empty/error/loading pada pola visual bersama. Jangan melakukan rewrite state atau fetch.
2. Tambahkan konteks halaman/escape link pada 404 dan guard yang sudah ada bila diperlukan; jangan mengubah kondisi guard.
3. Samakan label yang ambigu hanya pada lapisan UI; jangan mengubah arti permintaan. Tambahkan label notifikasi `kehadiran` hanya dengan test yang membuktikan label yang diterima pengguna, bukan karena sinkronisasi tipe baru.
4. Rapikan form padat menjadi grup bertajuk/disclosure hanya bila semua kontrol, validasi, fokus, dan alur submit tetap terbukti. Jangan menambah tab/filter/bulk action.
5. Jalankan test untuk setiap file yang markup/perilakunya berubah; **Expected:** kontrak action, role, payload, validasi, dan error tetap hijau.
6. Smoke alur anggota, admin, advisor dan route langsung.

**Commit:** `refactor(web): selaraskan permukaan operasional`

## Task 6 — Verifikasi visual, aksesibilitas, dan detector

**Files:** `docs/ui-review/ui-overhaul-2026-10/after/`, `.tmp/` evidence, koreksi yang ditemukan beserta regression test bila perilaku.

1. Jalankan aplikasi nyata dengan Supabase/API lokal dan seed yang sama. Capture ulang 90 kombinasi baseline pada 375/768/1280 serta detail item yang diaudit.
2. Ukur `document.documentElement.scrollWidth <= window.innerWidth`, target ≥44 px, label, fokus, reduced motion, dan kontras computed untuk sampel yang sama. Catat batas metode.
3. Exercise: navigasi keyboard/mobile, retry, filter, disclosure, form valid/invalid sesuai test, route langsung, guard role, badge, read-only advisor, serta alur autentikasi. Jangan menganggap screenshot sebagai bukti API.
4. Jalankan `impeccable detect --json` pada markup berubah; perbaiki temuan mekanis yang benar. Maksimal dua ronde inspeksi visual batch.
5. Jalankan lint/test/build `api/` dan `web/` memakai Node 22.

**Expected:** seluruh gerbang lulus atau diperbaiki sebelum lanjut; tidak ada klaim yang tidak memiliki output.

## Task 7 — Review, dokumentasi final, PR, dan gerbang Fase 2

**Files:** `DESIGN.md`, `.impeccable/design.json`, `docs/USAGE.md` hanya untuk perubahan navigasi nyata, ledger/review artifacts lokal.

1. Tulis dunia visual final berdasarkan build aktual; jangan menyalin aturan redesign lama.
2. Buat review package dan minta satu reviewer fresh-context untuk seluruh branch. Perbaiki Critical/Important melalui RED→GREEN; catat ruling/minor.
3. Baca verification-before-completion dan finishing-a-development-branch. Ulangi verifikasi akhir setelah perbaikan.
4. Commit kecil terakhir, push `feat/ui-overhaul`, buka satu PR melalui GitHub REST, tunggu CI hijau.
5. Fase 2 hanya dimulai setelah Fase 1 selesai dan CI hijau. Branch dan PR Fase 2 terpisah.

## Review focus

- Menu responsif dan focus order, terutama konten yang disembunyikan CSS.
- Role-based discoverability tanpa perubahan hak atau guard.
- Race/cleanup pada retry dan error setelah data sebelumnya ada.
- Disclosure beberapa item, ID unik, keyboard, dan state setelah submit.
- Semua payload/path/role/validasi tetap identik.
- Overflow dari grid, tabel, form tanggal, string panjang, dan viewport 375 px.
- Bukti visual dibedakan dari test serta batas analisis kontras/pixel.
