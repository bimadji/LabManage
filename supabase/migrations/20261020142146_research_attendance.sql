-- Tugas 2A: target riset, peringatan advisor, dan koreksi sesi dengan audit.

create table public.attendance_settings (
  id boolean primary key default true check (id = true),
  weekly_target_minutes integer not null default 600
    check (weekly_target_minutes between 0 and 10080),
  updated_by uuid references public.profiles,
  updated_at timestamptz not null default now()
);

insert into public.attendance_settings (id, weekly_target_minutes)
values (true, 600) on conflict (id) do nothing;

alter table public.attendance_settings enable row level security;
revoke all on public.attendance_settings from public, anon, authenticated;
grant select on public.attendance_settings to authenticated;
grant update (weekly_target_minutes) on public.attendance_settings to authenticated;

create policy "attendance_settings: semua pengguna baca"
  on public.attendance_settings for select to authenticated
  using (true);

create policy "attendance_settings: admin ubah target"
  on public.attendance_settings for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- Klien tidak boleh memalsukan aktor/waktu. Service role tetap dapat memulihkan
-- fixture atau mengisi seed dengan atribusi eksplisit tanpa auth.uid().
create function public.stamp_attendance_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.stamp_attendance_settings() from public, anon, authenticated;
create trigger attendance_settings_updated
  before update on public.attendance_settings
  for each row execute function public.stamp_attendance_settings();

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('reservasi', 'lembur', 'laporan', 'inventaris', 'kehadiran'));

create table public.attendance_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  advisor_id uuid not null references public.profiles,
  week_start date not null,
  warning_date date not null,
  note text not null default '' check (char_length(note) <= 1000),
  message text not null,
  total_minutes numeric not null check (total_minutes >= 0),
  target_minutes integer not null check (target_minutes between 0 and 10080),
  notification_id uuid not null unique references public.notifications,
  created_at timestamptz not null default now(),
  unique (user_id, warning_date)
);

create index attendance_warnings_created_idx
  on public.attendance_warnings (created_at desc, id desc);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance,
  user_id uuid not null references public.profiles,
  actor_id uuid not null references public.profiles,
  old_checked_out_at timestamptz,
  checked_out_at timestamptz not null,
  reason text not null check (
    char_length(regexp_replace(reason, '^[[:space:]]+|[[:space:]]+$', '', 'g')) between 5 and 1000
  ),
  created_at timestamptz not null default now()
);

create index attendance_corrections_user_created_idx
  on public.attendance_corrections (user_id, created_at desc, id desc);
create index attendance_corrections_created_idx
  on public.attendance_corrections (created_at desc, id desc);
create index attendance_corrections_attendance_idx
  on public.attendance_corrections (attendance_id);

alter table public.attendance_warnings enable row level security;
alter table public.attendance_corrections enable row level security;
revoke all on public.attendance_warnings, public.attendance_corrections
  from public, anon, authenticated;
grant select on public.attendance_warnings, public.attendance_corrections to authenticated;

create policy "attendance_warnings: pemilik admin advisor baca"
  on public.attendance_warnings for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

create policy "attendance_corrections: pemilik admin advisor baca"
  on public.attendance_corrections for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) in ('admin', 'advisor')
  );

-- Checkout biasa hanya menutup sesi sendiri yang masih terbuka. Koreksi sesi
-- pengguna lain harus melewati RPC agar tidak ada perubahan tanpa audit.
drop policy "attendance: update milik sendiri" on public.attendance;
drop policy "attendance: admin update semua" on public.attendance;
create policy "attendance: tutup sesi sendiri"
  on public.attendance for update to authenticated
  using (
    user_id = (select auth.uid())
    and checked_out_at is null
    and (select public.current_user_role()) in ('anggota', 'admin')
  )
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'admin')
    and checked_out_at is not null
    and checked_out_at > checked_in_at
    and checked_out_at <= now()
  );

-- Mendukung filter anggota dan batas periode tanpa memotong hasil pada 1000 baris.
create index attendance_user_checked_in_idx
  on public.attendance (user_id, checked_in_at, id);

