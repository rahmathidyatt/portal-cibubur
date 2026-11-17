import type {
  DealingRoom,
  FloortimeSlot,
  OfficeDaySchedule
} from '../data/cibuburData';

/** Data reservasi Dealing Room yang disimpan (localStorage / Supabase). */
export interface RoomBooking {
  id: string;
  roomId: DealingRoom['id'];
  date: string; // YYYY-MM-DD
  slotTime: string;
  bookedBy: string;
  agenda: string;
}

/** Data pendaftaran floortime yang disimpan (localStorage / Supabase). */
export interface FloortimeRegistration {
  id: string;
  shiftId: string;
  date: string; // YYYY-MM-DD
  advisorName: string;
  corridorFocus: string;
}

const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu WIB. */
export function todayInJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/** 0 = Minggu ... 6 = Sabtu, tanpa terpengaruh zona waktu browser. */
export function dayIndexOfIsoDate(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getScheduleForDate(
  isoDate: string,
  weeklyHours: OfficeDaySchedule[]
): OfficeDaySchedule | undefined {
  if (!ISO_DATE.test(isoDate)) return undefined;
  const dayId = DAY_IDS[dayIndexOfIsoDate(isoDate)];
  return weeklyHours.find((d) => d.dayId === dayId);
}

/** Validasi tanggal reservasi: format benar, tidak lampau, dan kantor buka. */
export function validateBookingDate(
  isoDate: string,
  today: string,
  weeklyHours: OfficeDaySchedule[]
): string | null {
  const schedule = getScheduleForDate(isoDate, weeklyHours);
  if (!schedule) {
    return 'Tanggal reservasi tidak valid.';
  }
  if (isoDate < today) {
    return 'Tanggal sudah lewat. Silakan pilih hari ini atau tanggal berikutnya.';
  }
  if (schedule.isClosed) {
    return `Kantor tutup pada hari ${schedule.dayNameId}. Silakan pilih hari lain.`;
  }
  return null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.trim().split(':').map(Number);
  return h * 60 + m;
}

/** Mengurai "08:00 - 17:00" (boleh diakhiri "WIB") menjadi menit mulai & selesai. */
export function parseTimeRange(
  range: string
): { start: number; end: number } | null {
  const match = range.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  return { start: toMinutes(match[1]), end: toMinutes(match[2]) };
}

/** Slot berada penuh di dalam jam buka kantor pada hari tersebut. */
export function isWithinOfficeHours(
  slotTime: string,
  schedule: OfficeDaySchedule | undefined
): boolean {
  if (!schedule || schedule.isClosed) return false;
  const slot = parseTimeRange(slotTime);
  const office = parseTimeRange(schedule.hours);
  if (!slot || !office) return false;
  return slot.start >= office.start && slot.end <= office.end;
}

/** Menyusun status slot Dealing Room untuk satu tanggal dari data reservasi. */
export function buildRoomsForDate(
  roomTemplates: DealingRoom[],
  bookings: RoomBooking[],
  isoDate: string,
  weeklyHours: OfficeDaySchedule[],
  /** Isi menit-sekarang (WIB) bila isoDate = hari ini, agar slot yang sudah lewat ditandai. */
  nowMinutes?: number
): DealingRoom[] {
  const schedule = getScheduleForDate(isoDate, weeklyHours);
  return roomTemplates.map((room) => ({
    ...room,
    slots: room.slots.map((slot) => {
      const booking = bookings.find(
        (b) =>
          b.roomId === room.id && b.date === isoDate && b.slotTime === slot.time
      );
      if (booking) {
        return {
          time: slot.time,
          status: 'Terisi' as const,
          bookingId: booking.id,
          bookedBy: booking.bookedBy,
          agenda: booking.agenda
        };
      }
      if (!isWithinOfficeHours(slot.time, schedule)) {
        return { time: slot.time, status: 'Di Luar Jam' as const };
      }
      const range = parseTimeRange(slot.time);
      if (nowMinutes !== undefined && range && range.end <= nowMinutes) {
        return { time: slot.time, status: 'Sudah Lewat' as const };
      }
      return { time: slot.time, status: 'Tersedia' as const };
    })
  }));
}

export function isShiftActiveOnDate(shift: FloortimeSlot, isoDate: string): boolean {
  if (!ISO_DATE.test(isoDate)) return false;
  return shift.activeDays.includes(dayIndexOfIsoDate(isoDate));
}

/** Menyusun daftar advisor per sesi floortime untuk satu tanggal. */
export function buildShiftsForDate(
  shiftTemplates: FloortimeSlot[],
  registrations: FloortimeRegistration[],
  isoDate: string
): FloortimeSlot[] {
  return shiftTemplates.map((shift) => ({
    ...shift,
    registeredAdvisors: registrations
      .filter((r) => r.shiftId === shift.id && r.date === isoDate)
      .map((r) => ({
        registrationId: r.id,
        advisorName: r.advisorName,
        corridorFocus: r.corridorFocus
      }))
  }));
}

const DAY_ORDER_MON_FIRST = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Ringkasan jam buka dari WEEKLY_OFFICE_HOURS, contoh:
 * "Senin – Jumat: 08:00 – 17:00 WIB · Sabtu: 08:00 – 15:00 WIB · Minggu: Tutup"
 */
export function buildHoursSummary(weeklyHours: OfficeDaySchedule[]): string {
  const ordered = DAY_ORDER_MON_FIRST.map((id) =>
    weeklyHours.find((d) => d.dayId === id)
  ).filter((d): d is OfficeDaySchedule => Boolean(d));

  const groups: { from: OfficeDaySchedule; to: OfficeDaySchedule; key: string }[] = [];
  for (const day of ordered) {
    const key = day.isClosed ? 'closed' : day.hours;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.to = day;
    } else {
      groups.push({ from: day, to: day, key });
    }
  }

  return groups
    .map((g) => {
      const label =
        g.from === g.to ? g.from.dayNameId : `${g.from.dayNameId} – ${g.to.dayNameId}`;
      const value =
        g.key === 'closed' ? 'Tutup' : `${g.key.replace(' - ', ' – ')} WIB`;
      return `${label}: ${value}`;
    })
    .join(' · ');
}

