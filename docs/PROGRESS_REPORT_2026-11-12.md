# Laporan Progres Proyek LabManage (LabManageV3)

Tanggal audit: 2026-11-12. Sifat: audit verifikasi dari kode nyata, bukan presentasi. Bersifat read-only; tidak ada perubahan kode.

Metodologi ringkas: (a) dokumen sumber kebenaran dibaca utuh (AGENTS.md, DESIGN.md, docs/PRD.md, docs/USAGE.md; README.md sebagai konteks), (b) setiap janji dicocokkan ke kode di `src/`, `supabase/migrations/`, `scripts/`, (c) build, lint, typecheck, dan skrip verifikasi dijalankan, hasil asli dicatat, (d) `git log`/`git status` diperiksa. Klaim dibedakan: [VERIFIKASI] = saya periksa sendiri dari kode/output; [KLAIM-DOK] = hanya diklaim di dokumen; [OPINI] = penilaian saya.

---

## 1. Ringkasan jujur

Proyek saat ini adalah **tulis-ulang total** dari repo lama: commit `fb4e205` ("chore: remove all code") menghapus monorepo `api/` + `web/` Express-Vite beserta seluruh dokumen lama (HANDOVER.md, PRD lengkap bagian 1–11, rencana eksekusi, audit UI) dan menggantinya dengan aplikasi Next.js 16 App Router yang baru; riwayat tugas dari repo lama kini hanya tersedia di git history, bukan di dokumen aktif. Dari 25 item janji yang bisa saya identifikasi dari dokumen aktif (PRD, USAGE, DESIGN) ditambah aturan di AGENTS.md/DESIGN, **4 item SELESAI, 11 SEBAGIAN, 8 BELUM, 2 BERTENTANGAN** — persentase penyelesaian ±16% (4/25) jika dihitung konservatif terhadap definisi "berfungsi dan terverifikasi", atau ±60% jika hanya dihitung "antarmukanya ada". Perkiraan konservatif yang lebih representatif untuk kondisi nyata: **±40%** (12/25 item memiliki bukti kode yang benar-benar jalan, termasuk yang SEBAGIAN). Tiga masalah terbesar: (1) **alur data hibrida mock–DB**: state aplikasi diinisialisasi dari `MOCK_*` di `src/lib/mock-data.ts` dan hanya sebagian yang disinkronkan ke Supabase — persetujuan/penolakan pinjam dan perubahan status laporan tidak pernah menulis ke database dan hilang saat refresh; (2) **guard hak akses hampir seluruhnya di sisi klien** — tidak ada middleware/server guard; peran (admin/anggota/advisor) disimpan di state React yang bisa diganti bebas lewat "Role Switcher"; (3) **tidak ada pengujian otomatis sama sekali** — `src/` tanpa satu pun `*.test.ts(x)`, `package.json` tanpa script `test`, dua skrip verifikasi di `scripts/` hanya smoke-test live-DB dengan `console.log`, selalu exit 0 walau gagal. Build produksi gagal di lingkungan audit ini karena OOM Node (mesin audit hanya ±1 GB RAM bebas), tetapi `npx tsc --noEmit` lulus dan prerender produksi lulus ketika heap dibatasi 1536 MB; perilaku build di mesin dengan RAM cukup belum terverifikasi.

---

## 2. Hasil build / test / lint

| Perintah | Hasil asli |
|---|---|
| `npx tsc --noEmit` | **LULUS** (exit 0, tanpa error) |
| `npm run lint` (eslint) | **GAGAL**: 23 masalah — 9 error, 14 warning. Error: `react-hooks/set-state-in-effect` di `src/contexts/data-context.tsx:108` (`refreshData()` dipanggil langsung di effect) dan `src/contexts/role-context.tsx:67` (`setCurrentUserState` di effect); `@typescript-eslint/no-explicit-any` di `role-context.tsx:33`. |
| `npm run build` (default) | **GAGAL** — OOM Node: `FATAL ERROR: Committing semi space failed. Allocation failed - JavaScript heap out of memory` pada fase "Running TypeScript". Mesin audit punya ±1,06 GB RAM bebas (os.freemem). |
| `NODE_OPTIONS=--max-old-space-size=1536 npx next build` | **LULUS** — build sukses, `Finished TypeScript in 2.6s`, `.next/BUILD_ID` = `HGqq0S6q7hPlXmFAPb5--`. Rute ter-prerender: `/`, `/inventaris`, `/jadwal`, `/kotak-masuk`, `/monitoring`. |
| `npx next start` (smoke) | **LULUS** — server jalan di port 3123; `GET /` 200, `GET /monitoring` 200. HTML home memuat data mock di payload awal (`Jetson Orin`, `Osiloskop`, `Soldering Station Hakko`, angka 6.5 jam). HTML `/monitoring` memuat `Akses Terbatas` untuk role anggota (SSR render pelindung). |
| `npx tsx scripts/test-rls.ts` | **TIDAK DIJALANKAN** — butuh koneksi Supabase live dengan kredensial `.env.local`; audit tidak mengeksekusi script yang menulis/menyentuh DB remote produksi. Skrip memiliki guard `process.exit(0)` bila env kosong. |
| `npx tsx scripts/test-inventory-admin.ts` | **TIDAK DIJALANKAN** — alasan sama: butuh Supabase live + user seeded. |
| `npm run test` | **PERINTAH TIDAK ADA** di `package.json` (tidak ada jest/vitest/pytest). |
| `npm run lint:md`, `npm run check:mermaid`, `npm run check:links` | TIDAK DIJALANKAN (bukan jalur kode; waktu audit dibatasi pada jalur perilaku). |

