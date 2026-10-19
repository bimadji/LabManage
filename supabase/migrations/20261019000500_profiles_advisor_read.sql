-- Tahap 1.6: advisor juga perlu membaca nama anggota untuk dashboard kehadiran
-- (FR-B.3, AC-B5). Sebelumnya hanya admin yang boleh membaca semua profil,
-- sehingga GET /attendance/present mengembalikan "Tanpa nama" untuk advisor.

drop policy "profiles: admin baca semua" on public.profiles;

create policy "profiles: admin dan advisor baca semua"
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'advisor'));
