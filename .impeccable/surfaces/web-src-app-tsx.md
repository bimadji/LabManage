---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: ["web/src/pages/SchedulePage.tsx","web/src/pages/InventoryPage.tsx","web/src/pages/MyRequestsPage.tsx","web/src/pages/InventoryInboxPage.tsx","web/src/pages/MonitorPage.tsx"]
---

## Scope

Shell dan seluruh route LabManage; mode Operate. Anggota, admin, dan advisor perlu menemukan tugas, membaca status, lalu bertindak tanpa menebak lokasi atau arti kontrol. Data, endpoint, payload, validasi, dan izin tetap menjadi kontrak Fase 1. Standar minimum: keyboard terlihat, target 44 px, kontras AA, reduced motion, status berbasis teks, dan tanpa overflow pada 375/768/1280 px.

## Direction contract

### THESIS

Satu agenda kerja menghubungkan waktu, entitas, dan status. Menolak susunan kartu dashboard generik serta header tinggi yang menunda pekerjaan.

### OWN-WORLD

Kertas sejuk, rail biru-petro, tinta gelap, garis aturan tipis, dan oranye kerja yang hemat. System sans dengan angka tabular; ledger, field, tombol, serta badge teks memakai ritme yang sama. Metadata konsisten dan seleksi tidak bergantung pada warna.

### STORY

Pengguna mengenali area aktif, memindai pekerjaan terdekat, memfilter tanpa kehilangan konteks, lalu menuju aksi yang memang tersedia untuk perannya. Kondisi kosong, gagal, dan berhasil tetap berbeda serta dapat dipulihkan.

### FIRST VIEWPORT

Desktop: rail navigasi 220 px, header tugas ringkas dengan aksi utama di kanan, filter satu baris, lalu ledger tanggal dan waktu sebagai pusat baca. Signature move: rail tanggal dan kolom waktu yang tetap sejajar saat isi atau status berubah. Mobile: header ringkas, navigasi disclosure berlabel, konten tugas lebih dahulu.

### FORM

Kandidat grounded 3 dari 7. Papan giliran menyumbang stabilitas kolom; katalog industrial menyumbang disiplin metadata; diagram transit menyumbang penanda seleksi tegas; katalog karakter menyumbang pola entitas berulang; monokrom produk menyumbang kedekatan penjelasan dan bukti. Hanya agenda yang memiliki halaman. seed: none (unavailable)

### FINISH

unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
