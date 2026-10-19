# HANDOVER LabManage

Dokumen serah terima untuk agent pembantu. Ditulis 2026-10-19 dari kondisi repo yang terverifikasi: `main` commit `66ca16b`, seluruh 25 PR sudah di-merge, tidak ada PR terbuka, `npm run lint` + `npm test` + `npm run build` lulus di `api/` (164 test) dan `web/` (32 test).

Baca dokumen ini sampai selesai sebelum mengerjakan apa pun. Ikuti aturan di bagian D dan E. Mulai bekerja dari Tugas 1 (bagian G), lalu Tugas 2, lalu Tugas 3.

## A. Peran helper

- Kamu adalah pembantu agent utama pada proyek LabManage.
- Kamu bekerja lewat branch dan PR. Kamu TIDAK PERNAH push ke `main`.
- Setelah tiap merge, laporkan hasilnya ke pemiliknya (manusia) sebagaimana diatur di bagian H, lalu lanjutkan pekerjaan berikutnya.
- Jangan mengerjakan hal yang sama dengan agent utama. Pembagian kepemilikan ada di bagian E; jika ragu siapa mengerjakan apa, berhenti dan ajukan satu pertanyaan (bagian H).
- Serah terima ini membuat Tugas 1, 2, dan 3 (bagian G) menjadi tugasmu. Agent utama sudah berhenti mengerjakan item-item itu; jika kamu melihat tanda ada pihak lain yang mengerjakannya (branch/PR mirip), berhenti dan lapor (bagian E).

## B. Konteks proyek

LabManage adalah sistem manajemen fasilitas, penjadwalan, dan monitoring lab Tim Robotik PENS/UKM. Produk berupa web responsif yang dipakai dari ponsel maupun komputer.

Tiga modul:

- **Modul A — Reservasi**: jadwal reservasi ruang dan alat, deteksi konflik, aturan jam operasional 07:00–21:00 WIB.
- **Modul B — Absensi**: check-in/check-out anggota, durasi kehadiran otomatis, dashboard monitoring realtime untuk admin/advisor, peringatan sesi melewati batas malam.
- **Modul C — Inventaris dan laporan**: katalog komponen habis pakai dan barang satuan, alur permintaan ambil/pinjam dengan persetujuan admin, riwayat perubahan, laporan kondisi fasilitas (backend; UI belum ada).

Tiga peran: **anggota**, **admin**, **advisor**. Definisi peran dan aturan akses ada di `docs/PRD.md` (persona dan user stories) serta kebijakan RLS di `supabase/migrations/` (lihat bagian C).

Success metrics ada di `docs/PRD.md` bagian 4 (M1–M4): pengurangan lembur malam tidak terstruktur minimal 35% dalam semester pertama; pengurangan konflik reservasi hingga 90%; advisor dan admin dapat melihat durasi kehadiran real-time; percepat respons perbaikan fasilitas lewat kanal laporan terpusat. Angka metrik tidak boleh diubah.

Rujukan dokumen:

- `docs/PRD.md` — PRD lengkap: ringkasan, persona, user stories, requirement fungsional/non-fungsional, arsitektur, ERD, roadmap implementasi (bagian 11). Sumber kebutuhan produk.
- `docs/USAGE.md` — cara setup, menjalankan, memakai aplikasi per peran, pemeriksaan kualitas, dan job notifikasi malam.
- `README.md` — ringkasan singkat repo.
- `DESIGN.md` (root) — arah desain visual: palet, tipografi, komponen, spasi, aksesibilitas. Acuan wajib untuk semua kerja UI (Tugas 3).
- `plan.md` — rencana tahap eksekusi. **File ini tidak ada di repo**; versi pemilik ada di catatan sesi lokalnya dengan dua nama: `labmanage-execution-plan.md` (tahap 0.1–1.12) dan `inventaris-komponen-barang-plan.md` (tahap 1.13–1.16). Jika pemilik memberikan file `plan.md`, rujuk; jika tidak, ikuti daftar tugas di dokumen ini dan roadmap di `docs/PRD.md` bagian 11.

## C. Tech stack, peta repo, dan cara kerja

### Stack final

