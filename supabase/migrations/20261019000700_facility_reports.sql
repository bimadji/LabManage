-- Tahap 1.10: laporan kondisi fasilitas dan alur statusnya.

create table public.facility_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('lampu', 'ventilasi', 'kerusakan')),
  description text not null check (char_length(description) between 5 and 1000),
  location text not null,
  reported_by uuid not null references public.profiles,
  status text not null default 'baru' check (status in ('baru', 'ditindaklanjuti', 'selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index facility_reports_reported_by_idx on public.facility_reports (reported_by);
create index facility_reports_status_idx on public.facility_reports (status);

-- Same rule as api/src/reports/transitions.ts: only forward moves are allowed.
create function public.enforce_report_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not (
       (old.status = 'baru' and new.status = 'ditindaklanjuti')
       or (old.status = 'ditindaklanjuti' and new.status = 'selesai')
     ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger facility_reports_transition
  before update on public.facility_reports
  for each row execute function public.enforce_report_transition();

alter table public.facility_reports enable row level security;

revoke all on public.facility_reports from anon, authenticated;
grant select on public.facility_reports to authenticated;
grant insert (category, description, location, reported_by) on public.facility_reports to authenticated;
grant update (status) on public.facility_reports to authenticated;

create policy "facility_reports: anggota baca milik sendiri"
  on public.facility_reports for select to authenticated
  using (
    reported_by = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

create policy "facility_reports: insert milik sendiri"
  on public.facility_reports for insert to authenticated
  with check (
    reported_by = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
  );

create policy "facility_reports: admin ubah status"
  on public.facility_reports for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
