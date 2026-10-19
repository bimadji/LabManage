-- Tahap 1.13: inventaris dua jenis item (komponen habis pakai dan barang satuan).
--
-- `equipment` diperluas menjadi tabel item inventaris, lalu mesin pinjam-langsung
-- lama (`equipment_loans`, `borrow_equipment`, `equipment_availability`) dibuang:
-- aturan baru melarang anggota mengubah status barang, sehingga pinjam harus
-- lewat permintaan yang disetujui admin.

alter table public.equipment
  add column kind text not null default 'komponen' check (kind in ('komponen', 'barang')),
  add column quantity int not null default 0 check (quantity >= 0),
  add column min_stock int not null default 0 check (min_stock >= 0),
  add column status text not null default 'tersedia' check (status in ('tersedia', 'dipinjam')),
  add column borrowed_by uuid references public.profiles,
  add column borrowed_at timestamptz,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

update public.equipment set quantity = total_qty;

alter table public.equipment
  add constraint equipment_barang_single_unit check (kind <> 'barang' or quantity = 1),
  add constraint equipment_komponen_not_borrowed
    check (kind <> 'komponen' or (status = 'tersedia' and borrowed_by is null and borrowed_at is null)),
  add constraint equipment_borrow_state check (
    (status = 'dipinjam' and borrowed_by is not null and borrowed_at is not null)
    or (status = 'tersedia' and borrowed_by is null and borrowed_at is null));

create table public.inventory_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment on delete cascade,
  actor_id uuid not null references public.profiles,
  action text not null check (
    action in (
      'buat', 'ubah', 'hapus', 'tambah', 'kurang', 'set', 'pinjam', 'kembali',
      'konfirmasi_ambil', 'tolak_ambil', 'setujui_pinjam', 'tolak_pinjam', 'batal_pinjam'
    )
  ),
  before_qty int,
  after_qty int,
  before_status text,
  after_status text,
  note text,
  created_at timestamptz not null default now()
);

create index inventory_history_item_idx on public.inventory_history (item_id, created_at desc);

-- Pinjaman lama tetap punya jejak, baru setelah itu mesinnya dibuang.
insert into public.inventory_history (item_id, actor_id, action, note, created_at)
select equipment_id, user_id, case when returned_at is null then 'pinjam' else 'kembali' end,
       'migrasi data pinjaman lama', borrowed_at
from public.equipment_loans;

drop view public.equipment_availability;
drop function public.borrow_equipment(uuid, int);
drop table public.equipment_loans;
alter table public.equipment drop column total_qty;

-- Flag stok dihitung di database agar UI dan laporan memakai definisi yang sama.
-- `security_invoker` wajib: tanpa itu view melewati RLS `equipment`.
create view public.inventory_items with (security_invoker = true) as
select
  e.id,
  e.name,
  e.category,
  e.location,
  e.kind,
  e.quantity,
  e.min_stock,
  e.status,
  e.borrowed_by,
  e.borrowed_at,
  e.created_at,
  e.updated_at,
  case
    when e.kind = 'komponen' and e.quantity = 0 then 'habis'
    when e.kind = 'komponen' and e.quantity <= e.min_stock then 'menipis'
    when e.kind = 'komponen' then 'aman'
  end as stock_flag
from public.equipment e;

create table public.component_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment on delete cascade,
  user_id uuid not null references public.profiles,
  qty int not null check (qty > 0),
  note text,
  status text not null default 'menunggu' check (status in ('menunggu', 'dikonfirmasi', 'ditolak')),
  admin_note text,
  decided_by uuid references public.profiles,
  decided_at timestamptz,
  admin_read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.loan_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment on delete cascade,
  user_id uuid not null references public.profiles,
  purpose text not null check (char_length(purpose) between 3 and 500),
  expected_return_at date,
  status text not null default 'menunggu' check (
    status in ('menunggu', 'disetujui', 'ditolak', 'dibatalkan')
  ),
  admin_note text,
  decided_by uuid references public.profiles,
  decided_at timestamptz,
  admin_read_at timestamptz,
  created_at timestamptz not null default now()
);

create index component_requests_user_idx on public.component_requests (user_id, created_at desc);
create index component_requests_status_idx on public.component_requests (status);
create index loan_requests_user_idx on public.loan_requests (user_id, created_at desc);
create index loan_requests_status_idx on public.loan_requests (status);

alter table public.inventory_history enable row level security;
alter table public.component_requests enable row level security;
alter table public.loan_requests enable row level security;

revoke all on public.inventory_history from anon, authenticated;
revoke all on public.component_requests from anon, authenticated;
revoke all on public.loan_requests from anon, authenticated;
revoke all on public.inventory_items from anon, authenticated;

grant select on public.inventory_items to authenticated;
grant select on public.inventory_history to authenticated;
grant insert (item_id, actor_id, action, before_qty, after_qty, before_status, after_status, note)
  on public.inventory_history to authenticated;
grant select on public.component_requests to authenticated;
grant insert (item_id, user_id, qty, note) on public.component_requests to authenticated;
grant update (status, admin_note, decided_by, decided_at, admin_read_at)
  on public.component_requests to authenticated;
grant select on public.loan_requests to authenticated;
grant insert (item_id, user_id, purpose, expected_return_at) on public.loan_requests to authenticated;
grant update (status, admin_note, decided_by, decided_at, admin_read_at)
  on public.loan_requests to authenticated;

create policy "inventory_history: semua authenticated membaca"
  on public.inventory_history for select to authenticated
  using (true);

create policy "inventory_history: admin menulis"
  on public.inventory_history for insert to authenticated
  with check (
    (select public.current_user_role()) = 'admin'
    and actor_id = (select auth.uid())
  );

