-- Skema Supabase untuk Portal Brighton HUB Cibubur.
-- Jalankan seluruh file ini sekali di Supabase Dashboard → SQL Editor.
-- Aman dijalankan ulang (idempotent) untuk memperbarui fungsi & aturan.
--
-- Peran:
--   anon          = pengunjung portal (advisor). Boleh membaca data, membuat reservasi
--                   lewat fungsi create_*, dan membatalkan reservasinya sendiri dengan
--                   kode pembatalan (cancel_*).
--   authenticated = admin/staf kantor yang login (akun dibuat manual di
--                   Authentication → Users; matikan "Allow new users to sign up").

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
returns trigger language plpgsql as $$
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

create table if not exists public.office_documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 3 and 120),
  url        text not null check (url like 'https://%'),
  category   text not null default 'Lainnya',
  created_at timestamptz not null default now()
);

create table if not exists public.staff_status (
  staff_id   text primary key check (staff_id in ('staff-ops', 'staff-finance', 'staff-courier')),
  status     text not null check (status in ('Online', 'Sibuk', 'Di Luar Kantor')),
  detail     text not null default '' check (char_length(detail) <= 80),
  updated_at timestamptz not null default now()
);

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

revoke all on public.announcements, public.office_documents, public.staff_status from anon, authenticated;
grant select on public.announcements, public.office_documents, public.staff_status to anon, authenticated;
grant insert, update, delete on public.announcements, public.office_documents, public.staff_status to authenticated;

-- ===================================================================
-- Row Level Security
-- ===================================================================
alter table public.room_bookings enable row level security;
alter table public.floortime_registrations enable row level security;
alter table public.announcements enable row level security;
alter table public.office_documents enable row level security;
alter table public.staff_status enable row level security;

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
  for delete to authenticated using (true);

drop policy if exists "read floortime" on public.floortime_registrations;
create policy "read floortime" on public.floortime_registrations
  for select to anon, authenticated using (true);
drop policy if exists "admin delete floortime" on public.floortime_registrations;
create policy "admin delete floortime" on public.floortime_registrations
  for delete to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['announcements', 'office_documents', 'staff_status'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$I', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end;
$$;
