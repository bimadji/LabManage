# Paket 8B — Push branch & pantau CI: GAGAL (diblokir oleh GitHub)

Fase B dari `docs/TUGAS-PRODUKSI.md` saja. Fase A, C, D tidak disentuh; Supabase produksi & Vercel tidak disentuh.

## 1. Verifikasi lokal (semua hijau, bukan push merah)

Hasil asli, persis seperti keluar dari mesin:

```text
npx tsc --noEmit        → TSC_EXIT=0
npm run lint            → ✖ 16 problems (0 errors, 16 warnings)   LINT_EXIT=0
npm run test            → Test Files 9 passed (9) / Tests 54 passed (54)   TEST_EXIT=0
npm run lint:md         → 0 error   MD_EXIT=0
NODE_OPTIONS=--max-old-space-size=4096 npm run build
                        → ✓ Compiled successfully in 1922ms   BUILD_EXIT=0

DB uji lokal (untuk skrip yang butuh DB):
npx supabase start --exclude studio,analytics,vector,edge-runtime,imgproxy → exit 0
npx tsx scripts/seed-dummy.ts → 🎉 Seeding completed successfully!
npx tsx scripts/test-rls.ts            → 7/7 lulus
npx tsx scripts/test-role-matrix.ts    → 44/44 lulus
bash scripts/run-db-checks.sh          → exit 0, 15 skenario PASS
```

Tidak ada yang merah → prasyarat "jangan push dalam keadaan merah" terpenuhi.

## 2. Scan secret & kebersihan git

`git status` sebelum commit tugas: hanya 3 untracked (`LabManage_Presentation_Group8_v2.pptx`, `render/`, `docs/TUGAS-PRODUKSI.md`). `docs/TUGAS-PRODUKSI.md` di-commit supaya ikut ter-push; `pptx` & `render/` tidak disentuh.

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| File `.env*` ter-track | `git ls-files \| grep -E "\.env"` | hanya `.env.example` — aman |
| `.local.csv` ter-track | `git ls-files \| grep -i local.csv` | tidak ada |
| `sb_secret` | `git grep -n "sb_secret"` | 13 hit, semuanya **placeholder/instruksi** (`sb_secret_your_service_role_key` di README, `<SERVICE_ROLE_KEY dari supabase.env>` di SETUP-TES) + nama variabel env di kode — bukan nilai nyata |
| `eyJ` (JWT literal) | `git grep -nE "eyJ[A-Za-z0-9_-]{20,}"` | 0 hit nyata (satu hit di `package-lock.json` adalah sha512 integrity, bukan JWT) |
| `service_role` | `git grep -in "service_role"` | semuanya nama variabel `SUPABASE_*_SERVICE_ROLE_KEY` / komentar schema `service_role` — bukan kunci |
| `password` selain `password123` | `git grep -in password` + filter | semua hit adalah kode UI login, komentar, dan dokumentasi; **tidak ada password akun nyata**. `password123` hanya di `scripts/seed-dummy.ts` (akun seed DB uji) |

**Tidak ada secret nyata** → tidak perlu berhenti di langkah ini. History tidak disentuh.

## 3. Push: DITOLAK GitHub (2×), bukan karena konten

```text
$ git push -u origin stabilisasi
 ! [remote rejected] stabilisasi -> stabilisasi (refusing to allow an OAuth App
   to create or update workflow `.github/workflows/ci.yml` without `workflow` scope)
error: failed to push some refs to 'https://github.com/bimadji/LabManage.git'
PUSH_EXIT=1
```

- Tanpa `--force` ✓. Tidak ada merge ke `main` ✓. Remote tidak berubah: `stabilisasi` masih **tidak ada** di remote (dicek `gh api repos/bimadji/LabManage/branches`).
- **Akar masalah (bukan konflik/port/Docker):** branch ini **menambah** `.github/workflows/ci.yml` — file itu tidak ada di `origin/main` (`git ls-tree origin/main -- .github/workflows/ci.yml` kosong). GitHub menolak OAuth App yang membuat workflow tanpa scope `workflow`.
- Token aktif (dicek dua arah — `gh api -i user` dan token yang dipakai git credential manager): `X-OAuth-Scopes: gist, read:org, repo` — **tanpa `workflow`**.
- **Upaya yang dilakukan:** `gh auth refresh -s workflow` (device flow) 2× — tidak bisa diselesaikan karena butuh pemilik membuka `https://github.com/login/device` dan mengetik kode; flow timeout di mesin agen. Token tidak diubah.
- **Tidak dipaksa** (`--force` tidak digunakan; tidak ada bypass scope). Sesuai instruksi: berhenti dan laporkan.

