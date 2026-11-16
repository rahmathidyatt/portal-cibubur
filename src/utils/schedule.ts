import type {
  DealingRoom,
  FloortimeSlot,
  OfficeDaySchedule
} from '../data/cibuburData';

/** Data reservasi Dealing Room yang disimpan (localStorage / Supabase). */
export interface RoomBooking {
  roomId: DealingRoom['id'];
  date: string; // YYYY-MM-DD
  slotTime: string;
  bookedBy: string;
  agenda: string;
}

/** Data pendaftaran floortime yang disimpan (localStorage / Supabase). */
export interface FloortimeRegistration {
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
  weeklyHours: OfficeDaySchedule[]
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
          bookedBy: booking.bookedBy,
          agenda: booking.agenda
        };
      }
      if (!isWithinOfficeHours(slot.time, schedule)) {
        return { time: slot.time, status: 'Di Luar Jam' as const };
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
      .map((r) => ({ advisorName: r.advisorName, corridorFocus: r.corridorFocus }))
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