- **Backend**: Node.js + Express + TypeScript di `api/` (Express 5, entry `api/src/server.ts`, `api/src/app.ts` mengekspor `createApp()`).
- **Frontend**: React + Vite + TypeScript di `web/`, mobile-first. Routing lewat `react-router` di `web/src/App.tsx`.
- **Database, Auth, Realtime**: Supabase lokal di Docker (PostgreSQL). RLS per peran aktif di setiap tabel.
- **Test**: Vitest di kedua proyek; API memakai Supertest; komponen UI memakai `@testing-library/react` + jsdom.
- **Lint/format**: ESLint flat config + `typescript-eslint`; Prettier lewat script `format:check`.
- **CI**: `.github/workflows/ci.yml`, dua job (`api`, `web`) di Ubuntu dengan Node 22. Job `api` menjalankan Supabase lokal sebelum test.

`engines` kedua proyek: Node `>=22 <23` (pakai Node 22 LTS). Catatan: mesin pemilik memakai Node 24 dan tetap jalan; jika ada masalah ganjil, cocokkan dulu ke Node 22.

### Peta repo

| Lokasi | Isi |
| --- | --- |
| `api/src/app.ts` | `createApp()`; mount semua router |
| `api/src/auth/requireAuth.ts` | `requireAuth` (401 tanpa token) dan `requireRole(...roles)` (403) |
| `api/src/reservations/` | reservasi, konflik, jam operasional (`hours.ts`) |
| `api/src/attendance/` | check-in/out, durasi (`duration.ts`), batas malam (`policy.ts`: `NIGHT_LIMIT_HOUR = 21`, `TZ = 'Asia/Jakarta'`) |
| `api/src/inventory/` | item inventaris (`routes.ts`), permintaan ambil/pinjam (`requests.ts`) |
| `api/src/reports/` | laporan kondisi fasilitas dan transisi status |
| `api/src/notifications/` | pembuat notifikasi (`create.ts`: `createNotification`, `notifyAdmins`) dan endpoint `GET /notifications`, `PATCH /notifications/:id/read` |
| `api/src/jobs/` | job peringatan malam (`overnight.ts`, dipanggil `POST /internal/jobs/overnight` dengan header `X-Job-Secret`) |
| `api/src/errors.ts` | format error global: `{"error":{"code":"...","message":"..."}}` |
| `api/src/validation.ts` | zod untuk semua body/query |
| `api/tests/` | semua test API, termasuk `rls/` untuk test penolakan RLS |
| `api/scripts/create-demo-users.ts` | seed tiga akun demo + aktivitasnya (`npm run db:seed-users`) |
| `web/src/App.tsx` | routing, guard peran, navigasi |
| `web/src/pages/` | tiap halaman + test tetangga (`*.test.tsx`) |
| `web/src/auth/` | `useSession.ts`, `useProfile.ts` (ambil peran dari `profiles`) |
| `web/src/lib/` | `api.ts` (fetch + Bearer token + `ApiRequestError`), `supabase.ts`, `datetime.ts`, `inventory.ts` |
| `web/src/monitor/applyAttendanceChange.ts` | reducer murni perubahan Realtime |
| `supabase/migrations/` | satu file per tahap, urut timestamp; **jangan pernah mengedit file yang sudah ada di main** |
| `supabase/seed.sql` | data non-user (ruang, inventaris, dst.); dijalankan lewat `npx supabase db reset` |
| `docs/` | `PRD.md`, `USAGE.md`, `HANDOVER.md` (dokumen ini) |
| `DESIGN.md` | arah desain visual |
| `scripts/` | `check-mermaid.mjs`, `check-links.mjs` untuk lint dokumen |

### Peran dan RLS

- Fungsi SQL `public.current_user_role()` dibuat di migrasi awal `supabase/migrations/20261019000100_profiles.sql`; hampir semua migrasi memakainya untuk policy.
- Policy per tabel ada di file migrasi masing-masing (lihat `enable row level security` dan `create policy` di `supabase/migrations/`).
- API menegakkan peran lagi lewat `requireAuth` + `requireRole` di `api/src/app.ts` dan tiap router — bukan hanya UI.
- Test penolakan RLS ada di `api/tests/rls/` dan diseleksi per peran di test lain (contoh: anggota tidak bisa membaca milik orang lain).

