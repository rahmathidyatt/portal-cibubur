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
revoke all on function public.page_view_stats(int) from public, anon;
grant execute on function public.page_view_stats(int) to authenticated;

-- ---------------------------------------------------------------------
-- Jingle Brighton: diputar di portal, dikelola admin.
-- Lagu bawaan ada di public/jingles/ (url relatif); unggahan admin
-- disimpan di Storage bucket "jingles" (url publik + storage_path).
-- ---------------------------------------------------------------------
create table if not exists public.jingles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  url text not null check (char_length(url) between 1 and 500),
  storage_path text check (storage_path is null or char_length(storage_path) <= 200),
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- Lagu bawaan hanya diisi saat tabel masih kosong.
insert into public.jingles (title, url, sort_order)
select * from (values
  ('Rise and Multiply', 'jingles/rise-and-multiply.mp3', 1),
  ('Together Greater', 'jingles/together-greater.mp3', 2),
  ('Selalu Melangkah', 'jingles/selalu-melangkah.mp3', 3),
  ('United for Impact', 'jingles/united-for-impact.mp3', 4),
  ('Mimpi Jadi Nyata', 'jingles/mimpi-jadi-nyata.mp3', 5)
) as v(title, url, sort_order)
where not exists (select 1 from public.jingles);

revoke all on public.jingles from anon, authenticated;
grant select on public.jingles to anon, authenticated;
grant insert, update, delete on public.jingles to authenticated;
alter table public.jingles enable row level security;

drop policy if exists "read jingles" on public.jingles;
create policy "read jingles" on public.jingles
  for select to anon, authenticated using (true);
drop policy if exists "admin insert jingles" on public.jingles;
create policy "admin insert jingles" on public.jingles
  for insert to authenticated with check (public.is_portal_admin());
drop policy if exists "admin update jingles" on public.jingles;
create policy "admin update jingles" on public.jingles
  for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin delete jingles" on public.jingles;
create policy "admin delete jingles" on public.jingles
  for delete to authenticated using (public.is_portal_admin());


-- Storage bucket untuk jingle unggahan admin (khusus Supabase).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jingles', 'jingles', true, 15728640, array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin upload jingles" on storage.objects;
create policy "admin upload jingles" on storage.objects
  for insert to authenticated with check (bucket_id = 'jingles' and public.is_portal_admin());
drop policy if exists "admin delete jingle files" on storage.objects;
create policy "admin delete jingle files" on storage.objects
  for delete to authenticated using (bucket_id = 'jingles' and public.is_portal_admin());
drop policy if exists "admin read jingle files" on storage.objects;
create policy "admin read jingle files" on storage.objects
  for select to authenticated using (bucket_id = 'jingles' and public.is_portal_admin());

-- ---------------------------------------------------------------------
-- Statistik v2: sesi, perangkat, halaman. Satu baris = satu halaman yang
-- dibuka dalam satu sesi; kunjungan = jumlah sesi.
-- ---------------------------------------------------------------------
alter table public.page_views add column if not exists session_id text
  check (session_id is null or char_length(session_id) between 8 and 64);
alter table public.page_views add column if not exists device text
  check (device is null or device in ('mobile', 'tablet', 'desktop'));
create index if not exists page_views_session_idx on public.page_views (session_id);

