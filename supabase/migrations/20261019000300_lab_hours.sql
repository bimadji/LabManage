-- Tahap 1.4: jam operasional lab dan larangan reservasi bertabrakan.

create extension if not exists btree_gist;

create table public.lab_hours (
  weekday int primary key check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at)
);

insert into public.lab_hours (weekday, opens_at, closes_at)
select weekday, time '07:00', time '21:00'
from generate_series(0, 6) as weekday;

alter table public.lab_hours enable row level security;

revoke all on public.lab_hours from anon, authenticated;
grant select, insert, update, delete on public.lab_hours to authenticated;

create policy "lab_hours: semua authenticated membaca"
  on public.lab_hours for select to authenticated
  using (true);

create policy "lab_hours: admin insert"
  on public.lab_hours for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "lab_hours: admin update"
  on public.lab_hours for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "lab_hours: admin delete"
  on public.lab_hours for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- Two active reservations in the same room may not overlap. tstzrange is
-- half-open by default, so a reservation ending exactly when the next starts
-- does not collide. This is the authoritative guard; the API pre-check only
-- produces a friendly error message.
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'aktif');
