-- Tahap 1.2: profil pengguna dan peran.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role text not null check (role in ('anggota', 'admin', 'advisor')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Role of the calling user. SECURITY DEFINER bypasses RLS, so policies on
-- profiles can use it without recursing into themselves.
create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Table privileges: anon gets nothing; authenticated may only read and change full_name.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "profiles: baca milik sendiri"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admin baca semua"
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "profiles: ubah full_name milik sendiri"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select public.current_user_role())
  );

-- New auth users always start as anggota. Admin/advisor are assigned via SQL or
-- the service-role seed script, never through the public API.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email, ''),
    'anggota'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
