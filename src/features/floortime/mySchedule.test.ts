import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, nextSlot, slotMinutes, slotsForAgentCode } from './mySchedule';
import type { ScheduleData, ShiftSlot } from './engine';

const slot = (date: string, shiftIndex: number, timeLabel: string): ShiftSlot => ({
  key: `${date}__${shiftIndex}`,
  weekNo: 1,
  date,
  weekday: 1,
  shiftIndex,
  shiftName: shiftIndex === 0 ? 'Pagi' : 'Siang',
  timeLabel,
  baseCapacity: 4
});

const s1 = slot('2026-11-17', 1, '12.30-17.00');
const s2 = slot('2026-11-19', 0, '08.00-12.30');
const data = {
  agents: [{ id: 'a1', name: 'RUDY', code: 'AUFZ', office: '', jobTitle: '', attendance: 0 }],
  slots: [s2, s1],
  assignments: {
    [s1.key]: [{ agentId: 'a1', displayName: 'RUDY (AUFZ)', isUrgent: false }],
    [s2.key]: [{ agentId: 'a1', displayName: 'RUDY (AUFZ)', isUrgent: false }]
  }
} as unknown as ScheduleData;

test('slot milik agen berdasarkan kode', () => {
  assert.deepEqual(slotsForAgentCode(data, 'aufz').map((s) => s.key), [s1.key, s2.key]);
  assert.deepEqual(slotsForAgentCode(data, 'XXXX'), []);
});

test('slot berikutnya', () => {
  const list = slotsForAgentCode(data, 'AUFZ');
  assert.equal(nextSlot(list, '2026-11-17', 13 * 60)?.key, s1.key);
  assert.equal(nextSlot(list, '2026-11-17', 17 * 60)?.key, s2.key);
  assert.equal(nextSlot(list, '2026-11-20', 0), null);
  assert.deepEqual(slotMinutes('11.30-15.00'), { start: 690, end: 900 });
});

test('file .ics memakai waktu UTC dari WIB', () => {
  const ics = buildIcs(slotsForAgentCode(data, 'AUFZ'), {
    agentName: 'RUDY (AUFZ)',
    location: 'Brighton HUB Cibubur',
    stamp: new Date('2026-11-17T00:00:00Z')
  });
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261117T053000Z/); // 12.30 WIB
  assert.match(ics, /DTEND:20261117T100000Z/);
  assert.match(ics, /DTSTART:20261119T010000Z/); // 08.00 WIB
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
  assert.match(ics, /X-WR-CALNAME:Floor Time RUDY \(AUFZ\)/);
});