Kesimpulan build: bukti `npm run build` yang gagal OOM adalah **kendala lingkungan** (RAM), bukan kesalahan kode yang saya temukan; build dengan heap 1536 MB lulus penuh.

---

## 3. Tabel status per item

Sumber: [P] = docs/PRD.md; [U] = docs/USAGE.md; [D] = DESIGN.md; [R] = README.md; [A] = AGENTS.md; [GP] = git history (rencana lama, sudah dihapus dari repo di `fb4e205`).

| ID | Item | Sumber | Status | Bukti |
|---|---|---|---|---|
| F-01 | Inventaris terpadu: atribut lengkap (nama, kode unik, kategori, lokasi, stok_total, stok_tersedia, status, pemilik_kelompok_id, dapat_dipinjam_kelompok_lain) | P §4.1 | SELESAI | [VERIFIKASI] `supabase/migrations/20261027_fase2_group_based_schema.sql:96-112` (semua kolom + CHECK); `src/types/index.ts:31-45`; form `src/components/overlays/add-item-dialog.tsx` |
| F-02 | Filter katalog 4 jenis (Semua Aset / Milik Bersama Lab / Milik Kelompok Saya / Bisa Dipinjam Lintas Kelompok) | P §4.1 | SELESAI | [VERIFIKASI] `src/app/inventaris/page.tsx:27,54-62` — `ownershipFilter` 4 nilai; label di JSX |
| F-03 | Tombol tambah barang & tambah stok hanya untuk Admin | P §4.1 + P §3 matriks | SELESAI | [VERIFIKASI] Render guard `role === "admin"` di `src/app/inventaris/page.tsx:44,95-99`; guard komponen `add-item-dialog.tsx:35`, `add-stock-dialog.tsx:29`; DB policy `inventory_admin_manage` di `20261027_fase3_admin_inventory_management.sql:7-11` |
| F-04 | Penambahan stok atomik via RPC (`SELECT ... FOR UPDATE`), status habis→tersedia, rusak tidak diubah | P §2 Goals, P §4.1 | SELESAI (DB) / SEBAGIAN (app) | [VERIFIKASI] RPC `public.tambah_stok_inventory` SECURITY DEFINER di `20261027_fase3...sql:18-77` dengan `FOR UPDATE`, validasi role & jumlah, GRANT ke authenticated. App memanggil `supabase.rpc("tambah_stok_inventory")` di `data-context.tsx:199`. **Tapi** ada 2 jalur fallback lokal yang melewati RPC: item id non-UUID (mock) di-patch lokal dan tetap `return { success: true }`; catch error juga patch lokal. |
| F-05 | Permohonan pinjam mencatat peminjam, kelompok, item, jumlah, keperluan, tanggal kembali | P §4.2 | SELESAI | [VERIFIKASI] Tabel `loan_requests` di `20261027_fase2...sql:114-128`; form `loan-request-sheet.tsx`; insert di `data-context.tsx:275-283` |
| F-06 | Admin TIDAK boleh membuat permohonan pinjam | P §4.2 + P §3 | SELESAI | [VERIFIKASI] DB: `loan_insert_policy WITH CHECK (current_role() <> 'admin' AND user_id = auth.uid() ...)` di `20261027_fase2...sql:395-419`; UI: pesan error `loan-request-sheet.tsx:47-50`. Catatan: tombol "Ajukan Pinjam Barang" di halaman inventaris tidak di-gate per role, jadi admin bisa buka sheet dan baru dapat error saat submit (UX, bukan celah keamanan). |
| F-07 | Pengembalian / penolakan memulihkan `stok_tersedia` otomatis | P §4.2 | **BELUM** | [VERIFIKASI] Tidak ada trigger/function DB yang mengembalikan stok (`grep trigger` di `supabase/` = 0 hasil). `updateLoanRequestStatus` di `data-context.tsx:305-331` hanya memutasi state React lokal; **tidak ada panggilan Supabase sama sekali** di fungsi ini (grep: tidak ada `from("loan_requests").update`). Penolakan mengembalikan stok di UI lokal, tapi data DB tidak berubah — hilang saat refresh. Alur "selesai/kembalikan" (`tanggal_kembali`, status `selesai`) tidak ada jalur kode. |
| F-08 | Presensi live-timer (Check-In/Check-Out anggota tim riset) | P §4.3, U §4 | SEBAGIAN | [VERIFIKASI] Timer nyata di `attendance-context.tsx:36-48` (setInterval + Date.now); checkIn `insert` ke `attendance_sessions` (:55-63), checkOut `update` (:75-79). **Kelemahan**: (a) error Supabase ditelan (`catch {}`); (b) `user_id` diambil dari state mock (`usr-eros-01`) bukan `auth.uid()` — terhadap Supabase nyata, RLS `WITH CHECK (user_id = auth.uid())` akan menolak tulisan ini; (c) tidak ada satu pun `select` dari `attendance_sessions` di `src/` — durasi tersimpan di DB (generated column `durasi_menit`) tapi tidak pernah dibaca. |
| F-09 | Target 10 jam mingguan + progres akumulasi | P §4.3 | SEBAGIAN (MOCK-ONLY untuk akumulasi) | [VERIFIKASI] Target berasal dari `kelompok.target_jam_mingguan` saat profil DB tersedia (`role-context.tsx:45`), tapi label UI hardcode `Target Wajib: 10 Jam / Minggu` (`attendance-widget.tsx:81`). `weeklyAccumulatedHours` diinisialisasi `useState(6.5)` (`attendance-context.tsx:29`) — angka fiktif — dan hanya bertambah via `checkOut` di state lokal; tidak ada kueri agregasi jam mingguan dari DB. Ada tombol `resetWeeklyDemo` di UI (`attendance-widget.tsx:179`). |
| F-10 | UKM Roboholic: timer disembunyikan, kartu "bebas target jam" | P §4.3, U §4 | SELESAI | [VERIFIKASI] `attendance-widget.tsx:29-56` — conditional render kartu UKM; guard kedua di `attendance-context.tsx:50-54` (alert + return). RLS juga memblokir insert UKM (`attendance_insert_tim_riset` di `20261027_fase2...sql`). |
| F-11 | Pemesanan ruangan 3 fasilitas + validasi anti-bentrok di klien + Exclusion Constraint GiST di DB | P §4.4, U §5 | SEBAGIAN | [VERIFIKASI] Constraint GiST ada: `no_overlapping_room_bookings EXCLUDE USING gist (ruangan_id WITH =, tstzrange(...) WITH &&) WHERE (status='aktif')` + `CREATE EXTENSION btree_gist` di `20261027_fase2...sql:22,144-147`. Tiga ruangan ada di UI (`room-booking-dialog.tsx:144-148`). **Tapi** validasi klien membandingkan *string* ("Hari Ini", "13:30 - 17:30 WIB (Siang)"), bukan datetime; `startTime`/`endTime` dari select tidak pernah di-set, jadi insert ke DB memakai fallback `new Date().toISOString()` (`data-context.tsx:360-361`) — slot yang dipilih tidak sesuai yang tersimpan; deteksi bentrok di level string juga mudah bocor. |
| F-12 | Monitoring khusus Admin + Advisor; anggota dialihkan/diblokir | P §3, P §4.5, R | SEBAGIAN | [VERIFIKASI] Link disembunyikan dari anggota (`sidebar.tsx:74-78` `roles: ["admin","advisor"]`); halaman menampilkan ErrorState jika role anggota (`monitoring/page.tsx:30-40`). **Tapi** ini hanya guard klien — tidak ada middleware/server guard, dan role bisa diganti bebas via Role Switcher (localStorage). Komentar kode menyebut "RLS & UI protection" padahal halaman ini tidak melakukan kueri Supabase sama sekali. |
| F-13 | Grafik jam riset vs target 10 jam + utilisasi ruangan + tabel rekap | P §4.5, U §6, R | SEBAGIAN (MOCK-ONLY) | [VERIFIKASI] Ketiga visual ada di `monitoring/page.tsx` dengan recharts (BarChart + ReferenceLine y=10; PieChart okupansi; tabel rekap). **Tapi** semua data dari `MOCK_TEAM_MONITORING` dan array okupansi hardcode inline (45/35/20%); tidak ada kueri Supabase di halaman ini. |
| F-14 | Advisor hanya "Memantau Saja" (tanpa aksi tulis verifikasi) | P §3 | **BELUM** (di UI) | [VERIFIKASI] `kotak-masuk/page.tsx` hanya membedakan `isAdmin` vs bukan; advisor mendapat tombol "Tinjau Permohonan" dan bisa memanggil `updateLoanRequestStatus`/`updateReportStatus` tanpa cek role (`review-request-sheet.tsx:36-59`). Pada DB, policy `loan_update_admin` dan `reports_update_policy` hanya izinkan admin — tulisan advisor akan ditolak RLS, tapi UI tidak merefleksikan batasan ini (aksi terlihat bisa dilakukan). |
| F-15 | Akun simulasi peran sesuai USAGE (Ahmad Zaki Fauzan=Admin, Dimas=Anggota Tim Riset, Rina=UKM Roboholic, Dr. Budi=Advisor) | U §1 | SELESAI (mock) | [VERIFIKASI] Semua 4 ada di `MOCK_USERS_LIST` (`mock-data.ts:32-117`) dengan role/kelompok sesuai; juga cocok dengan seed di `scripts/seed-dummy.ts` (7 akun, email @labmanage.test, NIM sama). |
| F-16 | Status badge dengan token warna konsisten per status | D §3 | SEBAGIAN / BUG | [VERIFIKASI] `status-badge.tsx`: menunggu/disetujui/ditolak/rusak/tersedia cocok token DESIGN §3 persis. **Bug**: setelah `case "habis": return {...}` ada blok `return` kedua yang **tidak terjangkau** (dead code) — berisi token ungu untuk `dipinjam` dan label `ditangani`/`aktif`. Akibatnya `dipinjam`, `ditangani`, `aktif` jatuh ke `default` berwarna slate, melanggar token DESIGN §3 (dipinjam harusnya `bg-purple-100 border-purple-200 text-purple-800`). Juga: enum DB `inventory_status` tidak punya nilai `dipinjam` (hanya `tersedia/rusak/habis`) padahal TS type & mock memakainya — tidak konsisten antara skema dan tipe. |
| F-17 | Tema Ocean Breeze: token warna lengkap | D §2 | SELESAI | [VERIFIKASI] `globals.css:3-25` cocok verbatim dengan DESIGN §2 untuk semua 12 token. Catatan README salah menyebut Emerald `#047857` (seharusnya `#22c55e`). |
| F-18 | Tipografi DM Sans + hierarki ukuran (H1 30px, H2 20px, H3 16px, body 14px, caption 12px) | D §1 | SEBAGIAN | [VERIFIKASI] Font & variabel `--font-dm-sans` sesuai (`layout.tsx:3-8`). Deviasi ukuran: H1 aktual 20/24px (`text-xl md:text-2xl`, `banner.tsx:35`) bukan 30px; H2 aktual 16px bold (`header.tsx:89`) bukan 20px semibold; H3 tanpa kelas ukuran eksplisit (`card.tsx` CardTitle); body di banner pakai `text-slate-600` bukan `text-slate-700` (`banner.tsx:38`). |
| F-19 | Radius: kontainer `rounded-lg`, avatar & pill `rounded-full` | D §4.1 | SEBAGIAN | [VERIFIKASI] Mayoritas komponen patuh (button/input/card/tabs/styled-link/sidebar link). Kebocoran `rounded-xl` di `banner.tsx:20`, `sidebar.tsx:94,137`, `header.tsx:103,166`, `dialog.tsx` DialogContent, `jadwal/page.tsx` beberapa kartu. |
| F-20 | Kartu: bg putih, border slate-200, shadow-sm→hover:shadow-md, padding p-5/p-6 | D §4.2 | SELESAI | [VERIFIKASI] `card.tsx:13` `rounded-lg border border-slate-200/80 bg-white ... shadow-sm transition-shadow duration-200 hover:shadow-md` (border pakai opacity /80 — deviasi minor). |
| F-21 | Tautan tanpa underline; pakai tombol atau StyledLink (`text-slate-600 hover:text-emerald-600 font-medium transition-colors`) | D §4.3 | SEBAGIAN | [VERIFIKASI] `globals.css:44-46` `a{text-decoration:none}` (patuh global). Varian `link` di `button.tsx:20` memakai `hover:underline` (melanggar). Kelas StyledLink tidak sama dengan spesifikasi (varian "subtle" = pill filled, "ghost" = `hover:bg-slate-100`). Widget banyak memakai raw `<Link>` dengan kelas ad-hoc (`font-semibold text-emerald-600 hover:text-emerald-700`), bukan StyledLink. |
| F-22 | Banner Ocean Breeze: gradient + border `emerald-100/70` | D §4.4 | SEBAGIAN | [VERIFIKASI] Gradient cocok persis `from-emerald-50 via-sky-50 to-teal-50` di `banner.tsx:20`; border aktual `border-emerald-200/80` bukan `border-emerald-100/70`. |
| F-23 | Sheet slide-over dari kanan (`w-full sm:max-w-md md:max-w-lg`) + Dialog tengah dengan `backdrop-blur-sm bg-slate-900/40`, tanpa pindah URL | D §4.5 | SELESAI | [VERIFIKASI] `sheet.tsx:36` persis sesuai spesifikasi; `dialog.tsx:21` backdrop persis; semua overlay berbasis state OverlayContext, `e.preventDefault()` di submit, tidak ada `useRouter` di `src/`. |
| F-24 | Bahasa antarmuka 100% Indonesia | D §4.6 | SEBAGIAN | [VERIFIKASI] Grep teks Inggris di UI: hanya `aria-label="Toggle menu"` (`header.tsx:78`) dan `Off` di pill kehadiran (`sidebar.tsx:180`). Sisanya label/tombol/aria sr-only semuanya Indonesia. |
| F-25 | Konvensi & batasan AGENTS.md (Next.js versi terkini — baca docs `node_modules/next/dist/docs` sebelum menulis kode) | A | TIDAK TERVERIFIKASI | [VERIFIKASI] AGENTS.md hanya memuat blok otomatis `nextjs-agent-rules`; tidak ada aturan tambahan milik repo. Kepatuhan "baca guide Next sebelum menulis kode" tidak bisa saya audit karena butuh konteks penulisan kode historis. |