### Notifikasi dan Realtime

- Notifikasi (tahap 1.11): buat lewat `createNotification(config, {...})` di `api/src/notifications/create.ts`; `notifyAdmins(...)` menyebar ke semua admin. Tabel `public.notifications` punya `dedupe_key text unique` untuk cegah duplikat (pakai `on conflict (dedupe_key) do nothing`). Jenis kind saat ini: `reservasi`, `lembur`, `laporan`, `inventaris` (dibatasi check constraint di migrasi `20261019001000_inventory_notifications.sql`).
- Job peringatan malam: `POST /internal/jobs/overnight` dengan header `X-Job-Secret` berisi nilai env `JOB_SECRET`; salah/hilang → 401. Rincian di `docs/USAGE.md` bagian 6.
- Realtime: `web/src/pages/MonitorPage.tsx` berlangganan `postgres_changes` pada tabel `attendance` (INSERT/UPDATE/DELETE) lalu memakai reducer `web/src/monitor/applyAttendanceChange.ts`. Tabel dipublikasikan ke publication `supabase_realtime` di migrasi attendance.

### Konvensi kode

- Bahasa Indonesia untuk teks UI, pesan error, komentar penjelas, dan dokumen; identifier kode dalam bahasa Inggris.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Test komponen UI disamping komponennya di `web/src/`; test API di `api/tests/`.
- Error API selalu `{"error":{"code":"...","message":"..."}}` dengan kode berbahasa Inggris (`CONFLICT`, `INSUFFICIENT_STOCK`, ...) dan pesan berbahasa Indonesia.
- Jangan tambah dependensi baru tanpa alasan kuat; sebut alasannya di PR.
- Frontend mobile-first: lebar uji wajib 375px, 768px, 1280px.

### Perintah: install, jalankan, build, test

Perintah di bawah berlaku lintas-platform di shell standar (bash/GitBash/PowerShell/cmd). Catatan OS: di PowerShell lama, `curl` adalah alias — pakai `curl.exe`; gunakan `npm run <script> --prefix <folder>` daripada `cd` bila ingin tetap di folder yang sama.

```bash
# Install (sekali per clone)
npm ci                    # tooling dokumen + Supabase CLI (root)
npm ci --prefix api
npm ci --prefix web

# Supabase lokal (butuh Docker Desktop berjalan)
npm run db:start          # = supabase start
npx supabase status -o env   # nilai lokal untuk file .env di bawah

# Siapkan file env: salin tiap .env.example ke nama tanpa .example
# (bash: cp api/.env.example api/.env ; cmd/PowerShell: copy api\.env.example api\.env),
# lalu isi nilai dari `npx supabase status -o env`. Perhatikan RENAME:
#   API_URL          -> SUPABASE_URL               (api dan web)
#   ANON_KEY         -> SUPABASE_ANON_KEY          (api dan web)
#   SERVICE_ROLE_KEY -> SUPABASE_SERVICE_ROLE_KEY  (hanya api)
# Sisanya (PORT, WEB_ORIGIN, JOB_SECRET, VITE_API_URL) sudah terisi di .env.example.

npx supabase db reset     # terapkan migrasi + seed.sql
npm run db:seed-users --prefix api   # buat/reset akun demo (aman diulang)
npm run db:stop           # hentikan bila perlu

# Menjalankan aplikasi
npm run dev --prefix api  # http://localhost:4000 (cek: GET /health)
npm run dev --prefix web  # http://localhost:5173

# Build, lint, test (jalankan di folder yang tersentuh perubahanannya)
npm run lint --prefix api && npm test --prefix api && npm run build --prefix api
npm run lint --prefix web && npm test --prefix web && npm run build --prefix web

# Periksa dokumen (root)
npm run lint:md
npm run check:links
npm run check:mermaid     # sekali per clone: npm run setup:mermaid-browser
```

Pastikan `npm test --prefix api` dijalankan setelah `npm run db:start` + `npx supabase db reset` + `npm run db:seed-users --prefix api`, karena test API memakai database lokal.

