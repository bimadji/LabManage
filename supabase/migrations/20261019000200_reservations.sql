-- Tahap 1.3: ruang/alat dan reservasi.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  kind text not null check (kind in ('ruang', 'alat')),
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms,
  team text not null,
  user_id uuid not null references public.profiles,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'aktif' check (status in ('aktif', 'dibatalkan')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index reservations_starts_at_idx on public.reservations (starts_at);
create index reservations_user_id_idx on public.reservations (user_id);

alter table public.rooms enable row level security;
alter table public.reservations enable row level security;

-- rooms: semua authenticated membaca; hanya admin yang mengelola.
revoke all on public.rooms from anon, authenticated;
grant select, insert, update, delete on public.rooms to authenticated;

create policy "rooms: semua authenticated membaca"
  on public.rooms for select to authenticated
  using (true);

create policy "rooms: admin insert"
  on public.rooms for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "rooms: admin update"
  on public.rooms for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "rooms: admin delete"
  on public.rooms for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- reservations: status hanya bisa diubah lewat kolom status; kolom lain tidak bisa di-update klien.
revoke all on public.reservations from anon, authenticated;
grant select, delete on public.reservations to authenticated;
grant insert (room_id, team, user_id, starts_at, ends_at) on public.reservations to authenticated;
grant update (status) on public.reservations to authenticated;

create policy "reservations: semua authenticated membaca"
  on public.reservations for select to authenticated
  using (true);

-- Advisor hanya membaca. Anggota dan admin membuat reservasi atas nama sendiri.
create policy "reservations: insert milik sendiri"
  on public.reservations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
  );

-- Pemilik hanya boleh membatalkan reservasinya sendiri.
create policy "reservations: pemilik membatalkan"
  on public.reservations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'dibatalkan');

create policy "reservations: admin update semua"
  on public.reservations for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "reservations: admin delete semua"
  on public.reservations for delete to authenticated
  using ((select public.current_user_role()) = 'admin');