Item dari rencana lama di git history (semua dihapus dari repo aktif di `fb4e205`), saya cantumkan untuk kejujuran karena disebut "execution plan" oleh user — statusnya di kode AKTIF:

| ID | Item (dari plan lama 2026-10-20/21/25) | Status di kode aktif | Bukti |
|---|---|---|---|
| X-01 | Rekap absensi mingguan/bulanan per anggota | **BELUM** | Tidak ada kueri agregasi `attendance_sessions` di `src/` |
| X-02 | Target jam riset diatur admin + status KURANG/TERCAPAI tepat di batas | **BELUM** | Tidak ada tabel `attendance_settings` di migrasi aktif; UI pakai angka 6.5 + 10 hardcode |
| X-03 | Peringatan advisor (maks 1/hari) + notifikasi + audit log | **BELUM** | Tidak ada tabel `attendance_warnings`/`notifications` di migrasi aktif; tidak ada UI peringatan |
| X-04 | Koreksi sesi lupa check-out oleh admin dengan audit | **BELUM** | Tidak ada RPC koreksi; tidak ada jalur admin edit absensi |
| X-05 | Statistik admin (rata-rata mingguan, tingkat kehadiran, tren) | **BELUM** | `monitoring/page.tsx` hanya mock, tanpa statistik agregat |
| X-06 | Halaman advisor rekap semua anggota + tombol kirim peringatan | **BELUM** | Tidak ada halaman terpisah; hanya tabel di monitoring (mock) |
| X-07 | Laporan kondisi fasilitas (anggota buat, admin tangani, advisor lihat) | SEBAGIAN | UI `report-dialog.tsx` + state `labReports` lokal; **tidak ada** kueri Supabase `reports` di `src/` (grep: 0 hit) — semua lokal mock. RLS reports ada di migrasi tapi tak pernah dipakai app. |
| X-08 | Notifikasi anggota (daftar + tandai dibaca) | **BELUM** | Tidak ada tabel/komponen notifikasi di migrasi aktif & `src/` |
| X-09 | Shell 220px rail + skip link + aria-expanded + reduced-motion | **BELUM/SEBAGIAN** | Rail aktual 256px (`app-shell.tsx:11` `md:w-64`); skip link tidak ada; aria-expanded tidak ada; prefers-reduced-motion tidak ada |
| X-10 | Test UI anggota check-in/check-out, peringatan, dsb. (rencana lama) | **BELUM** | Tidak ada test apapun di `src/` |