### Variabel env (nama saja)

Semua file `.env*` diabaikan git. Isi nilainya dari `npx supabase status -o env` dan `api/.env.example` (lihat `docs/USAGE.md` bagian 1). Jangan pernah menulis nilai rahasia ke repo.

| File | Variabel |
| --- | --- |
| `api/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `WEB_ORIGIN`, `JOB_SECRET` |
| `api/.env.test` | sama seperti `api/.env`; `SUPABASE_URL` wajib host lokal (`127.0.0.1`/`localhost`) |
| `web/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

Aturan kunci: `SUPABASE_SERVICE_ROLE_KEY` hanya dibaca di `api/src/config.ts`, tidak boleh ada di `web/`. Frontend hanya memakai anon key.

## D. Alur kerja wajib

Berlaku untuk setiap tahap kecilmu:

1. `git checkout main` lalu `git pull --ff-only`. Pastikan `git status` bersih.
2. Buat branch `helper-<nomor>-<deskripsi-singkat>`, contoh: `helper-1-tombol-checkin-web`. Nomor urut kecil, huruf kecil, tanda hubung.
3. Kerjakan SATU tahap kecil saja. Perubahan lain dicatat sebagai catatan di PR, jangan dikerjakan.
4. Jalankan build + lint + test lokal sampai lulus (perintah di bagian C). Jangan lewati, nonaktifkan, atau hapus test.
5. Commit dengan Conventional Commits, lalu `git push -u origin <branch>`.
6. Buka PR ke `main` (tools bebas: `gh pr create` bila GitHub CLI tersedia, atau GitHub REST API) dengan body berisi: tujuan, daftar perubahan, cara menguji, dan hasil test (tempel output ringkas).
7. Merge **squash** HANYA jika semua pemeriksaan hijau. Setelah merge: `git checkout main` lalu `git pull --ff-only`.
8. Branch TIDAK dihapus setelah merge (kebijakan repo).
9. Gagal lulus 3 kali pada tahap yang sama → BERHENTI, lapor ke pemilik dengan log error dan apa yang sudah dicoba.

Dilarang keras:

- Push langsung ke `main`.
- `git push --force`, `--no-verify`, atau menonaktifkan test.
- Secret/key/password di repo. Semua nilai rahasia hanya lewat env.
- Memakai Supabase produksi. Pakai Supabase lokal di Docker, atau project testing terpisah milikmu sendiri.
- Mengedit migrasi yang sudah ada di `main`. Skema baru selalu lewat `npx supabase migration new <nama>` lalu commit file hasilnya.
- Mengubah logika bisnis di luar lingkup tugas (terutama Tugas 3).

Frontend: mobile-first. Setiap PR yang menyentuh tampilan wajib diuji pada lebar 375px, 768px, dan 1280px tanpa elemen terpotong dan tanpa scroll horizontal (`document.documentElement.scrollWidth <= window.innerWidth` harus `true` di konsol).

Setiap tabel baru wajib RLS aktif, disertai test yang membuktikan peran yang tidak berhak ditolak. `service_role` hanya di backend; frontend hanya anon key.

## E. Aturan koordinasi dengan agent utama

Pembagian kepemilikan pekerjaan:

| Pekerjaan | Pemilik |
| --- | --- |
| Tugas 1, 2A–2D, dan 3 di bagian G | Helper |
| Review keputusan produk, keputusan desain, dan pertanyaan lintas tugas | Agent utama (via pemilik) |
| Perubahan di luar daftar Tugas 1–3 yang belum disetujui siapa pun | TIDAK BOLEH dikerjakan; tanyakan dulu |

Aturan sebelum buka PR dan sebelum merge:

1. Ambil main terbaru: `git fetch origin` lalu `git merge origin/main` ke branch-mu (merge, **bukan rebase**).
2. Jalankan ulang test lokal. Jika perubahan menyentuh skema/data, jalankan juga `npx supabase db reset` (dan `npm run db:seed-users --prefix api` bila butuh akun demo) lalu test ulang.
3. Baru push, perbarui PR, dan merge bila hijau.