create policy "component_requests: baca milik sendiri atau pengelola"
  on public.component_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

create policy "component_requests: anggota mengajukan milik sendiri"
  on public.component_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
  );

create policy "component_requests: admin memutuskan"
  on public.component_requests for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "loan_requests: baca milik sendiri atau pengelola"
  on public.loan_requests for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

create policy "loan_requests: anggota mengajukan milik sendiri"
  on public.loan_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
  );

create policy "loan_requests: admin memutuskan"
  on public.loan_requests for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- Pemilik hanya boleh membatalkan permintaannya sendiri selama masih menunggu.
create policy "loan_requests: pemilik membatalkan"
  on public.loan_requests for update to authenticated
  using (user_id = (select auth.uid()) and status = 'menunggu')
  with check (user_id = (select auth.uid()) and status = 'dibatalkan');

-- Semua fungsi di bawah mengunci baris yang disentuh, sehingga dua permintaan
-- bersamaan tidak bisa memakai stok atau unit yang sama dua kali. SECURITY
-- DEFINER diperlukan karena anggota tidak punya hak UPDATE pada `equipment`;
-- setiap fungsi memeriksa peran pemanggilnya sendiri.

create function public.adjust_inventory_quantity(
  p_item_id uuid,
  p_mode text,
  p_amount int,
  p_note text
)
returns public.equipment
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.equipment;
  v_before int;
  v_after int;
begin
  if (select public.current_user_role()) <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_mode is null or p_mode not in ('tambah', 'kurang', 'set')
     or p_amount is null or p_amount < 0 then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;

  select * into v_item from public.equipment where id = p_item_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_item.kind <> 'komponen' then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;

  v_before := v_item.quantity;
  v_after := case p_mode
    when 'tambah' then v_before + p_amount
    when 'kurang' then v_before - p_amount
    else p_amount
  end;

  if v_after < 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;

  update public.equipment
  set quantity = v_after, updated_at = now()
  where id = p_item_id
  returning * into v_item;

  insert into public.inventory_history (item_id, actor_id, action, before_qty, after_qty, note)
  values (p_item_id, auth.uid(), p_mode, v_before, v_after, p_note);

  return v_item;
end;
$$;

create function public.confirm_component_request(p_request_id uuid)
returns public.component_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.component_requests;
  v_item public.equipment;
begin
  if (select public.current_user_role()) <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_request from public.component_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'menunggu' then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;

  select * into v_item from public.equipment where id = v_request.item_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_item.kind <> 'komponen' then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;
  if v_item.quantity < v_request.qty then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;

  update public.equipment
  set quantity = v_item.quantity - v_request.qty, updated_at = now()
  where id = v_item.id;

  update public.component_requests
  set status = 'dikonfirmasi', decided_by = auth.uid(), decided_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.inventory_history (item_id, actor_id, action, before_qty, after_qty, note)
  values (v_item.id, auth.uid(), 'konfirmasi_ambil', v_item.quantity, v_item.quantity - v_request.qty, v_request.note);

  return v_request;
end;
$$;

create function public.approve_loan_request(p_request_id uuid)
returns public.loan_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.loan_requests;
  v_item public.equipment;
begin
  if (select public.current_user_role()) <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_request from public.loan_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'menunggu' then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;

  select * into v_item from public.equipment where id = v_request.item_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_item.kind <> 'barang' then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;
  if v_item.status <> 'tersedia' then
    raise exception 'item_unavailable' using errcode = 'P0003';
  end if;

  update public.equipment
  set status = 'dipinjam', borrowed_by = v_request.user_id, borrowed_at = now(), updated_at = now()
  where id = v_item.id;

  update public.loan_requests
  set status = 'disetujui', decided_by = auth.uid(), decided_at = now()
  where id = p_request_id
  returning * into v_request;

  update public.loan_requests
  set status = 'ditolak',
      admin_note = 'barang sudah dipinjam',
      decided_by = auth.uid(),
      decided_at = now()
  where item_id = v_item.id and status = 'menunggu';

  insert into public.inventory_history
    (item_id, actor_id, action, before_status, after_status, note)
  values (v_item.id, auth.uid(), 'setujui_pinjam', 'tersedia', 'dipinjam', v_request.purpose);

  return v_request;
end;
$$;

create function public.return_inventory_item(p_item_id uuid)
returns public.equipment
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.equipment;
begin
  if (select public.current_user_role()) <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_item from public.equipment where id = p_item_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_item.kind <> 'barang' or v_item.status <> 'dipinjam' then
    raise exception 'invalid_state' using errcode = 'P0004';
  end if;

  update public.equipment
  set status = 'tersedia', borrowed_by = null, borrowed_at = null, updated_at = now()
  where id = p_item_id
  returning * into v_item;

  insert into public.inventory_history
    (item_id, actor_id, action, before_status, after_status)
  values (p_item_id, auth.uid(), 'kembali', 'dipinjam', 'tersedia');

  return v_item;
end;
$$;

revoke all on function public.adjust_inventory_quantity(uuid, text, int, text) from public, anon;
revoke all on function public.confirm_component_request(uuid) from public, anon;
revoke all on function public.approve_loan_request(uuid) from public, anon;
revoke all on function public.return_inventory_item(uuid) from public, anon;

grant execute on function public.adjust_inventory_quantity(uuid, text, int, text) to authenticated;
grant execute on function public.confirm_component_request(uuid) to authenticated;
grant execute on function public.approve_loan_request(uuid) to authenticated;
grant execute on function public.return_inventory_item(uuid) to authenticated;
