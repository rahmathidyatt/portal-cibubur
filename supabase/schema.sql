-- Skema Supabase untuk Portal Brighton HUB Cibubur.
-- Jalankan seluruh file ini sekali di Supabase Dashboard → SQL Editor.
-- Aman dijalankan ulang (idempotent) untuk memperbarui fungsi & aturan.
--
-- Peran:
--   anon          = pengunjung portal (advisor). Boleh membaca data, membuat reservasi
--                   lewat fungsi create_*, dan membatalkan reservasinya sendiri dengan
--                   kode pembatalan (cancel_*).
--   authenticated = akun yang login. Hanya email yang terdaftar di tabel portal_admins
--                   yang boleh mengubah data (lihat bagian "Admin portal" di bawah).

create extension if not exists pgcrypto;

-- ===================================================================
-- Reservasi Dealing Room
-- ===================================================================
create table if not exists public.room_bookings (
  id           uuid primary key default gen_random_uuid(),
  room_id      text not null check (room_id in ('dealing-room-1', 'dealing-room-2')),
  booking_date date not null,
  slot_time    text not null,
  booked_by    text not null check (char_length(trim(booked_by)) between 2 and 80),
  agenda       text not null check (char_length(trim(agenda)) between 3 and 200),
  cancel_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  unique (room_id, booking_date, slot_time)
);

-- ===================================================================
-- Pendaftaran floortime
-- ===================================================================
create table if not exists public.floortime_registrations (
  id             uuid primary key default gen_random_uuid(),
  shift_id       text not null check (shift_id in ('ft-pagi', 'ft-siang', 'ft-sore')),
  booking_date   date not null,
  advisor_name   text not null check (char_length(trim(advisor_name)) between 2 and 80),
  corridor_focus text not null check (char_length(trim(corridor_focus)) between 2 and 80),
  cancel_token   uuid not null default gen_random_uuid(),
  created_at     timestamptz not null default now()
);

create unique index if not exists floortime_unique_advisor
  on public.floortime_registrations (shift_id, booking_date, lower(advisor_name));

-- Kuota maksimal 3 advisor per sesi per tanggal (sama dengan quotaMax di aplikasi).
create or replace function public.enforce_floortime_quota()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.shift_id || new.booking_date::text));
  if (select count(*) from public.floortime_registrations
      where shift_id = new.shift_id and booking_date = new.booking_date) >= 3 then
    raise exception 'Kuota sesi floortime sudah penuh';
  end if;
  return new;
end;
$$;

drop trigger if exists floortime_quota on public.floortime_registrations;
create trigger floortime_quota
  before insert on public.floortime_registrations
  for each row execute function public.enforce_floortime_quota();

-- ===================================================================
-- Konten yang dikelola admin
-- ===================================================================
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 3 and 120),
  body       text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.business_managers (
  id         text primary key default gen_random_uuid()::text,
  name       text not null check (char_length(trim(name)) between 2 and 60),
  code       text not null unique check (code ~ '^[A-Z0-9]{2,10}$'),
  tier       text not null check (char_length(trim(tier)) between 3 and 40),
  -- Foto unggahan admin (data URL ±10–40 KB). NULL = foto bawaan aplikasi untuk id ini.
  photo_url  text check (photo_url is null or (photo_url like 'data:image/%' and char_length(photo_url) < 400000)),
  sort_order integer not null default 1000,
  created_at timestamptz not null default now()
);

-- Data awal 9 BM, hanya diisi saat tabel masih kosong (agar BM yang sudah dihapus admin
-- tidak muncul lagi ketika file ini dijalankan ulang). Foto bawaan: src/assets/managers/<id>.webp.
insert into public.business_managers (id, name, code, tier, sort_order)
select * from (values
  ('rudy',  'RUDY, CRA®',  'AUFZ', 'Brighton Warrior',  1),
  ('adolf', 'ADOLF, CRA®', 'WIID', 'Brighton Warrior',  2),
  ('vira',  'VIRA',        'AUTU', 'Brighton Warrior',  3),
  ('edah',  'EDAH, CRA®',  'DDOG', 'Brighton Warrior',  4),
  ('risda', 'RISDA, CRA®', 'TRVG', 'Brighton Champion', 5),
  ('vee',   'VEE, CRA®',   'BMWD', 'Brighton Vision',   6),
  ('moren', 'MOREN',       'VNIL', 'Brighton Champion', 7),
  ('ade',   'ADE',         'FRJU', 'Brighton Winner',   8),
  ('toni',  'TONI, CRA®',  'ACYS', 'Brighton Priority', 9)
) as seed(id, name, code, tier, sort_order)
where not exists (select 1 from public.business_managers);

