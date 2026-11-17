import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekday, repeatLabel } from './recurringAnnouncements';

test('label pengumuman berulang (Senin)', () => {
  assert.equal(isoWeekday('2026-11-23'), 1);
  assert.equal(isoWeekday('2026-11-22'), 7);
  assert.deepEqual(repeatLabel(1, '2026-11-23'), { label: 'Hari ini', isToday: true });
  assert.deepEqual(repeatLabel(1, '2026-11-22'), { label: 'Besok', isToday: false });
  assert.deepEqual(repeatLabel(1, '2026-11-18'), { label: 'Setiap Senin', isToday: false });
  assert.deepEqual(repeatLabel(5, '2026-11-19'), { label: 'Besok', isToday: false });
});