## 4. CI: tidak bisa dipantau (push tidak terjadi)

Karena branch tidak pernah sampai GitHub, **tidak ada run** untuk `verify` atau `db`:

- `gh run list` tidak dijalankan lebih lanjut — tidak ada commit `stabilisasi` di GitHub.
- Status tiap job: `verify` = **TIDAK JALAN**, `db` = **TIDAK JALAN**. Link run: tidak ada.

Prediksi (bukan hasil, hanya bekas pengetahuan lokal): job `db` memakai port 54521/54522 dari `supabase/config.toml` yang dikomit — di runner kosong port itu bebas, jadi seharusnya tidak bentrok. Itu belum dibuktikan.

## 5. Perbaikan yang dibuat (tidak ada perubahan kode CI)

Tidak ada perbaikan CI — masalahnya **otentikasi**, bukan workflow. Yang berubah di commit ini:

- `docs/TUGAS-PRODUKSI.md` di-commit (file instruksi fase produksi, sebelumnya untracked).
- `docs/STATUS.md`: status CI diperbarui jujur → "push pertama ditolak, token tanpa scope `workflow`".
- Laporan ini.

Tidak melonggarkan test apa pun. Tidak menghapus/mengubah `ci.yml` (juga tidak membantu: menghapus workflow supaya bisa push malah menghapus CI).

## Cara melanjutkan (untuk pemilik, urut termudah)

1. **Jalur teraman:** pemilik jalankan `gh auth refresh -h github.com -s workflow`, buka `https://github.com/login/device`, ketik kode yang muncul. Lalu `git push -u origin stabilisasi` lagi. Satu langkah, tanpa mengubah repo.
2. **Alternatif:** buat PAT klasik (Settings → Developer settings → Personal access tokens → Tokens classic) dengan scope `repo` + `workflow`, lalu `git remote set-url origin https://bimadji:<PAT>@github.com/bimadji/LabManage.git` atau pakai `gh auth login --with-token`.
3. **Alternatif kedua:** push lewat SSH (`git remote set-url origin git@github.com:bimadji/LabManage.git`) — SSH key tidak kena batasan scope `workflow`.

Setelah push sukses, lanjutkan Fase B langkah 3–4: `gh run list --branch stabilisasi`, `gh run watch <id>`; kalau `db` merah karena port/Docker, periksa `supabase/config.toml` (port 54521/54522) dan `.github/workflows/ci.yml` dulu, maksimal 3 siklus.

## Butuh darimu

1. **Wajib:** token GitHub dengan scope `workflow` (atau SSH key) supaya push bisa berjalan. Tanpa itu Fase B tidak bisa lewat — push ditolak di server, bukan di lokal.
2. Konfirmasi: port `54521`/`54522` di `supabase/config.toml` dipakai CI juga. Kalau di runner GitHub ada stack lain di port itu (sangat tidak mungkin), job `db` akan gagal — perlu port lain.
3. `LabManage_Presentation_Group8_v2.pptx` dan `render/` masih untracked — dikomit atau di-gitignore?

File: `docs/STATUS.md`, `docs/TUGAS-PRODUKSI.md` (di-commit), `docs/laporan/PAKET-8B.md`. Commit: `a1371fc` (docs/TUGAS-PRODUKSI.md), `<hash berikutnya>` (laporan + STATUS).

Skipped: pantau CI (tidak ada run), perbaikan CI (bukan akar masalah), Fase A/C/D, dan semua sentuhan ke Supabase produksi / Vercel. Risiko: setelah scope `workflow` ada, CI job `db` di runner GitHub belum pernah dibuktikan (port 54521/54522 + Docker di runner) — bisa saja merah saat pertama jalan; kalau begitu itu pekerjaan Fase B lanjutan, maksimal 3 siklus.