-- ===================================================================
-- Fungsi untuk pengunjung (dijalankan sebagai pemilik tabel)
-- ===================================================================
create or replace function public.create_room_booking(
  p_room_id text, p_date date, p_slot_time text, p_booked_by text, p_agenda text
) returns json
language plpgsql security definer set search_path = public as $$
declare v_row public.room_bookings;
begin
  if p_date < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal sudah lewat';
  end if;
  insert into public.room_bookings (room_id, booking_date, slot_time, booked_by, agenda)
  values (p_room_id, p_date, p_slot_time, trim(p_booked_by), trim(p_agenda))
  returning * into v_row;
  return json_build_object('id', v_row.id, 'cancel_token', v_row.cancel_token);
end;
$$;

create or replace function public.cancel_room_booking(p_id uuid, p_token uuid)
returns boolean
language sql security definer set search_path = public as $$
  with deleted as (
    delete from public.room_bookings where id = p_id and cancel_token = p_token returning 1
  )
  select exists (select 1 from deleted);
$$;

create or replace function public.create_floortime_registration(
  p_shift_id text, p_date date, p_advisor_name text, p_corridor_focus text
) returns json
language plpgsql security definer set search_path = public as $$
declare v_row public.floortime_registrations;
begin
  if p_date < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal sudah lewat';
  end if;
  insert into public.floortime_registrations (shift_id, booking_date, advisor_name, corridor_focus)
  values (p_shift_id, p_date, trim(p_advisor_name), trim(p_corridor_focus))
  returning * into v_row;
  return json_build_object('id', v_row.id, 'cancel_token', v_row.cancel_token);
end;
$$;

create or replace function public.cancel_floortime_registration(p_id uuid, p_token uuid)
returns boolean
language sql security definer set search_path = public as $$
  with deleted as (
    delete from public.floortime_registrations where id = p_id and cancel_token = p_token returning 1
  )
  select exists (select 1 from deleted);
$$;

revoke all on function public.create_room_booking(text, date, text, text, text) from public;
revoke all on function public.cancel_room_booking(uuid, uuid) from public;
revoke all on function public.create_floortime_registration(text, date, text, text) from public;
revoke all on function public.cancel_floortime_registration(uuid, uuid) from public;
grant execute on function public.create_room_booking(text, date, text, text, text) to anon, authenticated;
grant execute on function public.cancel_room_booking(uuid, uuid) to anon, authenticated;
grant execute on function public.create_floortime_registration(text, date, text, text) to anon, authenticated;
grant execute on function public.cancel_floortime_registration(uuid, uuid) to anon, authenticated;

-- ===================================================================
-- Hak akses kolom: kode pembatalan tidak boleh terbaca oleh siapa pun lewat API
-- ===================================================================
revoke all on public.room_bookings, public.floortime_registrations from anon, authenticated;
grant select (id, room_id, booking_date, slot_time, booked_by, agenda, created_at)
  on public.room_bookings to anon, authenticated;
grant select (id, shift_id, booking_date, advisor_name, corridor_focus, created_at)
  on public.floortime_registrations to anon, authenticated;
grant delete on public.room_bookings, public.floortime_registrations to authenticated;

revoke all on public.announcements, public.business_managers from anon, authenticated;
grant select on public.announcements, public.business_managers to anon, authenticated;
grant insert, update, delete on public.announcements, public.business_managers to authenticated;