drop function if exists public.record_page_view(text, text);
create or replace function public.record_page_view(
  p_visitor text,
  p_path text default '',
  p_session text default null,
  p_device text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null or char_length(p_visitor) not between 8 and 64 then
    return;
  end if;
  if (select count(*) from public.page_views
      where visitor_id = p_visitor and viewed_at > now() - interval '1 day') >= 300 then
    return;
  end if;
  insert into public.page_views (visitor_id, path, session_id, device)
  values (
    p_visitor,
    left(coalesce(p_path, ''), 64),
    case when char_length(p_session) between 8 and 64 then p_session end,
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device end
  );
end;
$$;
revoke all on function public.record_page_view(text, text, text, text) from public;
grant execute on function public.record_page_view(text, text, text, text) to anon, authenticated;

create or replace function public.page_view_stats(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_days int := least(greatest(coalesce(p_days, 14), 1), 365);
  v_from date := v_today - (v_days - 1);
  v_result jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Statistik hanya untuk admin portal';
  end if;
  with hits as (
    select visitor_id,
           coalesce(session_id, 'row-' || id::text) as sid,
           nullif(path, '') as path,
           device,
           viewed_at at time zone 'Asia/Jakarta' as local_at,
           (viewed_at at time zone 'Asia/Jakarta')::date as d
    from public.page_views
  ),
  sessions as (
    select sid, min(visitor_id) as visitor_id, min(local_at) as started, min(d) as d,
           max(device) as device
    from hits group by sid
  ),
  days as (
    select generate_series(v_from, v_today, interval '1 day')::date as d
  ),
  daily as (
    select days.d, count(s.sid) as visits, count(distinct s.visitor_id) as visitors
    from days left join sessions s on s.d = days.d
    group by days.d
  )
  select jsonb_build_object(
    'rangeDays', v_days,
    'totalViews', (select count(*) from sessions),
    'uniqueVisitors', (select count(distinct visitor_id) from sessions),
    'todayViews', (select count(*) from sessions where d = v_today),
    'todayVisitors', (select count(distinct visitor_id) from sessions where d = v_today),
    'last7Views', (select count(*) from sessions where d > v_today - 7),
    'rangeViews', (select count(*) from sessions where d >= v_from),
    'rangeVisitors', (select count(distinct visitor_id) from sessions where d >= v_from),
    'prevRangeViews', (select count(*) from sessions where d >= v_from - v_days and d < v_from),
    'pageViews', (select count(*) from hits where d >= v_from),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', to_char(d, 'YYYY-MM-DD'), 'views', visits, 'visitors', visitors) order by d), '[]'::jsonb)
              from daily),
    'topPages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n) order by n desc, path), '[]'::jsonb)
                 from (select coalesce(path, 'beranda') as path, count(*) as n from hits
                       where d >= v_from group by 1 order by 2 desc, 1 limit 8) t),
    'hours', (select jsonb_agg(coalesce(n, 0) order by h)
              from generate_series(0, 23) h
              left join (select extract(hour from started)::int as hr, count(*) as n
                         from sessions where d >= v_from group by 1) x on x.hr = h),
    'devices', (select jsonb_build_object(
                  'mobile', count(*) filter (where device = 'mobile'),
                  'tablet', count(*) filter (where device = 'tablet'),
                  'desktop', count(*) filter (where device = 'desktop'),
                  'unknown', count(*) filter (where device is null))
                from sessions where d >= v_from)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.page_view_stats(int) from public, anon;
grant execute on function public.page_view_stats(int) to authenticated;

-- ---------------------------------------------------------------------
-- Training Brighton & Nota Medpro: data internal, khusus admin portal.
-- Tidak ada akses anon sama sekali.
-- ---------------------------------------------------------------------
create table if not exists public.training_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  scores jsonb not null default '{}'::jsonb,
  pending jsonb not null default '{}'::jsonb,
  graduated boolean not null default false,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medpro_notas (
  id uuid primary key default gen_random_uuid(),
  nota_date date not null,
  invoice text not null unique check (char_length(invoice) between 5 and 60),
  banner integer not null default 0 check (banner >= 0),
  branding integer not null default 0 check (branding >= 0),
  checked boolean not null default false,
  paid_on date,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists medpro_notas_paid_idx on public.medpro_notas (paid_on);

create table if not exists public.medpro_drops (
  id uuid primary key default gen_random_uuid(),
  drop_date date not null,
  office text not null check (char_length(office) between 1 and 60),
  nota_no text not null check (char_length(nota_no) between 1 and 60),
  amount integer not null default 0 check (amount >= 0),
  checked boolean not null default false,
  paid_on date,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (nota_no, drop_date)
);

do $$
declare t text;
begin
  foreach t in array array['training_agents', 'medpro_notas', 'medpro_drops'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all %s" on public.%I', t, t);
    execute format(
      'create policy "admin all %s" on public.%I for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin())',
      t, t);
  end loop;
end $$;

-- Pengumuman berulang mingguan (1 = Senin … 7 = Minggu; null = sekali).
-- Pengumuman "Co-Broking Day" (setiap Senin) diisi sekali lewat migrasi dan bisa dihapus admin.
alter table public.announcements add column if not exists repeat_weekday smallint
  check (repeat_weekday is null or repeat_weekday between 1 and 7);

-- ------------------------------------------------------------------
-- Minbur (bot FAQ "admin cibubur")
-- minbur_faq: tanya-jawab yang diajarkan admin (dibaca semua orang).
-- minbur_unanswered: pertanyaan yang belum bisa dijawab (dicatat lewat fungsi, dibaca admin).
-- ------------------------------------------------------------------
create table if not exists public.minbur_faq (
  id uuid primary key default gen_random_uuid(),
  keywords text not null check (char_length(keywords) between 2 and 300),
  answer text not null check (char_length(answer) between 2 and 1500),
  link_label text check (link_label is null or char_length(link_label) <= 60),
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^(https?://|#)')),
  created_at timestamptz not null default now()
);
grant select on public.minbur_faq to anon, authenticated;
grant insert, update, delete on public.minbur_faq to authenticated;
alter table public.minbur_faq enable row level security;
drop policy if exists "read minbur_faq" on public.minbur_faq;
create policy "read minbur_faq" on public.minbur_faq for select to anon, authenticated using (true);
drop policy if exists "admin all minbur_faq" on public.minbur_faq;
create policy "admin all minbur_faq" on public.minbur_faq for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create table if not exists public.minbur_unanswered (
  id bigint generated always as identity primary key,
  question text not null check (char_length(question) between 1 and 200),
  asked_at timestamptz not null default now()
);
create index if not exists minbur_unanswered_asked_idx on public.minbur_unanswered (asked_at);
revoke all on public.minbur_unanswered from anon;
grant select, delete on public.minbur_unanswered to authenticated;
alter table public.minbur_unanswered enable row level security;
drop policy if exists "admin all minbur_unanswered" on public.minbur_unanswered;
create policy "admin all minbur_unanswered" on public.minbur_unanswered for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create or replace function public.record_minbur_question(p_question text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := left(btrim(coalesce(p_question, '')), 200);
begin
  if char_length(v_q) < 2 then
    return;
  end if;
  -- Pertanyaan sama dalam 7 hari terakhir tidak dicatat ulang; batas wajar 300 per hari.
  if exists (select 1 from public.minbur_unanswered
             where lower(question) = lower(v_q) and asked_at > now() - interval '7 days') then
    return;
  end if;
  if (select count(*) from public.minbur_unanswered where asked_at > now() - interval '1 day') >= 300 then
    return;
  end if;
  insert into public.minbur_unanswered (question) values (v_q);
end;
$$;
revoke all on function public.record_minbur_question(text) from public;
grant execute on function public.record_minbur_question(text) to anon, authenticated;

-- ------------------------------------------------------------------
-- Report Bright Day (khusus admin). Laporan & foto disimpan 7 hari,
-- yang lebih lama dibersihkan otomatis saat admin membuka menu.
-- ------------------------------------------------------------------
create table if not exists public.bright_day_reports (
  id uuid primary key,
  created_at timestamptz not null default now(),
  event_date date,
  report jsonb not null check (octet_length(report::text) <= 100000)
);
create index if not exists bright_day_reports_created_idx on public.bright_day_reports (created_at);
revoke all on public.bright_day_reports from anon;
grant select, insert, update, delete on public.bright_day_reports to authenticated;
alter table public.bright_day_reports enable row level security;
drop policy if exists "admin all bright_day_reports" on public.bright_day_reports;
create policy "admin all bright_day_reports" on public.bright_day_reports for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bright-day', 'bright-day', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
drop policy if exists "admin bright-day objects" on storage.objects;
create policy "admin bright-day objects" on storage.objects for all to authenticated
  using (bucket_id = 'bright-day' and public.is_portal_admin())
  with check (bucket_id = 'bright-day' and public.is_portal_admin());

-- ------------------------------------------------------------------
-- Closing agen: tampil di beranda (dibaca publik), diubah admin.
-- Flyer disimpan di bucket publik "closing-flyers".
-- ------------------------------------------------------------------
create table if not exists public.closings (
  id uuid primary key,
  closing_date date not null,
  created_at timestamptz not null default now(),
  data jsonb not null check (octet_length(data::text) <= 20000)
);
create index if not exists closings_date_idx on public.closings (closing_date);
grant select on public.closings to anon, authenticated;
grant insert, update, delete on public.closings to authenticated;
alter table public.closings enable row level security;
drop policy if exists "read closings" on public.closings;
create policy "read closings" on public.closings for select to anon, authenticated using (true);
drop policy if exists "admin all closings" on public.closings;
create policy "admin all closings" on public.closings for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('closing-flyers', 'closing-flyers', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
drop policy if exists "admin closing-flyers objects" on storage.objects;
create policy "admin closing-flyers objects" on storage.objects for all to authenticated
  using (bucket_id = 'closing-flyers' and public.is_portal_admin())
  with check (bucket_id = 'closing-flyers' and public.is_portal_admin());

-- Tahun lahir agen: terpisah dari agent_birthdays (publik) dan hanya bisa dibaca admin (BC WOF).
create table if not exists public.agent_birth_years (
  code text primary key check (code ~ '^[A-Z0-9]{2,12}$'),
  birth_year smallint not null check (birth_year between 1900 and 2100),
  updated_at timestamptz not null default now()
);
revoke all on public.agent_birth_years from anon;
grant select, insert, update, delete on public.agent_birth_years to authenticated;
alter table public.agent_birth_years enable row level security;
drop policy if exists "admin all agent_birth_years" on public.agent_birth_years;
create policy "admin all agent_birth_years" on public.agent_birth_years for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

-- Training: L/P untuk sapaan BC (Bapak/Ibu) & batch berikutnya yang diatur admin (satu baris).
alter table public.training_agents add column if not exists gender text check (gender is null or gender in ('L', 'P'));
create table if not exists public.training_batch (
  id smallint primary key default 1 check (id = 1),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  updated_at timestamptz not null default now()
);
revoke all on public.training_batch from anon, authenticated;
grant select, insert, update on public.training_batch to authenticated;
alter table public.training_batch enable row level security;
drop policy if exists "admin all training_batch" on public.training_batch;
create policy "admin all training_batch" on public.training_batch for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

-- ------------------------------------------------------------------
-- Gemini (edge function minbur-ai) & pengaturan portal.
-- portal_settings      : pengaturan kecil (mis. ucapan ulang tahun), dibaca semua, diubah admin.
-- content_translations : cache terjemahan ID → EN, hanya diakses edge function (service role).
-- minbur_unanswered.ai_answer : jawaban Gemini untuk ditinjau admin & dijadikan FAQ resmi.
-- ------------------------------------------------------------------
create table if not exists public.portal_settings (
  key text primary key check (char_length(key) between 1 and 60),
  value jsonb not null check (octet_length(value::text) <= 5000),
  updated_at timestamptz not null default now()
);
grant select on public.portal_settings to anon, authenticated;
grant insert, update, delete on public.portal_settings to authenticated;
alter table public.portal_settings enable row level security;
drop policy if exists "read portal_settings" on public.portal_settings;
create policy "read portal_settings" on public.portal_settings for select to anon, authenticated using (true);
drop policy if exists "admin all portal_settings" on public.portal_settings;
create policy "admin all portal_settings" on public.portal_settings for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

create table if not exists public.content_translations (
  hash text not null,
  lang text not null check (lang in ('en')),
  source text not null check (char_length(source) <= 2000),
  translated text not null check (char_length(translated) <= 4000),
  created_at timestamptz not null default now(),
  primary key (hash, lang)
);
revoke all on public.content_translations from anon, authenticated;
alter table public.content_translations enable row level security;

alter table public.minbur_unanswered add column if not exists ai_answer text
  check (ai_answer is null or char_length(ai_answer) <= 1500);

create or replace function public.record_minbur_ai_answer(p_question text, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := left(btrim(coalesce(p_question, '')), 200);
begin
  if char_length(v_q) < 1 then
    return;
  end if;
  if exists (select 1 from public.minbur_unanswered
             where lower(question) = lower(v_q) and asked_at > now() - interval '7 days') then
    return;
  end if;
  if (select count(*) from public.minbur_unanswered where asked_at > now() - interval '1 day') >= 300 then
    return;
  end if;
  insert into public.minbur_unanswered (question, ai_answer) values (v_q, left(p_answer, 1500));
end;
$$;
revoke all on function public.record_minbur_ai_answer(text, text) from public, anon, authenticated;
grant execute on function public.record_minbur_ai_answer(text, text) to service_role;

-- ------------------------------------------------------------------
-- Notes (catatan ala Google Keep, khusus admin).
-- Catatan di sampah tidak dihapus otomatis; hanya admin yang menghapus permanen.
-- ------------------------------------------------------------------
create table if not exists public.note_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  is_checklist boolean not null default false,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and octet_length(items::text) <= 50000),
  color text not null default 'default' check (char_length(color) <= 20),
  label_ids uuid[] not null default '{}',
  pinned boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived', 'trashed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_status_idx on public.notes (status, pinned, updated_at desc);
revoke all on public.note_labels, public.notes from anon;
grant select, insert, update, delete on public.note_labels, public.notes to authenticated;
alter table public.note_labels enable row level security;
alter table public.notes enable row level security;
drop policy if exists "admin all note_labels" on public.note_labels;
create policy "admin all note_labels" on public.note_labels for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin all notes" on public.notes;
create policy "admin all notes" on public.notes for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

-- ------------------------------------------------------------------
-- BC terjadwal (khusus admin): pesan WhatsApp yang dikirim admin dengan satu sentuhan
-- saat waktunya tiba. Notifikasi ke HP lewat Web Push (edge function bc-notify).
-- ------------------------------------------------------------------
create table if not exists public.bc_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  phone text check (phone is null or phone ~ '^[0-9]{8,16}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.bc_schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  message text not null default '' check (char_length(message) <= 6000),
  kind text not null default 'manual' check (kind in ('manual', 'training-reminder', 'training-group')),
  target_id uuid references public.bc_targets(id) on delete set null,
  next_at timestamptz not null,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  status text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  source_key text unique,
  notified_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bc_schedules_due_idx on public.bc_schedules (status, next_at);
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
revoke all on public.bc_targets, public.bc_schedules, public.push_subscriptions from anon;
grant select, insert, update, delete on public.bc_targets, public.bc_schedules, public.push_subscriptions to authenticated;
alter table public.bc_targets enable row level security;
alter table public.bc_schedules enable row level security;
alter table public.push_subscriptions enable row level security;
drop policy if exists "admin all bc_targets" on public.bc_targets;
create policy "admin all bc_targets" on public.bc_targets for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin all bc_schedules" on public.bc_schedules;
create policy "admin all bc_schedules" on public.bc_schedules for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "admin all push_subscriptions" on public.push_subscriptions;
create policy "admin all push_subscriptions" on public.push_subscriptions for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

-- ------------------------------------------------------------------
-- Closing Reward Booster (Agustus–Desember 2026): catatan klaim per agen per closing.
-- ------------------------------------------------------------------
create table if not exists public.closing_reward_claims (
  closing_id uuid not null references public.closings(id) on delete cascade,
  agent_key text not null check (char_length(agent_key) between 1 and 160),
  claimed_by text not null check (char_length(claimed_by) between 1 and 120),
  claimed_at date not null default ((now() at time zone 'Asia/Jakarta')::date),
  created_at timestamptz not null default now(),
  primary key (closing_id, agent_key)
);
revoke all on public.closing_reward_claims from anon;
grant select, insert, update, delete on public.closing_reward_claims to authenticated;
alter table public.closing_reward_claims enable row level security;
drop policy if exists "admin all closing_reward_claims" on public.closing_reward_claims;
create policy "admin all closing_reward_claims" on public.closing_reward_claims for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());

-- ------------------------------------------------------------------
-- Catatan pemakaian Gemini (ditulis edge function minbur-ai, dibaca admin di Analisis).
-- ------------------------------------------------------------------
create table if not exists public.ai_usage_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  mode text not null check (char_length(mode) <= 20),
  model text not null check (char_length(model) <= 80),
  status text not null check (status in ('ok', 'busy', 'rate_limit', 'timeout', 'error')),
  http_status int,
  duration_ms int,
  fallback boolean not null default false,
  question text check (question is null or char_length(question) <= 200)
);
create index if not exists ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
revoke all on public.ai_usage_log from anon, authenticated;
grant select on public.ai_usage_log to authenticated;
alter table public.ai_usage_log enable row level security;
drop policy if exists "admin read ai_usage_log" on public.ai_usage_log;
create policy "admin read ai_usage_log" on public.ai_usage_log for select to authenticated using (public.is_portal_admin());

-- ===================================================================
-- Pencapaian kantor di beranda (poster penghargaan). Terbaru di depan (period_end).
-- ===================================================================
create table if not exists public.achievements (
  id           text primary key default gen_random_uuid()::text,
  award        text not null check (char_length(trim(award)) between 3 and 80),
  title        text not null check (char_length(trim(title)) between 3 and 120),
  rank         text not null default '' check (char_length(rank) <= 20),
  period_label text not null default '' check (char_length(period_label) <= 60),
  period_end   date not null,
  -- Poster unggahan admin (data URL). NULL = poster bawaan aplikasi untuk id ini.
  photo_url    text check (photo_url is null or (photo_url like 'data:image/%' and char_length(photo_url) < 900000)),
  created_at   timestamptz not null default now()
);
alter table public.achievements enable row level security;
drop policy if exists "public read achievements" on public.achievements;
create policy "public read achievements" on public.achievements for select using (true);
drop policy if exists "admin write achievements" on public.achievements;
create policy "admin write achievements" on public.achievements for all to authenticated
  using (public.is_portal_admin()) with check (public.is_portal_admin());
grant select on public.achievements to anon, authenticated;
grant insert, update, delete on public.achievements to authenticated;
insert into public.achievements (id, award, title, rank, period_label, period_end)
select 'boc-awards-2026', 'BOC Awards 2026', 'TOP 15 Brighton HUB · Bisnis Tanpa Batas', '#12', 'Januari – Juni 2026', '2026-06-30'
where not exists (select 1 from public.achievements);
