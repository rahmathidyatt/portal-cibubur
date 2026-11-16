-- Skema Supabase untuk Portal Brighton HUB Cibubur.
-- Jalankan sekali di Supabase Dashboard → SQL Editor, lalu isi
-- VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di file .env.

create table if not exists public.room_bookings (
  id           bigint generated always as identity primary key,
  room_id      text not null check (room_id in ('dealing-room-1', 'dealing-room-2')),
  booking_date date not null,
  slot_time    text not null,
  booked_by    text not null check (char_length(trim(booked_by)) between 2 and 80),
  agenda       text not null check (char_length(trim(agenda)) between 3 and 200),
  created_at   timestamptz not null default now(),
  -- Mencegah booking ganda pada ruang, tanggal, dan jam yang sama.
  unique (room_id, booking_date, slot_time)
);

create table if not exists public.floortime_registrations (
  id             bigint generated always as identity primary key,
  shift_id       text not null check (shift_id in ('ft-pagi', 'ft-siang', 'ft-sore')),
  booking_date   date not null,
  advisor_name   text not null check (char_length(trim(advisor_name)) between 2 and 80),
  corridor_focus text not null check (char_length(trim(corridor_focus)) between 2 and 80),
  created_at     timestamptz not null default now()
);

-- Satu advisor hanya boleh terdaftar sekali per sesi per tanggal.
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

-- Row Level Security: pengunjung (anon) hanya boleh membaca dan menambah data.
alter table public.room_bookings enable row level security;
alter table public.floortime_registrations enable row level security;

drop policy if exists "anon read room_bookings" on public.room_bookings;
create policy "anon read room_bookings" on public.room_bookings
  for select to anon using (true);
drop policy if exists "anon insert room_bookings" on public.room_bookings;
create policy "anon insert room_bookings" on public.room_bookings
  for insert to anon with check (booking_date >= (now() at time zone 'Asia/Jakarta')::date);

drop policy if exists "anon read floortime" on public.floortime_registrations;
create policy "anon read floortime" on public.floortime_registrations
  for select to anon using (true);
drop policy if exists "anon insert floortime" on public.floortime_registrations;
create policy "anon insert floortime" on public.floortime_registrations
  for insert to anon with check (booking_date >= (now() at time zone 'Asia/Jakarta')::date);
