import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayInJakarta,
  dayIndexOfIsoDate,
  validateBookingDate,
  isWithinOfficeHours,
  getScheduleForDate,
  buildRoomsForDate,
  buildShiftsForDate,
  isShiftActiveOnDate,
  buildHoursSummary,
  getOfficeStatus,
  formatLongDateId,
  greetingForMinutes
} from './schedule';
import {
  WEEKLY_OFFICE_HOURS,
  INITIAL_DEALING_ROOMS,
  INITIAL_FLOORTIME_SHIFTS
} from '../data/cibuburData';

// 2026-11-16 = Senin, 2026-11-21 = Sabtu, 2026-11-22 = Minggu
const MONDAY = '2026-11-16';
const SATURDAY = '2026-11-21';
const SUNDAY = '2026-11-22';

test('todayInJakarta uses WIB, not the browser timezone', () => {
  // 2026-11-16 18:30 UTC = 2026-11-17 01:30 WIB
  assert.equal(todayInJakarta(new Date('2026-11-16T18:30:00Z')), '2026-11-17');
  assert.equal(dayIndexOfIsoDate(MONDAY), 1);
  assert.equal(dayIndexOfIsoDate(SUNDAY), 0);
});

test('validateBookingDate blocks past dates, Sundays and invalid input', () => {
  assert.equal(validateBookingDate(MONDAY, MONDAY, WEEKLY_OFFICE_HOURS), null);
  assert.match(validateBookingDate('2026-11-10', MONDAY, WEEKLY_OFFICE_HOURS) ?? '', /lewat/);
  assert.match(validateBookingDate(SUNDAY, MONDAY, WEEKLY_OFFICE_HOURS) ?? '', /tutup/);
  assert.match(validateBookingDate('', MONDAY, WEEKLY_OFFICE_HOURS) ?? '', /tidak valid/);
});

test('isWithinOfficeHours respects Saturday closing at 15:00', () => {
  const sat = getScheduleForDate(SATURDAY, WEEKLY_OFFICE_HOURS);
  assert.equal(isWithinOfficeHours('13:00 - 15:00', sat), true);
  assert.equal(isWithinOfficeHours('15:00 - 17:00', sat), false);
});

test('buildRoomsForDate marks bookings per date and out-of-hours slots', () => {
  const bookings = [
    { id: 'b1', roomId: 'dealing-room-1' as const, date: MONDAY, slotTime: '08:00 - 10:00', bookedBy: 'Hendra', agenda: 'Review PPJB' }
  ];
  const monday = buildRoomsForDate(INITIAL_DEALING_ROOMS, bookings, MONDAY, WEEKLY_OFFICE_HOURS);
  assert.equal(monday[0].slots[0].status, 'Terisi');
  assert.equal(monday[0].slots[0].bookedBy, 'Hendra');
  assert.equal(monday[1].slots[0].status, 'Tersedia');

  // Booking hari Senin tidak ikut membuat slot hari lain terisi.
  const saturday = buildRoomsForDate(INITIAL_DEALING_ROOMS, bookings, SATURDAY, WEEKLY_OFFICE_HOURS);
  assert.equal(saturday[0].slots[0].status, 'Tersedia');
  assert.equal(saturday[0].slots[3].status, 'Di Luar Jam');
});

test('floortime shifts follow active days and per-date registrations', () => {
  const sore = INITIAL_FLOORTIME_SHIFTS.find((s) => s.id === 'ft-sore')!;
  assert.equal(isShiftActiveOnDate(sore, MONDAY), true);
  assert.equal(isShiftActiveOnDate(sore, SATURDAY), false);

  const regs = [
    { id: 'r1', shiftId: 'ft-pagi', date: MONDAY, advisorName: 'Nadia', corridorFocus: 'Legenda Wisata' },
    { id: 'r2', shiftId: 'ft-pagi', date: SATURDAY, advisorName: 'Reza', corridorFocus: 'Ruko' }
  ];
  const shifts = buildShiftsForDate(INITIAL_FLOORTIME_SHIFTS, regs, MONDAY);
  assert.deepEqual(shifts[0].registeredAdvisors, [
    { registrationId: 'r1', advisorName: 'Nadia', corridorFocus: 'Legenda Wisata' }
  ]);
});

test('buildHoursSummary groups days with the same hours', () => {
  assert.equal(
    buildHoursSummary(WEEKLY_OFFICE_HOURS),
    'Senin – Jumat: 08:00 – 17:00 WIB · Sabtu: 08:00 – 15:00 WIB · Minggu: Tutup'
  );
});

test('getOfficeStatus follows WIB office hours', () => {
  // Senin 2026-11-16 10:00 WIB = 03:00 UTC
  assert.deepEqual(getOfficeStatus(WEEKLY_OFFICE_HOURS, new Date('2026-11-16T03:00:00Z')), {
    isOpen: true,
    label: 'Buka · tutup pukul 17:00'
  });
  // Senin 07:00 WIB
  assert.equal(
    getOfficeStatus(WEEKLY_OFFICE_HOURS, new Date('2026-11-16T00:00:00Z')).label,
    'Tutup · buka hari ini pukul 08:00'
  );
  // Sabtu 16:00 WIB -> Minggu tutup -> buka hari Senin
  assert.equal(
    getOfficeStatus(WEEKLY_OFFICE_HOURS, new Date('2026-11-21T09:00:00Z')).label,
    'Tutup · buka hari Senin pukul 08:00'
  );
  // Senin 18:00 WIB -> besok
  assert.equal(
    getOfficeStatus(WEEKLY_OFFICE_HOURS, new Date('2026-11-16T11:00:00Z')).label,
    'Tutup · buka besok pukul 08:00'
  );
  assert.equal(formatLongDateId('2026-11-17'), 'Selasa, 17 November 2026');
  assert.equal(greetingForMinutes(7 * 60), 'Selamat pagi');
});

test('buildRoomsForDate marks past slots when nowMinutes is given', () => {
  // 12:30 WIB: 08:00-10:00 dan 10:00-12:00 sudah lewat
  const rooms = buildRoomsForDate(INITIAL_DEALING_ROOMS, [], MONDAY, WEEKLY_OFFICE_HOURS, 12 * 60 + 30);
  assert.deepEqual(
    rooms[0].slots.map((s) => s.status),
    ['Sudah Lewat', 'Sudah Lewat', 'Tersedia', 'Tersedia']
  );
});