---

## 4. Yang sudah selesai (ringkas per area)

**Database (paling solid):** Skema `20261027_fase2_group_based_schema.sql` (497 baris): 7 tabel (kelompok, profiles, inventory_items, loan_requests, room_bookings, attendance_sessions, reports), 6 enum, 22 policy RLS aktif di semua tabel, helper SECURITY DEFINER di schema `labmanage` dengan `search_path` aman, exclusion constraint GiST untuk anti-bentrok ruangan, generated column durasi. Migrasi `20261027_fase3_admin_inventory_management.sql`: RPC atomik `tambah_stok_inventory` dengan `FOR UPDATE`, validasi role, GRANT eksplisit.

**Inventaris:** atribut lengkap di skema+types+form; 4 filter kepemilikan; tombol admin di-gate 3 lapis (render, komponen, DB policy); RPC stok atomik nyata dan dipakai dari `data-context`.

**Peran & akses di DB:** Pemisahan admin/anggota/advisor di level PostgreSQL nyata dan cukup rapi (SELECT/INSERT/UPDATE per role; admin tidak bisa buat permohonan pinjam; UKM diblokir presensi).

**UI/UX:** Token tema Ocean Breeze cocok verbatim; Sheet/Dialog sesuai spesifikasi; Card sesuai; Bahasa UI praktis 100% Indonesia; shell responsif dengan drawer mobile; role switcher dan 4 akun demo sesuai USAGE; 5 route ter-prerender sukses.

