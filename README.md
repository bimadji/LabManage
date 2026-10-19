# LabManage

LabManage adalah sistem manajemen fasilitas, penjadwalan, dan monitoring lab Tim Robotik PENS/UKM. Spesifikasi lengkap ada di [docs/PRD.md](docs/PRD.md).

## Struktur repo

- `api/`: API Node.js 22, Express 5, TypeScript.
- `web/`: web React, Vite, TypeScript (mobile-first).
- `supabase/`: konfigurasi Supabase lokal, migrasi (`migrations/`), dan `seed.sql`.
- `docs/`: PRD dan dokumentasi.

## Prasyarat

- Node.js 22 LTS dan npm.
- Docker Desktop dalam keadaan berjalan (dibutuhkan Supabase lokal).
- Supabase CLI sudah ikut sebagai devDependency di root, dipanggil lewat `npx supabase`.

## Setup

```bash
npm ci                 # root: tooling dokumen dan Supabase CLI
npm ci --prefix api
npm ci --prefix web
npm run db:start       # menjalankan Supabase lokal di Docker
npx supabase status -o env
```

Salin nilai dari `supabase status` ke file env berikut (semua file ini diabaikan git):

| File | Variabel |
| --- | --- |
| `api/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT` (default 4000) |
| `api/.env.test` | sama dengan `api/.env`; `SUPABASE_URL` wajib `127.0.0.1` atau `localhost` |
| `web/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (hanya anon key) |

Contoh lengkap ada di `.env.example`, `api/.env.example`, dan `web/.env.example`.

## Menjalankan

```bash
npm run dev --prefix api   # http://localhost:4000/health
npm run dev --prefix web
npm run db:stop            # menghentikan Supabase lokal
```

## Test dan pemeriksaan

```bash
# API
cd api && npm run lint && npm test && npm run build

# Web
cd web && npm run lint && npm test && npm run build

# Dokumen (dari root)
npm run lint:md && npm run check:mermaid && npm run check:links
```

CI di GitHub Actions menjalankan lint, test, dan build untuk `api/` dan `web/` pada setiap pull request.
