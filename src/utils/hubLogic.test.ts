import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppChatUrl,
  bookConsultationRoomSlot,
  bookFloortimeShift
} from './hubLogic';
import {
  OFFICE_STAFF_CONTACTS,
  OFFICE_IDENTITY,
  WEEKLY_OFFICE_HOURS,
  INITIAL_DEALING_ROOMS,
  INITIAL_FLOORTIME_SHIFTS
} from '../data/cibuburData';

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

test('staff contacts show OPERASIONAL, FINANCE, MESSENGER with name and number', () => {
  assert.deepEqual(
    OFFICE_STAFF_CONTACTS.map((c) => [c.division, c.staffName, c.whatsappNumber]),
    [
      ['OPERASIONAL', 'Rahmat Hidayat (Amat)', '6282124962159'],
      ['FINANCE', 'Hania Sari (Hania)', '6287784865791'],
      ['MESSENGER', 'Apriansyah Ilyas (Apry)', '62895391196166']
    ]
  );
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

test('bookConsultationRoomSlot rejects booked and out-of-hours slots', () => {
  const rooms = INITIAL_DEALING_ROOMS.map((r) => ({
    ...r,
    slots: r.slots.map((slot) =>
      slot.time === '15:00 - 17:00' ? { ...slot, status: 'Di Luar Jam' as const } : slot
    )
  }));
  const outside = bookConsultationRoomSlot(rooms, 'dealing-room-1', '15:00 - 17:00', 'Clarissa', 'Diskusi KPR');
  assert.equal(outside.success, false);

  const first = bookConsultationRoomSlot(rooms, 'dealing-room-1', '08:00 - 10:00', 'Clarissa', 'Diskusi KPR');
  const second = bookConsultationRoomSlot(first.updatedRooms, 'dealing-room-1', '08:00 - 10:00', 'Hendra', 'Review PPJB');
  assert.equal(second.success, false);
  assert.match(second.error ?? '', /sudah terisi/);
});

test('bookFloortimeShift registers advisor up to quotaMax and prevents duplicates', () => {
  const res1 = bookFloortimeShift(INITIAL_FLOORTIME_SHIFTS, 'ft-pagi', 'Clarissa Tanoto', 'Kota Wisata');
  assert.equal(res1.success, true);
  assert.equal(res1.updatedShifts[0].registeredAdvisors.length, 1);

  const dup = bookFloortimeShift(res1.updatedShifts, 'ft-pagi', 'clarissa tanoto', 'Kota Wisata');
  assert.equal(dup.success, false);

  const r2 = bookFloortimeShift(res1.updatedShifts, 'ft-pagi', 'Hendra', 'Legenda Wisata');
  const r3 = bookFloortimeShift(r2.updatedShifts, 'ft-pagi', 'Nadia', 'CitraGran');
  const full = bookFloortimeShift(r3.updatedShifts, 'ft-pagi', 'Reza', 'Ruko');
  assert.equal(r3.updatedShifts[0].registeredAdvisors.length, 3);
  assert.equal(full.success, false);
  assert.match(full.error ?? '', /penuh/);
});