**Presensi:** Timer live nyata (interval, bukan fiktif); kartu UKM vs Tim Riset dibedakan; check-in/out punya jalur tulis DB.

---

## 5. Yang belum selesai atau bermasalah (urut dampak)

1. **Alur persetujuan pinjam & laporan tidak tersambung ke DB** (dampak besar, usaha sedang). `updateLoanRequestStatus` dan `updateReportStatus` di `data-context.tsx` hanya mengubah state React; tidak ada `update` ke `loan_requests`/`reports`. Admin menyetujui permohonan → UI berubah → refresh → kembali ke semula. Juga tidak ada jalur pengembalian barang (`selesai`), dan `stok_tersedia` tidak pernah dipulihkan di DB. Ini inti PRD §4.2 dan F-07/X-07.
2. **Akumulasi jam riset fiktif** (dampak besar, usaha sedang). `weeklyAccumulatedHours` mulai dari 6.5 dan hanya bertambah dari timer lokal; tidak ada kueri `attendance_sessions` untuk menghitung jam mingguan. Monitoring dan widget Tim menampilkan `MOCK_TEAM_MONITORING` + okupansi hardcode — grafik PRD §4.5 kosong dari data nyata.
3. **Guard peran hanya di sisi klien** (dampak besar keamanan-UX, usaha sedang–besar). Tidak ada middleware Next.js atau server-component guard. Role berasal dari `role-context.tsx` yang bisa diganti siapa saja via localStorage. Meski RLS PostgreSQL membatasi tulisan berviolensi di DB, UI menampilkan aksi (tinjau, setujui) yang seharusnya tidak ada untuk advisor; halaman `/monitoring` hanya menampilkan pesan error, bukan redirect server. `user_id` dari state mock juga akan ditolak RLS saat check-in ke Supabase nyata.
4. **Tidak ada pengujian otomatis** (dampak besar jangka panjang, usaha sedang). Tanpa jest/vitest; tanpa satu pun `*.test.ts(x)`. Dua skrip di `scripts/` hanya smoke-test live-DB dengan `console.log`, selalu exit 0 walau gagal (melanggar semangat "lulus build+test sebelum merge" dari HANDOVER lama). Tidak ada CI di repo aktif (`.github/workflows` tidak ada lagi).
5. **Kegagalan tulis Supabase ditelan diam-diam** (dampak sedang, usaha kecil). `addInventoryItem`, `addLoanRequest`, `addRoomBooking`, check-in/out — semuanya try/catch yang menyembunyikan error dan mengembalikan `success: true` dengan data lokal; user melihat "Berhasil!" padahal DB gagal. Ini bug kejujuran data, bukan sekadar gaya.
6. **Booking ruangan tidak menulis slot waktu yang dipilih** (dampak sedang, usaha kecil–sedang). `startTime`/`endTime` tidak di-set dari select tanggal/jam, insert memakai `new Date().toISOString()` fallback; deteksi bentrok membandingkan string label, bukan rentang waktu. Exclusion constraint GiST di DB tidak akan bekerja efektif terhadap input ini.
7. **Status badge `dipinjam`/`ditangani`/`aktif` salah warna + dead code** (dampak kecil, usaha kecil). Blok `return` kedua di `status-badge.tsx:72-82` tidak terjangkau; jatuh ke `default` slate. Enum DB tidak punya `dipinjam`.
8. **Deviasi DESIGN.md spesifik** (dampak kecil, usaha kecil). H1/H2 salah ukuran; border banner `emerald-200/80` bukan `emerald-100/70`; `rounded-xl` bocor di beberapa tempat; StyledLink kelasnya tidak sesuai spesifikasi; `aria-label="Toggle menu"` Inggris; "Off" di sidebar.
9. **Aksesibilitas dasar hilang** (dampak sedang, usaha sedang). Tidak ada skip link, tidak ada `aria-expanded` di toggle nav, tidak ada `prefers-reduced-motion`, touch target < 44px (button default h-9 = 36px), toggle nav tanpa focus ring.
10. **Dokumen usang / tidak konsisten** (dampak kecil, usaha kecil). README mengklaim Emerald `#047857` padahal kode/DESIGN `#22c55e`; README mengklaim "14 Kebijakan RLS" padahal `grep -c "CREATE POLICY"` = 23 di kedua migrasi; README menyebut "Group-aware navigation", "RLS aktif", tapi tidak menyebut keterbatasan mock-first. `docs/` kehilangan HANDOVER, PRD lengkap (bagian 1–11), rencana eksekusi, dan audit UI yang dulu ada — semuanya dihapus di `fb4e205` tanpa dokumen pengganti.