Jika konflik muncul di file yang DI LUAR lingkup tugasmu, BERHENTI dan lapor — jangan menyelesaikan konflik yang bukan urusanmu. Konflik di dalam lingkup tugasmu boleh diselesaikan sendiri.

Jika ada tanda bahwa agent utama sedang mengerjakan hal yang sama denganmu (branch/PR mirip), berhenti dan lapor sebelum melanjutkan.

## F. Prasyarat bagi pemilik agent

Sebelum helper mulai, pemilik harus punya:

- Akses write ke repo GitHub `bimadji/LabManage`.
- Autentikasi GitHub untuk membuka PR dan merge: `gh auth login` (GitHub CLI), atau token dengan scope `repo` yang bisa dipakai lewat API/`git`.
- Node.js 22 LTS + npm.
- Docker Desktop terpasang dan berjalan (untuk Supabase lokal).
- Git.

## G. Urutan tugas

Kerjakan berurutan: **Tugas 1 → Tugas 2 → Tugas 3**. Tugas 3 disengaja paling akhir agar halaman baru dari Tugas 2 ikut dipoles sekaligus.

Sebelum mengerjakan setiap baris Tugas 1, VERIFIKASI sendiri di repo (bukti bisa berubah setelah serah terima ini). Satu baris = minimal satu tahap/PR kecuali disebut lain.

### Tugas 1: lanjutkan pekerjaan yang belum selesai

