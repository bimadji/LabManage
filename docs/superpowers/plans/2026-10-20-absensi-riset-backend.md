# Rencana implementasi backend absensi riset (Tugas 2A)

> Untuk pelaksana: gunakan `superpowers:executing-plans` per tahap; dua unit mandiri (perhitungan murni dan migrasi) dapat dikerjakan paralel pada file terpisah.

**Tujuan:** backend rekap mingguan/bulanan, target, statistik admin, peringatan advisor, dan koreksi sesi dengan audit.

**Arsitektur:** router tambahan memakai JWT dan RLS yang sudah ada. Perhitungan rekap murni di TypeScript; peringatan dan koreksi memakai transaksi RPC PostgreSQL agar log dan perubahan tidak terpisah. UI dikerjakan pada 2B–2D.

**Stack:** Node 22, Express, TypeScript, Supabase/PostgreSQL, Vitest.

**Spesifikasi:** `docs/HANDOVER.md` bagian G Tugas 2; definisi periode berikut disetujui pengguna pada 20 Oktober 2026.

## Batasan

- Satu PR Tugas 2A, branch `helper-4-absensi-riset-backend`; squash menunggu persetujuan baru.
- Tidak reset database, menghapus volume, mengedit migrasi lama, atau push main.
- Migrasi baru dibuat lewat CLI; terapkan migrasi lokal yang belum diterapkan saja.
- Tidak menambah dependensi; error dan dokumentasi bahasa Indonesia.
- Semua tabel baru RLS aktif. Pengguna tidak boleh menulis log/peringatan langsung.

## Definisi dan kontrak

- Minggu Senin–Minggu WIB; interval `[start, end)` dan bulan kalender WIB.
- `date=YYYY-MM-DD` memilih periode yang mengandung tanggal tersebut; default tanggal WIB saat ini. `period=week|month`, default `week`.
- Potong sesi pada batas periode, hari, dan waktu sekarang. Hitung menit pecahan dari milidetik; tidak membulatkan sebelum membandingkan target.
- Target mingguan global integer menit, default 600 (10 jam), rentang 0–10080. Target bulanan = target mingguan × hari kalender bulan / 7.
- `KURANG` hanya jika total menit < target; tepat di target = `TERCAPAI`.
- Hari hadir adalah hari dengan durasi positif. Tingkat kehadiran = hari hadir / hari kalender yang sudah berlalu dalam periode (termasuk hari berjalan), 0 jika belum dimulai.
- Rata-rata jam mingguan = total jam / (jumlah hari periode / 7). Roster adalah anggota yang ada saat query; bukan rekonstruksi keanggotaan historis.
- Sesi melewati malam jika bagian sesi dalam periode beririsan waktu setelah 21:00 WIB, termasuk sesi lintas tengah malam. Rasio = jumlah sesi tersebut / jumlah sesi, 0 jika kosong.
- Peringatan hanya advisor ke anggota yang KURANG minggu berjalan. Maksimal satu per anggota per tanggal WIB, lintas advisor dan permintaan bersamaan.
- Koreksi admin hanya untuk sesi yang masih terbuka, dengan waktu selesai > waktu mulai dan <= sekarang, alasan 5–1000 karakter; log siapa/kapan/nilai sebelum-sesudah dalam transaksi yang sama.
- Target berlaku saat query, termasuk rekap historis; perubahan target tidak merekonstruksi target lama.

## Fokus review

- Batas tengah malam/minggu/bulan dan tahun kabisat: unit test tanggal eksplisit.
- Sesi terbuka/panjang/mulai atau selesai tepat batas: unit test clipping, target, dan rasio malam.
- Peringatan bersamaan atau gagal notifikasi: constraint/transaction, test API dan RPC/RLS.
- Pemanggilan langsung Supabase yang melewati middleware: test peran dan pembatasan grant.
- Data >1000 baris: pembacaan berhalaman dengan urutan stabil, test rekap data besar.

## 1. Perhitungan murni

File `api/src/attendance/summary.ts`, test `api/tests/attendance-summary.test.ts`.

- [x] Tulis dan jalankan test RED untuk periode WIB, minggu lintas tahun, Februari kabisat, tanggal invalid.
- [x] Ekspor `getPeriod(kind: 'week'|'month', date?: string, now?: Date): AttendancePeriod`.
- [x] `AttendancePeriod`: `{ kind, start: string, end: string, days: string[] }` (start/end ISO UTC, days YYYY-MM-DD WIB).
- [x] Ekspor `summarizeAttendance(sessions: SummarySession[], period: AttendancePeriod, weeklyTargetMinutes: number, now?: Date): AttendanceSummary`.
- [x] `SummarySession`: `{ id, checkedInAt: string, checkedOutAt: string|null }`.
- [x] `AttendanceSummary`: `{ totalMinutes,totalHours,sessionCount,targetMinutes,status,days:{date,minutes,sessionCount}[],daysPresent,elapsedDays,attendanceRate,averageWeeklyHours,overNightSessionCount,overNightSessionRatio }`.
- [x] Test RED→GREEN: sesi lintas hari/periode, sesi aktif, batas target di bawah/tepat, sesi future diabaikan, denominator hari dan rasio malam.