---

## 6. Ketidakkonsistenan

**Dokumen vs kode:**

- README: "Emerald Green `#047857`" vs DESIGN.md & `globals.css`: `#22c55e`. → **BERTENTANGAN** (kode yang dipakai `#22c55e`).
- README: "RLS 14 Kebijakan" vs aktual 23 `CREATE POLICY`. → **BERTENTANGAN**.
- PRD §4.2: "Pengembalian dan penolakan pinjaman secara otomatis memulihkan jumlah stok_tersedia" vs kode: tidak ada jalur DB. → **BERTENTANGAN**.
- PRD §4.4: "Validasi anti-bentrok diterapkan di sisi klien sebelum kirim dan divalidasi mutlak di database via GiST" vs kode: klien membandingkan string, dan insert DB tidak mengirim rentang waktu yang dipilih. → **BERTENTANGAN** (DB constraint ada, tapi input dari UI tidak memanfaatkannya dengan benar).
- PRD §3: Advisor "Memantau Saja" vs kode: advisor mendapat tombol aksi tulis. → **BERTENTANGAN**.
- Komentar `monitoring/page.tsx`: "(RLS & UI protection)" vs kenyataan: tidak ada kueri Supabase di halaman ini. → **BERTENTANGAN** (komentar menyesatkan).
- USAGE §2.1: "klik tombol Tambah Barang Baru berwarna ungu" vs kode: `bg-indigo-600` (indigo, bukan ungu-purple). Deviasi minor.