-- ===================================================================
-- Admin portal: hanya email di tabel ini yang boleh mengubah data.
-- Tambah admin:  insert into public.portal_admins(email) values ('nama@domain.com');
-- ===================================================================
create table if not exists public.portal_admins (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.portal_admins enable row level security;
revoke all on public.portal_admins from anon, authenticated;

create or replace function public.is_portal_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_portal_admin() from public, anon;
grant execute on function public.is_portal_admin() to authenticated;

-- ===================================================================
-- Row Level Security
-- ===================================================================
alter table public.room_bookings enable row level security;
alter table public.floortime_registrations enable row level security;
alter table public.announcements enable row level security;
alter table public.business_managers enable row level security;

-- Hapus kebijakan lama dari versi skema sebelumnya.
drop policy if exists "anon read room_bookings" on public.room_bookings;
drop policy if exists "anon insert room_bookings" on public.room_bookings;
drop policy if exists "anon read floortime" on public.floortime_registrations;
drop policy if exists "anon insert floortime" on public.floortime_registrations;

drop policy if exists "read room_bookings" on public.room_bookings;
create policy "read room_bookings" on public.room_bookings
  for select to anon, authenticated using (true);
drop policy if exists "admin delete room_bookings" on public.room_bookings;
create policy "admin delete room_bookings" on public.room_bookings
  for delete to authenticated using (public.is_portal_admin());

drop policy if exists "read floortime" on public.floortime_registrations;
create policy "read floortime" on public.floortime_registrations
  for select to anon, authenticated using (true);
drop policy if exists "admin delete floortime" on public.floortime_registrations;
create policy "admin delete floortime" on public.floortime_registrations
  for delete to authenticated using (public.is_portal_admin());

do $$
declare t text;
begin
  foreach t in array array['announcements', 'business_managers'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin insert %1$s" on public.%1$I', t);
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_portal_admin())', t);
    execute format('drop policy if exists "admin update %1$s" on public.%1$I', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin())', t);
    execute format('drop policy if exists "admin delete %1$s" on public.%1$I', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_portal_admin())', t);
  end loop;
end;
$$;

-- ===================================================================
-- Floor Time Scheduler: jadwal bulanan yang diterbitkan staf + request advisor
-- ===================================================================
create table if not exists public.floortime_schedules (
  id               uuid primary key default gen_random_uuid(),
  year             integer not null check (year between 2024 and 2100),
  month            integer not null check (month between 1 and 12),
  data             jsonb not null,
  request_deadline timestamptz not null,
  published_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (year, month)
);

create table if not exists public.floortime_change_requests (
  id          uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.floortime_schedules(id) on delete cascade,
  agent_id    text not null,
  agent_name  text not null check (char_length(agent_name) between 1 and 120),
  from_slot   text,
  to_slot     text not null,
  reason      text not null check (char_length(trim(reason)) between 3 and 200),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists floortime_change_requests_schedule_idx
  on public.floortime_change_requests (schedule_id, created_at desc);
create unique index if not exists floortime_change_requests_pending_unique
  on public.floortime_change_requests (schedule_id, agent_id, to_slot) where status = 'pending';

-- Advisor mengajukan request lewat fungsi ini; batas waktu ditegakkan di database.
create or replace function public.submit_floortime_request(
  p_schedule_id uuid, p_agent_id text, p_from_slot text, p_to_slot text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_schedule public.floortime_schedules;
  v_agent jsonb;
  v_id uuid;
begin
  select * into v_schedule from public.floortime_schedules where id = p_schedule_id;
  if not found then
    raise exception 'Jadwal tidak ditemukan';
  end if;
  if now() > v_schedule.request_deadline then
    raise exception 'Batas waktu request sudah lewat';
  end if;
  select a into v_agent from jsonb_array_elements(v_schedule.data -> 'agents') a
    where a ->> 'id' = p_agent_id limit 1;
  if v_agent is null then
    raise exception 'Agen tidak ada di jadwal';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_schedule.data -> 'slots') s where s ->> 'key' = p_to_slot) then
    raise exception 'Slot tujuan tidak ada di jadwal';
  end if;
  if p_from_slot is not null and not exists (
    select 1 from jsonb_array_elements(coalesce(v_schedule.data -> 'assignments' -> p_from_slot, '[]'::jsonb)) e
    where e ->> 'agentId' = p_agent_id
  ) then
    raise exception 'Jadwal asal tidak ditemukan untuk agen ini';
  end if;
  insert into public.floortime_change_requests (schedule_id, agent_id, agent_name, from_slot, to_slot, reason)
  values (
    p_schedule_id,
    p_agent_id,
    case when coalesce(v_agent ->> 'code', '') <> ''
      then (v_agent ->> 'name') || ' (' || (v_agent ->> 'code') || ')'
      else v_agent ->> 'name' end,
    p_from_slot,
    p_to_slot,
    trim(p_reason)
  )
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Request yang sama masih menunggu keputusan admin';
end;
$$;
revoke all on function public.submit_floortime_request(uuid, text, text, text, text) from public;
grant execute on function public.submit_floortime_request(uuid, text, text, text, text) to anon, authenticated;

revoke all on public.floortime_schedules, public.floortime_change_requests from anon, authenticated;
grant select on public.floortime_schedules to anon, authenticated;
grant insert, update, delete on public.floortime_schedules to authenticated;
-- Alasan request hanya terbaca akun yang login (admin).
grant select (id, schedule_id, agent_id, agent_name, from_slot, to_slot, status, created_at, decided_at)
  on public.floortime_change_requests to anon, authenticated;
grant select (reason) on public.floortime_change_requests to authenticated;
grant update, delete on public.floortime_change_requests to authenticated;

alter table public.floortime_schedules enable row level security;
alter table public.floortime_change_requests enable row level security;

drop policy if exists "read floortime_schedules" on public.floortime_schedules;
create policy "read floortime_schedules" on public.floortime_schedules
  for select to anon, authenticated using (true);
drop policy if exists "admin insert floortime_schedules" on public.floortime_schedules;
create policy "admin insert floortime_schedules" on public.floortime_schedules
  for insert to authenticated with check (public.is_portal_admin());
drop policy if exists "admin update floortime_schedules" on public.floortime_schedules;
create policy "admin update floortime_schedules" on public.floortime_schedules
  for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin delete floortime_schedules" on public.floortime_schedules;
create policy "admin delete floortime_schedules" on public.floortime_schedules
  for delete to authenticated using (public.is_portal_admin());

drop policy if exists "read floortime_change_requests" on public.floortime_change_requests;
create policy "read floortime_change_requests" on public.floortime_change_requests
  for select to anon, authenticated using (true);
drop policy if exists "admin update floortime_change_requests" on public.floortime_change_requests;
create policy "admin update floortime_change_requests" on public.floortime_change_requests
  for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin delete floortime_change_requests" on public.floortime_change_requests;
create policy "admin delete floortime_change_requests" on public.floortime_change_requests
  for delete to authenticated using (public.is_portal_admin());

-- ---------------------------------------------------------------------
-- Ulang tahun agen (tanpa tahun lahir) — dibaca publik untuk pengingat
-- beranda, diubah hanya oleh admin portal.
-- ---------------------------------------------------------------------
create table if not exists public.agent_birthdays (
  code text primary key check (code ~ '^[A-Z0-9]{2,12}$'),
  name text not null check (char_length(name) between 1 and 80),
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_day smallint not null check (birth_day between 1 and 31),
  updated_at timestamptz not null default now()
);

revoke all on public.agent_birthdays from anon, authenticated;
grant select on public.agent_birthdays to anon, authenticated;
grant insert, update, delete on public.agent_birthdays to authenticated;
alter table public.agent_birthdays enable row level security;

drop policy if exists "read agent_birthdays" on public.agent_birthdays;
create policy "read agent_birthdays" on public.agent_birthdays
  for select to anon, authenticated using (true);
drop policy if exists "admin insert agent_birthdays" on public.agent_birthdays;
create policy "admin insert agent_birthdays" on public.agent_birthdays
  for insert to authenticated with check (public.is_portal_admin());
drop policy if exists "admin update agent_birthdays" on public.agent_birthdays;
create policy "admin update agent_birthdays" on public.agent_birthdays
  for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin delete agent_birthdays" on public.agent_birthdays;
create policy "admin delete agent_birthdays" on public.agent_birthdays
  for delete to authenticated using (public.is_portal_admin());

-- ---------------------------------------------------------------------
-- Statistik kunjungan. Tabel tertutup; tulis lewat record_page_view,
-- baca ringkasan lewat page_view_stats (khusus admin).
-- ---------------------------------------------------------------------
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  path text not null default '' check (char_length(path) <= 64),
  viewed_at timestamptz not null default now()
);
create index if not exists page_views_viewed_at_idx on public.page_views (viewed_at);
create index if not exists page_views_visitor_idx on public.page_views (visitor_id, viewed_at);