| Item | Bukti (verifikasi ulang) | Prioritas | Kriteria selesai | Pemilik |
| --- | --- | --- | --- | --- |
| UI laporan kondisi fasilitas belum ada | Backend ada: `api/src/reports/routes.ts`, `api/src/reports/transitions.ts`, migrasi `20261019000700_facility_reports.sql`. `grep -r "facility" web/src` tidak ada hasil. Kebutuhan: FR-C.6–FR-C.9 di `docs/PRD.md` | Tinggi | Halaman web: anggota membuat laporan (kategori lampu/ventilasi/kerusakan), admin mengubah status sesuai alur, advisor melihat semua tanpa aksi tulis; test API+UI lulus; 375/768/1280 tanpa overflow | Helper |
| Check-in/check-out belum ada UI untuk anggota | `docs/USAGE.md` bagian 3: "lewat API POST /attendance/check-in" — UI web tidak memanggil endpoint itu; `grep -r "check-in" web/src` tidak ada hasil. Backend tahap 1.6–1.8 sudah lengkap (`api/src/attendance/`) | Tinggi | Anggota bisa check-in/check-out dari web, melihat sesi dan durasinya; test UI lulus; tidak mengubah aturan satu-sesi | Helper |
| Notifikasi belum ada UI (daftar notifikasi anggota) | API `GET /notifications` + `PATCH /notifications/:id/read` ada (`api/src/notifications/routes.ts`); `grep -r "notification" web/src` tidak ada hasil. AC-B7 di PRD menyebut "daftar notifikasi" | Sedang | Anggota bisa membaca daftar notifikasinya dan menandai sudah dibaca; test lulus | Helper |
| Perbaikan UI/UX tersisa dari `UI-REVIEW.md` | `UI-REVIEW.md` di root repo (file lokal, di-`.git/info/exclude`, jangan di-commit). Item 1 sudah beres (PR #24); item 2 (validasi visual per halaman) dan item 5 (kontras akurat manual) belum | Sedang | Validasi visual tiap halaman pada 375 dan 1280px; kontras badge/teks muted dicek; temuan diperbaiki per halaman/kelompok lewat PR (detail di Tugas 3) | Helper |
| Rekap absensi, target mingguan, dan peringatan belum ada | `grep -r "rekap" web/src` tidak ada hasil; API rekap/target/peringatan tidak ada. Modul B hanya punya check-in/out, durasi, dan monitoring (tahap 1.6–1.8) | Tinggi | Dikerjakan sebagai Tugas 2 (lihat di bawah) | Helper |
| `plan.md` tidak ada di repo | Glob `plan.md` di repo = 0 hasil; ada di catatan sesi pemilik dengan dua nama (lihat bagian B) | Rendah | Pemilik memutuskan: taruh salinan di repo atau cukup `docs/PRD.md` bagian 11; keputusan dicatat | Pemilik |
| Validasi visual review UI oleh manusia | Screenshot `.tmp/ui-review/` sudah ada (folder lokal, gitignored) tetapi belum dinilai mata manusia | Sedang | Pemilik/helper melihat screenshot dan menyetujui hasil akhir | Helper |

Tidak bisa diverifikasi dari repo (jangan menebak): apakah ada kebutuhan produk di luar PRD yang belum tercatat; apakah angka success metrics M1/M2 perlu alat ukur tambahan.

### Tugas 2: absensi riset lab (check-in/check-out), rekap, dan peringatan

Modul B sudah punya check-in/check-out dasar (tahap 1.6–1.8). **Periksa dulu apa yang sudah ada, bangun di atasnya, jangan membuat duplikat.** Yang sudah ada:

- API: `POST /attendance/check-in` (409 `ALREADY_IN` untuk sesi ganda), `POST /attendance/check-out` (404 `NOT_IN`), `GET /attendance/present` (daftar sesi terbuka + `overNightLimit`).
- Fungsi durasi: `api/src/attendance/duration.ts` (`durationMinutes`, unit-test tanpa DB). Batas malam: `api/src/attendance/policy.ts` (`NIGHT_LIMIT_HOUR = 21`, `TZ = 'Asia/Jakarta'`).
- Migrasi `supabase/migrations/20261019000400_attendance.sql`: unique partial index satu sesi terbuka per user.
- UI monitoring admin/advisor: `web/src/pages/MonitorPage.tsx` + reducer `web/src/monitor/applyAttendanceChange.ts` (Realtime).
- Mekanisme notifikasi: `api/src/notifications/create.ts` + job `api/src/jobs/overnight.ts` dengan header `X-Job-Secret` (pola ini dipakai ulang untuk peringatan baru).
- Anggota check-in via API, UI-nya belum ada (lihat Tugas 1).

Kebutuhan yang harus dipenuhi tanpa dikurangi:

- **Anggota**: check-in saat mulai riset di lab, check-out saat selesai; durasi dihitung otomatis; hanya satu sesi aktif per anggota. Anggota melihat rekap dan peringatan miliknya sendiri.
- **Rekap per anggota per periode**: default mingguan (Senin–Minggu zona `Asia/Jakarta`), tersedia juga bulanan. Isi: total jam riset, jumlah sesi, kehadiran per hari, dibandingkan dengan target.
- **Target jam riset minimum per minggu**, diatur admin (default satu target global, contoh 10 jam/minggu di seed). Anggota yang total jamnya di bawah target ditandai **KURANG**; tepat di target **tidak** KURANG.
- **Advisor** memantau absensi dan rekap semua anggota. Untuk anggota KURANG, advisor dapat menekan **"Kirim peringatan"** (catatan opsional). Peringatan lewat mekanisme notifikasi yang sudah ada dan dicatat (siapa, kapan, ke siapa, isi). Default: maksimal satu peringatan per anggota per hari. Advisor tidak bisa mengedit data absensi.
- **Admin** memantau absensi dan melihat statistik: total jam per anggota, rata-rata per minggu, tingkat kehadiran, jumlah anggota di bawah target, tren mingguan, dan porsi sesi yang melewati batas jam malam jika data tersedia. Admin mengatur target dan dapat mengoreksi sesi yang lupa check-out (tercatat di riwayat).
- **Hak akses ditegakkan lewat RLS dan middleware API**, bukan hanya di UI.

Test wajib:

- Perhitungan durasi.
- Check-in ganda ditolak.
- Sesi lintas tengah malam.
- Batas periode rekap.
- Status KURANG tepat di batas target (boundary: di bawah = KURANG, tepat = tidak KURANG).
- RLS: anggota tak bisa melihat milik orang lain; advisor tak bisa edit data absensi; anggota tak bisa mengirim peringatan.
- Peringatan terkirim dan tercatat (termasuk pembatasan satu per hari).

Tahap (satu PR per tahap, urutan wajib):

- **2A — backend**: migrasi target dan tabel log peringatan (pakai `npx supabase migration new`), endpoint rekap per periode, statistik admin, kirim peringatan, atur target, koreksi sesi lupa check-out; semua test di atas lulus.
- **2B — UI anggota**: check-in/check-out, sesi berjalan, rekap milik sendiri, peringatan milik sendiri.
- **2C — UI advisor**: pantau absensi dan rekap semua anggota, tombol "Kirim peringatan" untuk KURANG.
- **2D — UI admin**: statistik, atur target, koreksi sesi.

Tambahan wajib: data demo untuk absensi/target/peringatan ditambahkan ke `supabase/seed.sql` (dan `api/scripts/create-demo-users.ts` bila butuh `profiles`), serta dokumentasi `docs/USAGE.md` diperbarui.

### Tugas 3: perbaikan UI yang masih polos

Dikerjakan **setelah Tugas 2 selesai** agar halaman baru ikut dipoles.

- **Acuan desain**: `DESIGN.md` di root sudah ada — jadikan acuan; jika arahnya ternyata tidak cocok, usulkan perubahan dulu sebelum menerapkan, lalu perbarui `DESIGN.md` dalam PR yang sama. Satu arah desain dipertahankan di semua PR.
- **Referensi**: cari komponen di **21st.dev**, pilih yang cocok untuk tiap halaman, dan catat pilihan serta alasannya di `DESIGN.md`. Adaptasi ke stack kita (React + Vite), jangan salin mentah. Periksa lisensi dan dependensi tiap komponen; hindari menambah dependensi besar tanpa alasan; catat sumbernya.
- **Batasan**: tidak mengubah logika bisnis. Perhatikan kontras, badge yang punya teks selain warna, fokus keyboard, state loading/kosong/error, dan target sentuh nyaman di HP (minimal 44px pada target utama).
- **Alur**: satu tahap = satu PR kecil per halaman atau kelompok halaman. Sertakan screenshot sebelum dan sesudah (375px dan 1280px) di deskripsi PR. Gunakan hasil audit di `UI-REVIEW.md` sebagai daftar masalah awal (file itu lokal dan tidak di-commit; salin isinya ke PR bila perlu).

## H. Pelaporan

- Setelah tiap merge, laporkan: tahap yang selesai, link PR, hasil test, dan tahap berikutnya. Setelah laporan, lanjutkan otomatis ke tahap berikutnya tanpa menunggu instruksi baru, selama tidak ada hal yang butuh keputusan.
- Jika menemui ambiguitas (kebutuhan tidak jelas, keputusan produk, konflik di luar lingkup): ajukan SATU pertanyaan singkat kepada pemilik lengkap dengan usulan jawaban default. Jika tidak dijawab, kerjakan dengan usulan default itu dan catatkan bahwa default dipakai.
- Jika gagal 3 kali pada tahap yang sama, berhenti dan lapor (bagian D).

## I. Skill opsional dan prinsipnya

Jika lingkunganmu menyediakan skill/agent-tools setara, gunakan: `test-driven-development`, `verification-before-completion`, `systematic-debugging`, dan `ui-ux-pro-max` (atau padanannya). Jika tidak ada, prinsipnya eksplisit sebagai berikut:

1. **Test dulu**: tulis test yang menggambarkan perilaku yang diinginkan sebelum menulis kode implementasinya. Jangan menulis kode yang tidak punya test, kecuali perubahan dokumentasi/tampilan trivial di mana test tidak menambah nilai.
2. **Jangan klaim selesai tanpa bukti**: sebelum melaporkan selesai, jalankan build, lint, dan test yang sebenarnya, tempel hasilnya. "Sepertinya lulus" bukan bukti.
3. **Cari akar masalah**: saat test gagal, reproduksi dulu, pahami penyebabnya dari log, perbaiki penyebabnya — bukan menyesuaikan test agar lulus, bukan menambah try/catch yang menelan error.
4. **UI**: konsisten dengan `DESIGN.md`; kontras teks minimal 4.5:1; badge dan status punya label teks, bukan hanya warna; semua state (loading, kosong, error, sukses) ada dan pesan error memakai `role="alert"`; target sentuh nyaman di HP; uji 375/768/1280px tanpa scroll horizontal.
