-- Tahap 1.9: katalog inventaris dan peminjaman alat.

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  total_qty int not null check (total_qty >= 0),
  location text
);

create table public.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment,
  user_id uuid not null references public.profiles,
  qty int not null check (qty > 0),
  borrowed_at timestamptz not null default now(),
  returned_at timestamptz null
);

create index equipment_loans_open_idx
  on public.equipment_loans (equipment_id)
  where returned_at is null;

-- Available = total minus everything still out on loan.
create view public.equipment_availability as
select
  e.id,
  e.name,
  e.category,
  e.total_qty,
  e.location,
  e.total_qty - coalesce(sum(l.qty) filter (where l.returned_at is null), 0)::int as available
from public.equipment e
left join public.equipment_loans l on l.equipment_id = e.id
group by e.id, e.name, e.category, e.total_qty, e.location;

-- Borrowing takes a row lock, so two concurrent requests for the last unit
-- cannot both succeed. SECURITY DEFINER is required because a member's
-- `SELECT ... FOR UPDATE` would be filtered by the admin-only UPDATE policy on
-- `equipment`; the function therefore checks the caller's role itself and
-- always writes `user_id = auth.uid()`.
create function public.borrow_equipment(p_equipment_id uuid, p_qty int)
returns public.equipment_loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_out int;
  v_loan public.equipment_loans;
begin
  if (select public.current_user_role()) not in ('anggota', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'invalid_qty' using errcode = '22023';
  end if;

  select total_qty into v_total
  from public.equipment
  where id = p_equipment_id
  for update;

  if not found then
    raise exception 'equipment_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(qty), 0) into v_out
  from public.equipment_loans
  where equipment_id = p_equipment_id and returned_at is null;

  if v_total - v_out < p_qty then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;

  insert into public.equipment_loans (equipment_id, user_id, qty)
  values (p_equipment_id, auth.uid(), p_qty)
  returning * into v_loan;

  return v_loan;
end;
$$;

alter table public.equipment enable row level security;
alter table public.equipment_loans enable row level security;

revoke all on public.equipment from anon, authenticated;
revoke all on public.equipment_loans from anon, authenticated;
revoke all on public.equipment_availability from anon, authenticated;
grant select on public.equipment to authenticated;
grant insert, update, delete on public.equipment to authenticated;
grant select on public.equipment_loans to authenticated;
grant insert (equipment_id, user_id, qty) on public.equipment_loans to authenticated;
grant update (returned_at) on public.equipment_loans to authenticated;
grant select on public.equipment_availability to authenticated;
grant execute on function public.borrow_equipment(uuid, int) to authenticated;

create policy "equipment: semua authenticated membaca"
  on public.equipment for select to authenticated
  using (true);

create policy "equipment: admin insert"
  on public.equipment for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "equipment: admin update"
  on public.equipment for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "equipment: admin delete"
  on public.equipment for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "equipment_loans: anggota baca milik sendiri"
  on public.equipment_loans for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

create policy "equipment_loans: insert milik sendiri"
  on public.equipment_loans for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
  );

create policy "equipment_loans: kembalikan milik sendiri"
  on public.equipment_loans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "equipment_loans: admin update semua"
  on public.equipment_loans for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