revoke all on public.page_views from anon, authenticated;
alter table public.page_views enable row level security;

create or replace function public.record_page_view(p_visitor text, p_path text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then
    return;
  end if;
  -- Batas wajar per pengunjung agar angka tidak bisa digelembungkan.
  if (select count(*) from public.page_views
      where visitor_id = p_visitor and viewed_at > now() - interval '1 day') >= 50 then
    return;
  end if;
  insert into public.page_views (visitor_id, path)
  values (p_visitor, left(coalesce(p_path, ''), 64));
end;
$$;
revoke all on function public.record_page_view(text, text) from public;
grant execute on function public.record_page_view(text, text) to anon, authenticated;

create or replace function public.page_view_stats(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_days int := least(greatest(coalesce(p_days, 14), 1), 90);
  v_result jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Statistik hanya untuk admin portal';
  end if;
  with v as (
    select visitor_id, (viewed_at at time zone 'Asia/Jakarta')::date as d from public.page_views
  ),
  days as (
    select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as d
  ),
  daily as (
    select days.d, count(v.visitor_id) as views, count(distinct v.visitor_id) as visitors
    from days left join v on v.d = days.d
    group by days.d order by days.d
  )
  select jsonb_build_object(
    'totalViews', (select count(*) from v),
    'uniqueVisitors', (select count(distinct visitor_id) from v),
    'todayViews', (select count(*) from v where d = v_today),
    'todayVisitors', (select count(distinct visitor_id) from v where d = v_today),
    'last7Views', (select count(*) from v where d > v_today - 7),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', to_char(d, 'YYYY-MM-DD'), 'views', views, 'visitors', visitors) order by d), '[]'::jsonb)
              from daily)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.page_view_stats(int) from public;
grant execute on function public.page_view_stats(int) to authenticated;