create function public.send_attendance_warning(p_user_id uuid, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := date_trunc('milliseconds', now());
  v_date date := (v_now at time zone 'Asia/Jakarta')::date;
  v_week_start timestamptz :=
    date_trunc('week', v_now at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_total numeric;
  v_target integer;
  v_note text := regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_message text;
  v_notification_id uuid;
  v_warning public.attendance_warnings%rowtype;
begin
  if v_actor is null
    or auth.role() is distinct from 'authenticated'
    or public.current_user_role() is distinct from 'advisor'
  then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if char_length(v_note) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  -- Kunci per anggota: permintaan advisor berbeda diserialkan pada baris sama.
  -- NO KEY UPDATE tetap mengizinkan foreign key log ke profil anggota.
  perform 1 from public.profiles
    where id = p_user_id and role = 'anggota'
    for no key update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.attendance_warnings
    where user_id = p_user_id and warning_date = v_date
  ) then
    raise exception using errcode = 'P0001', message = 'WARNING_ALREADY_SENT';
  end if;

  -- Target yang dibaca tetap sama sampai transaksi peringatan selesai.
  select weekly_target_minutes into strict v_target
    from public.attendance_settings where id = true for share;

  select coalesce(sum(greatest(
    0::numeric,
    extract(epoch from (
      least(date_trunc('milliseconds', coalesce(a.checked_out_at, v_now)), v_now, v_week_start + interval '7 days')
      - greatest(date_trunc('milliseconds', a.checked_in_at), v_week_start)
    ))
  )), 0) / 60 into v_total
  from public.attendance a
  where a.user_id = p_user_id
    and a.checked_in_at < least(v_now, v_week_start + interval '7 days')
    and (a.checked_out_at is null or a.checked_out_at > v_week_start);

  -- Pembulatan hanya untuk pesan, tidak untuk perbandingan atau nilai audit.
  if v_total >= v_target then
    raise exception using errcode = 'P0001', message = 'TARGET_MET';
  end if;
  v_message := format(
    'Kehadiran riset minggu ini %s dari target %s menit. Tingkatkan kehadiran Anda.%s',
    round(v_total, 2),
    v_target,
    case when v_note = '' then '' else ' Catatan advisor: ' || v_note end
  );

  insert into public.notifications (user_id, kind, message, dedupe_key)
  values (
    p_user_id, 'kehadiran', v_message,
    'attendance-warning:' || p_user_id::text || ':' || v_date::text
  )
  returning id into v_notification_id;

  insert into public.attendance_warnings (
    user_id, advisor_id, week_start, warning_date, note, message,
    total_minutes, target_minutes, notification_id, created_at
  )
  values (
    p_user_id, v_actor, (v_week_start at time zone 'Asia/Jakarta')::date,
    v_date, v_note, v_message, v_total, v_target, v_notification_id, v_now
  )
  on conflict (user_id, warning_date) do nothing
  returning * into v_warning;
  if not found then
    -- Exception juga membatalkan notifikasi, bukan menyisakan pesan tanpa log.
    raise exception using errcode = 'P0001', message = 'WARNING_ALREADY_SENT';
  end if;

  return to_jsonb(v_warning);
end;
$$;

revoke all on function public.send_attendance_warning(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.send_attendance_warning(uuid, text) to authenticated;

create function public.correct_attendance_session(
  p_attendance_id uuid,
  p_checked_out_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_reason text := regexp_replace(coalesce(p_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_session public.attendance%rowtype;
  v_correction public.attendance_corrections%rowtype;
begin
  if v_actor is null
    or auth.role() is distinct from 'authenticated'
    or public.current_user_role() is distinct from 'admin'
  then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if char_length(v_reason) not between 5 and 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  select * into v_session from public.attendance
    where id = p_attendance_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;
  if v_session.checked_out_at is not null then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_OPEN';
  end if;
  if p_checked_out_at is null
    or p_checked_out_at <= v_session.checked_in_at
    or p_checked_out_at > v_now
  then
    raise exception using errcode = 'P0001', message = 'INVALID_CHECKOUT';
  end if;

  update public.attendance set checked_out_at = p_checked_out_at
    where id = v_session.id;
  insert into public.attendance_corrections (
    attendance_id, user_id, actor_id, old_checked_out_at,
    checked_out_at, reason, created_at
  )
  values (
    v_session.id, v_session.user_id, v_actor, v_session.checked_out_at,
    p_checked_out_at, v_reason, v_now
  )
  returning * into v_correction;

  return to_jsonb(v_correction);
end;
$$;

revoke all on function public.correct_attendance_session(uuid, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.correct_attendance_session(uuid, timestamptz, text)
  to authenticated;