**Dokumen vs dokumen:**

- DESIGN.md §4.1 "DILARANG underline" vs README screenshot yang menampilkan link underline (tidak bisa saya verifikasi piksel); antara DESIGN.md (dokumen aktif) dan rencana lama di git history (`rail desktop 220 px`) tidak konsisten dengan implementasi 256px — rencana lama sudah dihapus, jadi ini lebih tepat "rencana vs implementasi", bukan kontradiksi dokumen aktif.

**Pelanggaran AGENTS.md:** AGENTS.md hanya berisi blok otomatis Next.js; tidak ada aturan repo spesifik yang bisa dilanggar secara terukur. Namun, di tingkat "semangat" HANDOVER lama (bukan bagian AGENTS.md aktif): komit "test sebelum merge" tidak terpenuhi karena tidak ada test.

---

## 7. Risiko & hutang teknis di luar daftar docs

1. **Mock-first di state produksi** — semua konteks diinisialisasi dari `MOCK_*`; bila Supabase gagal, UI diam-diam menampilkan data palsu sebagai data nyata. Ini desain, bukan bug satu titik, dan berisiko besar untuk sistem nyata.
2. **Role switcher localStorage** — siapa pun bisa menyetel `labmanage_user_id`/`labmanage_role` dan mendapat UI admin. Belum masalah keamanan data (RLS menahan), tapi semua keputusan UI tergantung state yang tidak otentik.
3. **Skema DB mendukung fitur yang tidak dipakai** — `reports` dan `loan_requests.status='selesai'` punya RLS tapi tidak ada jalur aplikasi; `durasi_menit` generated column tidak pernah dibaca.
4. **Ruangan bukan tabel** — `room_bookings.ruangan_id` adalah `TEXT` tanpa FK; identitas ruangan hanya konsisten via string UI.
5. **Duplicate Textarea** — `src/components/ui/input.tsx:32-45` dan `src/components/ui/textarea.tsx` identik (drift risk).
6. **Hardcode `password123`** untuk 7 akun seed di `scripts/seed-dummy.ts`, `scripts/test-rls.ts`, `scripts/test-inventory-admin.ts`. Kredensial Supabase sendiri env-based (bagus). Risiko rendah tapi nyata bila seed dipakai di Supabase produksi.
7. **Tidak ada CI** — `.github/workflows` hilang bersama commit `fb4e205`; lint error aktif (9 error) berarti pipeline apa pun akan merah.
8. **Ketergantungan lingkungan build** — build gagal OOM di mesin RAM ±1 GB. Perlu ditetapkan batas heap di `next.config` atau mesin build.
9. **`npx tsc --noEmit` lulus tapi eslint error** — gap antara typecheck dan lint menandakan rule `react-hooks/set-state-in-effect` baru yang belum diadopsi; perlu refaktor ke pola event/callback.

---

## 8. Yang tidak bisa saya pastikan

| Hal | Yang dibutuhkan untuk memastikan |
|---|---|
| Build `npm run build` default di mesin dengan RAM normal | Menjalankan build di mesin ≥4 GB RAM bebas, atau mengatur `NODE_OPTIONS` di `next.config` |
| Skrip `test-rls.ts` & `test-inventory-admin.ts` benar-benar lulus | Menjalankannya terhadap Supabase live dengan seed sudah dijalankan; audit tidak mengeksekusi script yang menulis ke DB remote |
| Perilaku Supabase nyata (RLS menolak dengan benar saat check-in mock `usr-*`) | Supabase live + akun auth nyata; perlu mengganti `user_id` ke `auth.uid()` |
| Kepatuhan AGENTS.md "baca guide Next sebelum menulis kode" | Riwayat penulisan kode; audit hanya bisa melihat hasil akhirnya |
| Visual screenshots README (`docs/assets/*.png`) sesuai kode | Perbandingan piksel manual yang tidak saya lakukan |
| `npm run lint:md`, `check:mermaid`, `check:links` | Belum dijalankan (bukan jalur perilaku aplikasi) |

---

## 9. Rekomendasi 5 langkah berikutnya

