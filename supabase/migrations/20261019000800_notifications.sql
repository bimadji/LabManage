-- Tahap 1.11: notifikasi pengguna.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  kind text not null check (kind in ('reservasi', 'lembur', 'laporan')),
  message text not null,
  dedupe_key text unique,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- No insert for clients: notifications are written by the API with the service role.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: baca milik sendiri"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: tandai dibaca milik sendiri"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