/** Jam & menit saat ini di WIB (menit sejak 00:00). */
export function minutesNowInJakarta(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function greetingForMinutes(minutes: number): string {
  if (minutes < 11 * 60) return 'Selamat pagi';
  if (minutes < 15 * 60) return 'Selamat siang';
  if (minutes < 18 * 60) return 'Selamat sore';
  return 'Selamat malam';
}

/** Contoh: "Selasa, 17 November 2026" */
export function formatLongDateId(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatMinutes(total: number): string {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export interface OfficeStatus {
  isOpen: boolean;
  /** Contoh: "Buka · tutup pukul 17:00" atau "Tutup · buka besok pukul 08:00" */
  label: string;
}

/** Status buka/tutup kantor saat ini berdasarkan jam WIB. */
export function getOfficeStatus(
  weeklyHours: OfficeDaySchedule[],
  now: Date = new Date()
): OfficeStatus {
  const today = todayInJakarta(now);
  const minutes = minutesNowInJakarta(now);
  const todaySchedule = getScheduleForDate(today, weeklyHours);
  const todayRange =
    todaySchedule && !todaySchedule.isClosed ? parseTimeRange(todaySchedule.hours) : null;

  if (todayRange && minutes >= todayRange.start && minutes < todayRange.end) {
    return { isOpen: true, label: `Buka · tutup pukul ${formatMinutes(todayRange.end)}` };
  }
  if (todayRange && minutes < todayRange.start) {
    return {
      isOpen: false,
      label: `Tutup · buka hari ini pukul ${formatMinutes(todayRange.start)}`
    };
  }

  for (let offset = 1; offset <= 7; offset++) {
    const date = addDays(today, offset);
    const schedule = getScheduleForDate(date, weeklyHours);
    const range = schedule && !schedule.isClosed ? parseTimeRange(schedule.hours) : null;
    if (schedule && range) {
      const when = offset === 1 ? 'besok' : `hari ${schedule.dayNameId}`;
      return {
        isOpen: false,
        label: `Tutup · buka ${when} pukul ${formatMinutes(range.start)}`
      };
    }
  }
  return { isOpen: false, label: 'Tutup' };
}

/** Jam istirahat staf (WIB): 12.00–13.00 pada hari kantor buka. */
export const BREAK_START = 12 * 60;
export const BREAK_END = 13 * 60;

export function isStaffBreak(status: OfficeStatus, minutes: number): boolean {
  return status.isOpen && minutes >= BREAK_START && minutes < BREAK_END;
}