1. **Sambungkan alur persetujuan/penolakan & pengembalian pinjam ke Supabase**: tambahkan `update` ke `loan_requests` dan trigger/RPC untuk memulihkan `stok_tersedia` saat ditolak/dikembalikan; hapus fallback mock di `updateLoanRequestStatus`/`updateReportStatus`.
2. **Ganti data monitoring & akumulasi jam dengan kueri nyata**: agregasi `attendance_sessions` per minggu untuk widget & halaman monitoring; hapus `MOCK_TEAM_MONITORING` dari jalur produksi; baca `kelompok.target_jam_mingguan` sebagai sumber target.
3. **Perkuat guard peran di server**: tambahkan middleware Next.js atau server component check untuk `/monitoring` dan `/kotak-masuk`; hentikan penggunaan state `role` sebagai satu-satunya penentu aksi; sinkronkan `user_id` dengan `auth.uid()`.
4. **Tambah test otomatis minimal**: setup vitest, unit test untuk `status-badge`, `data-context` (jalur gagal Supabase), `room-booking-dialog` (anti-bentrok), dan 1–2 test RLS terhadap Supabase lokal; perbaiki 9 error eslint.
5. **Perbaiki aksesibilitas & dokumen usang**: skip link, `aria-expanded`, focus ring toggle nav, 44px touch target, prefers-reduced-motion; sinkronkan README (warna Emerald `#22c55e`, jumlah policy RLS) dengan kode; buat ulang `docs/HANDOVER` atau peta rencana aktif karena semua dokumen perencanaan lama sudah dihapus.

---

## 10. Cakupan audit

**File dibaca utuh / sebagian:**

- Dokumen: `AGENTS.md`, `DESIGN.md`, `docs/PRD.md`, `docs/USAGE.md`, `README.md` (utuh), `.env.example`, `.gitignore`, `package.json`.
- Dari git history (dokumen dihapus di `fb4e205`): `docs/HANDOVER.md` (utuh), `docs/superpowers/plans/2026-10-20-absensi-riset-backend.md` (utuh), `docs/superpowers/plans/2026-10-21-rekap-advisor-web.md` (utuh), `docs/superpowers/plans/2026-10-25-ui-overhaul.md` (utuh), `docs/ui-review/AUDIT-2026-10.md` (30 baris awal).
- Kode: `src/types/index.ts` (utuh), `src/app/page.tsx`, `src/app/layout.tsx` (parsial), `src/app/monitoring/page.tsx` (utuh 355 baris), `src/app/kotak-masuk/page.tsx` (utuh 295 baris), `src/app/jadwal/page.tsx` (utuh), `src/app/inventaris/page.tsx` (utuh 327 baris), `src/contexts/data-context.tsx` (utuh 420 baris), `src/contexts/role-context.tsx` (utuh 127 baris), `src/contexts/attendance-context.tsx` (utuh 126 baris), `src/components/overlays/room-booking-dialog.tsx`, `loan-request-sheet.tsx` (parsial), `review-request-sheet.tsx` (parsial), `add-item-dialog.tsx`, `add-stock-dialog.tsx` (via laporan subaudit), `src/components/common/status-badge.tsx` (utuh 121 baris), `src/components/widgets/attendance-widget.tsx` (utuh 190 baris), `src/lib/mock-data.ts` (parsial 32-123), `src/components/layout/*` (via laporan subaudit), `src/components/ui/*` (via laporan subaudit), `src/app/globals.css` (via laporan subaudit).
- SQL & skrip: `supabase/migrations/20261027_fase2_group_based_schema.sql` (utuh 497 baris), `20261027_fase3_admin_inventory_management.sql` (utuh 71 baris), `scripts/seed-dummy.ts` (parsial 1-83), `scripts/test-rls.ts` (utuh), `scripts/test-inventory-admin.ts` (via laporan subaudit).

**Perintah dijalankan:** `git log --oneline`, `git status`, `git branch -a`, `git show fb4e205^:<dokumen>`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (default: gagal OOM), `NODE_OPTIONS=--max-old-space-size=1536 npx next build` (lulus), `npx next start` + `curl` smoke test, `grep` untuk RLS policy count, `os.freemem()` untuk RAM.

**Yang dilewati:**

- Tidak menjalankan `scripts/test-rls.ts` / `test-inventory-admin.ts` (butuh Supabase live + akan menulis ke DB remote).
- Tidak menjalankan `npm run lint:md`, `check:mermaid`, `check:links`.
- Tidak membaca `node_modules/next/dist/docs/` (bukan bagian janji fitur; hanya relevan untuk menulis kode baru).
- Tidak melakukan verifikasi piksel/pembandingan screenshot README dengan UI aktual.
- Tidak membaca `LabManage_Presentation_Group8_v2.pptx` atau `render/` (aset presentasi, bukan kode).
- Tidak mengaudit dependensi keamanan (`npm audit` tidak dijalankan).

---

*Akhir laporan.*
