-- Tahap 1.6: sesi kehadiran anggota di lab.

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz null,
  check (checked_out_at is null or checked_out_at > checked_in_at)
);

-- At most one open session per user: check-in twice cannot open a second session,
-- even when two requests race.
create unique index attendance_one_open_per_user
  on public.attendance (user_id)
  where checked_out_at is null;

create index attendance_open_idx on public.attendance (checked_in_at) where checked_out_at is null;

alter table public.attendance enable row level security;

revoke all on public.attendance from anon, authenticated;
grant select on public.attendance to authenticated;
grant insert (user_id, checked_in_at) on public.attendance to authenticated;
grant update (checked_out_at) on public.attendance to authenticated;

create policy "attendance: anggota baca milik sendiri"
  on public.attendance for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

create policy "attendance: insert milik sendiri"
  on public.attendance for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
  );

create policy "attendance: update milik sendiri"
  on public.attendance for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "attendance: admin update semua"
  on public.attendance for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- Realtime for the monitoring dashboard (PRD 10.6).
alter publication supabase_realtime add table public.attendance;