## 2. Migrasi dan RLS

File migrasi baru `*_research_attendance.sql`, test `api/tests/research-rls.test.ts`.

- [x] Tulis test untuk tabel/grant/RPC sebelum migrasi; verifikasi belum tersedia.
- [x] `attendance_settings`: singleton `id=true`, `weekly_target_minutes`, `updated_by`, `updated_at`. Semua peran baca; hanya admin update; tidak insert/delete klien.
- [x] `attendance_warnings`: `id,user_id,advisor_id,week_start,warning_date,note,message,total_minutes,target_minutes,notification_id,created_at`. Unique(user_id,warning_date). Baca milik sendiri/admin/advisor, tidak tulis klien.
- [x] `attendance_corrections`: `id,attendance_id,user_id,actor_id,old_checked_out_at,checked_out_at,reason,created_at`. Baca milik sendiri/admin/advisor, tidak tulis klien.
- [x] RPC `send_attendance_warning(p_user_id uuid,p_note text default '')` mengembalikan row JSON snake_case. Periksa role, anggota, total menit minggu sekarang, unique hari WIB; tulis notifikasi kind `kehadiran` dan log atomik.
- [x] RPC `correct_attendance_session(p_attendance_id uuid,p_checked_out_at timestamptz,p_reason text)` mengembalikan row audit JSON snake_case, kunci sesi dan tutup dengan audit atomik.
- [x] RPC `SECURITY DEFINER`, search_path kosong, auth/role wajib; execute hanya authenticated. Error P0001 message: `FORBIDDEN`, `MEMBER_NOT_FOUND`, `TARGET_MET`, `WARNING_ALREADY_SENT`, `SESSION_NOT_FOUND`, `SESSION_NOT_OPEN`, `INVALID_CHECKOUT`, `VALIDATION_ERROR`.
- [x] Ganti policy update attendance lewat migrasi baru: anggota/admin hanya menutup sesi sendiri yang masih terbuka. Hapus jalur update admin semua tanpa audit; koreksi lewat RPC. Advisor tidak dapat update, termasuk sesi miliknya.
- [x] Perluas constraint notification kind dengan `kehadiran`; pertahankan jenis lama. Seed singleton600 dalam migrasi dan seed.sql memakai on conflict do nothing.
- [x] Terapkan migrasi baru tanpa reset; jalankan test RLS/RPC. Root mengoordinasikan semua test DB agar tidak bersamaan.

## 3. Endpoint dan integrasi

File `api/src/attendance/research.ts`, `api/src/app.ts`, `api/tests/attendance-research.test.ts`.

- [x] Test RED untuk rute baru lalu implementasi dengan middleware/validasi zod.
- [x] GET `/attendance/target` semua peran; PUT admin body `{weeklyTargetMinutes}`.
- [x] GET `/attendance/summary?period=&date=&userId=`: anggota hanya sendiri; admin/advisor seluruh anggota atau satu anggota. Respons `{period,weeklyTargetMinutes,targetMinutes,members:[{userId,fullName,...AttendanceSummary}]}`.
- [x] GET `/attendance/statistics?period=&date=&weeks=` khusus admin; `weeks` integer1–52 default8. Respons ringkasan per anggota, aggregate, dan tren minggu yang berakhir di minggu tanggal terpilih.
- [x] POST `/attendance/warnings` advisor body `{userId,note?}`; GET `/attendance/warnings?userId=` milik sendiri atau admin/advisor semua.
- [x] PATCH `/attendance/:id/correct-check-out` admin body `{checkedOutAt,reason}`; GET `/attendance/corrections?userId=` sesuai RLS.
- [x] Status error: role403, notfound404, konflik/target tercapai409, input400. Jalur mutasi memakai userClient RPC, bukan service role.
- [x] Semua query daftar terpaginasikan, urutan stabil, tidak terpotong batas1000 PostgREST.
- [x] Test hasil rekap/statistik, filter pemilik, target, peringatan+notifikasi+log, limit harian/race, koreksi+audit, validasi, seluruh peran dan dataset besar.

## 4. Seed, dokumentasi, dan verifikasi

File `supabase/seed.sql`, `api/scripts/create-demo-users.ts`, `api/src/notifications/create.ts`, `docs/USAGE.md`.

- [x] Seed target600 dan aktivitas demo absensi/peringatan yang konsisten. Seed akun tetap lokal; hapus hanya fixture demo yang memang dikelola script, urutan FK diperhatikan. Jangan jalankan ulang seed pada data lokal pengguna untuk verifikasi; uji fixture terpisah.
- [x] Tambahkan kind `kehadiran` ke type backend, dokumentasikan rumus dan kontrak endpoint.
- [ ] Verifikasi migrasi dari urutan kosong secara non-destruktif pada database uji sementara bila tersedia; jangan reset database Supabase pengguna.
- [x] Lint/test/build API, test web regresi, lint/link/Mermaid dokumen. Review independen seluruh diff.
- [ ] Fetch+merge main dan test lokal selesai; lanjut commit Conventional Commit, push helper saja, buka PR, cek CI. Tunggu persetujuan merge.
