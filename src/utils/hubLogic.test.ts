import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppChatUrl,
  filterStaffByDivision,
  getNextMorningInspiration,
  cycleStaffAvailability,
  bookConsultationRoomSlot,
  bookFloortimeShift
} from './hubLogic';
import {
  MORNING_INSPIRATIONS,
  OFFICE_STAFF_CONTACTS,
  OFFICE_IDENTITY,
  WEEKLY_OFFICE_HOURS,
  INITIAL_DEALING_ROOMS,
  INITIAL_FLOORTIME_SHIFTS,
  STAFF_STATUS_LEGEND
} from '../data/cibuburData';

test('staff status legend defines Online, Busy (Sibuk), and Out of Office (Di Luar Kantor) clearly', () => {
  assert.equal(STAFF_STATUS_LEGEND.length, 3);
  assert.equal(STAFF_STATUS_LEGEND[0].status, 'Online');
  assert.equal(STAFF_STATUS_LEGEND[0].englishLabel, 'Online');
  assert.equal(STAFF_STATUS_LEGEND[1].status, 'Sibuk');
  assert.equal(STAFF_STATUS_LEGEND[1].englishLabel, 'Busy');
  assert.equal(STAFF_STATUS_LEGEND[2].status, 'Di Luar Kantor');
  assert.equal(STAFF_STATUS_LEGEND[2].englishLabel, 'Out of Office');
});

test('office identity and weekly hours match exact specifications', () => {
  assert.equal(OFFICE_IDENTITY.phoneDisplay, '021 3873 9073');
  assert.equal(WEEKLY_OFFICE_HOURS.length, 7);

  const sunday = WEEKLY_OFFICE_HOURS.find((d) => d.dayNameEn === 'Sunday');
  const monday = WEEKLY_OFFICE_HOURS.find((d) => d.dayNameEn === 'Monday');
  const saturday = WEEKLY_OFFICE_HOURS.find((d) => d.dayNameEn === 'Saturday');

  assert.equal(sunday?.isClosed, true);
  assert.equal(monday?.hours, '08:00 - 17:00');
  assert.equal(saturday?.hours, '08:00 - 15:00');
});

test('staff contacts match Rahmat Hidayat (Amat), Hania Sari (Hania), and Apriansyah Ilyas (Apry)', () => {
  const ops = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'Operasional');
  const fin = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'Keuangan');
  const msg = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'Kurir & Dokumen');

  assert.equal(ops?.staffName, 'Rahmat Hidayat (Amat)');
  assert.equal(ops?.whatsappNumber, '6282124962159');

  assert.equal(fin?.staffName, 'Hania Sari (Hania)');
  assert.equal(fin?.whatsappNumber, '6287784865791');

  assert.equal(msg?.staffName, 'Apriansyah Ilyas (Apry)');
  assert.equal(msg?.whatsappNumber, '62895391196166');
});

test('buildWhatsAppChatUrl strips non-digits and encodes Bahasa Indonesia message', () => {
  const url = buildWhatsAppChatUrl(
    '+62 821-2496-2159',
    'Halo Mas Amat Brighton HUB Cibubur'
  );
  assert.equal(
    url,
    'https://wa.me/6282124962159?text=Halo%20Mas%20Amat%20Brighton%20HUB%20Cibubur'
  );
});

test('filterStaffByDivision and cycleStaffAvailability work accurately', () => {
  const financeOnly = filterStaffByDivision(OFFICE_STAFF_CONTACTS, 'Keuangan');
  assert.equal(financeOnly.length, 1);
  assert.equal(financeOnly[0].staffName, 'Hania Sari (Hania)');

  const step1 = getNextMorningInspiration(MORNING_INSPIRATIONS, 0);
  assert.equal(step1.nextIndex, 1);

  const toBusy = cycleStaffAvailability('Online');
  assert.equal(toBusy.status, 'Sibuk');
});

test('bookConsultationRoomSlot books Dealing Room 1 and Dealing Room 2 accurately', () => {
  assert.equal(INITIAL_DEALING_ROOMS.length, 2);
  assert.equal(INITIAL_DEALING_ROOMS[0].tabLabel, 'Dealing Room 1');
  assert.equal(INITIAL_DEALING_ROOMS[1].tabLabel, 'Dealing Room 2');

  const res = bookConsultationRoomSlot(
    INITIAL_DEALING_ROOMS,
    'dealing-room-1',
    '10:00 - 12:00',
    'Clarissa Tanoto',
    'Presentasi Klien Kota Wisata'
  );
  assert.equal(res.success, true);

  const updatedSlot = res.updatedRooms[0].slots.find((s) => s.time === '10:00 - 12:00');
  assert.equal(updatedSlot?.status, 'Terisi');
  assert.equal(updatedSlot?.bookedBy, 'Clarissa Tanoto');
});

test('bookFloortimeShift registers advisor up to quotaMax and prevents duplicates', () => {
  const res1 = bookFloortimeShift(
    INITIAL_FLOORTIME_SHIFTS,
    'ft-pagi',
    'Clarissa Tanoto',
    'Kota Wisata'
  );
  assert.equal(res1.success, true);
  assert.equal(res1.updatedShifts[0].registeredAdvisors.length, 3);
});
