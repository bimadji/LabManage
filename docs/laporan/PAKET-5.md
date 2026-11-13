# Paket 5 — Bug kecil yang terlihat user: SELESAI

Dikerjakan:

- `src/components/common/status-badge.tsx`: dead code (blok `return` kedua yang tak terjangkau) dihapus; `dipinjam`, `ditangani`, `aktif` kini punya token ungu DESIGN.md §3 (`bg-purple-100 border-purple-200 text-purple-800`) beserta labelnya.
- `src/types/index.ts`: `ItemStatus` diselaraskan dengan enum DB `inventory_status` (`tersedia | rusak | habis`) — `dipinjam` dihapus dari tipe; `src/lib/mock-data.ts` item osiloskop diubah dari `dipinjam` → `habis`. Enum DB **tidak** diubah (sesuai keputusan default).
- `npm run lint` → **0 error** (sebelumnya 7-9 error):
  - `no-empty-object-type` (input.tsx 4:18 & 24:18, textarea.tsx 4:18) → `type` alias.
  - Duplikasi komponen `Textarea` di `ui/input.tsx` dihapus (hanya ada di `ui/textarea.tsx`).
  - `set-state-in-effect` di `attendance-context.tsx` → `isCheckedIn`/`checkInTime` diturunkan dari baris DB (open session), bukan state manual; effect restore dihapus.
  - `set-state-in-effect` di `data-context.tsx` → status muat/error dihitung dari `loadedForUserId`/`loadError.userId`, jadi tidak perlu `setState` sinkron di effect.
  - `set-state-in-effect` di `loan-request-sheet.tsx` → isi form dipisah ke komponen `LoanRequestBody` yang di-mount ulang tiap sheet dibuka; state awal selalu bersih tanpa effect.
  - `set-state-in-effect` di `home-banner.tsx` → sapaan dihitung dalam `setTimeout` (0 ms) agar tidak dihitung saat render server.
- `src/components/ui/button.tsx`: varian `link` `hover:underline` → `hover:text-emerald-700` (DESIGN.md §4.3 melarang underline). Ukuran `default` h-9→h-11, `sm` h-8→h-9→h-11, `icon` h-9→h-11 → target sentuh ≥44px. Tinggi eksplisit `h-7/h-8/h-9` pada `<Button>` dihapus supaya varian yang menentukan.
- `src/app/globals.css`: `.skip-link` (hanya terlihat saat difokus) + `@media (prefers-reduced-motion: reduce)` mematikan animasi/transisi.
- `src/components/layout/app-shell.tsx`: skip link `Lewati ke konten utama` → `#main-content`; `<main id="main-content">`; drawer mobile diberi `id="menu-navigasi-mobile"`.
- `src/components/layout/header.tsx`: toggle menu `aria-label="Buka menu navigasi"` (bukan "Toggle menu"), `aria-expanded` + `aria-controls`, focus ring `focus-visible:ring-2 focus-visible:ring-emerald-500`, target 44×44 px.
- Teks Inggris: "Off" → "Nonaktif" (sidebar). Scan `src/` untuk `aria-label`/`placeholder`/`title` berbahasa Inggris: tidak ada lagi yang tersisa.

Verifikasi asli (build + browser, DB uji lokal 127.0.0.1:54521, viewport 375 px):

- `npx tsc --noEmit` → exit 0.
- `npm run lint` → `✖ 13 problems (0 errors, 13 warnings)` — **0 error**. Sisa warning: import tak terpakai + `window.location.href` (2 lokasi) + `exhaustive-deps`. (Angka saat paket ini; terbaru 16 warning — lihat `docs/laporan/00-RINGKASAN.md`.)
- `NODE_OPTIONS=--max-old-space-size=2048 npx next build` → exit 0.
- Browser (Chromium 375×800, login anggota tim riset):
  - Kontrol di `<main>` yang lebih kecil dari 44 px: `[]` (kosong) — semua tombol/link ≥44 px.
  - `document.documentElement.scrollWidth <= window.innerWidth` → true (tidak ada scroll horizontal).
  - Skip link ada (`Lewati ke konten utama`), `#main-content` ada.
  - Toggle menu: `aria-label="Buka menu navigasi"`, `aria-expanded="false"`, `aria-controls="menu-navigasi-mobile"`.
  - `/inventaris`: item dari DB tampil, tidak ada teks "[object".

Belum beres:

- 13 warning lint tersisa saat paket ini ditutup (import tak terpakai di beberapa file, `window.location.href` di header & home-banner, `exhaustive-deps`). Bukan error; belum dirapikan. Angka terbaru: 16 warning.
- Target sentuh 44px baru dijamin untuk kontrol utama; beberapa kontrol sekunder (badge, avatar, select kecil) masih lebih kecil dari 44px.
- `hover:underline` pada elemen non-Tombol (mis. link `<a>` mentah) masih ada di beberapa widget; aturan `a { text-decoration: none }` di `globals.css` sudah menutupnya.

Butuh darimu:

1. Konfirmasi perubahan ukuran tombol (semua tombol utama jadi 44 px) — ini mengubah tampilan, bukan hanya bug. Kalau ingin tombol sekunder tetap 36 px, bilang saja.

File: `src/components/common/status-badge.tsx`, `src/types/index.ts`, `src/lib/mock-data.ts`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/app/globals.css`, `src/components/layout/app-shell.tsx`, `src/components/layout/header.tsx`, `src/contexts/attendance-context.tsx`, `src/contexts/data-context.tsx`, `src/components/overlays/loan-request-sheet.tsx`, `src/components/widgets/*`. Commit: `32ca3d3`.

Skipped: pengujian otomatis untuk badge/aksesibilitas (runner test belum ada — Paket 6). Risiko: perubahan tinggi tombol bisa memengaruhi tata letak di layar sempit; sudah dicek di 375 px tanpa overflow.
