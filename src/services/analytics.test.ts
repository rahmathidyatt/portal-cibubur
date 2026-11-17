import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeViews } from './analytics';

test('ringkasan kunjungan memakai tanggal WIB', () => {
  const now = new Date('2026-11-17T06:00:00Z'); // 13.00 WIB
  const s = summarizeViews(
    [
      { v: 'a', at: '2026-11-16T18:00:00Z' }, // 17 Nov 01.00 WIB
      { v: 'a', at: '2026-11-17T05:00:00Z' },
      { v: 'b', at: '2026-11-17T05:30:00Z' },
      { v: 'b', at: '2026-11-10T03:00:00Z' },
      { v: 'c', at: '2026-10-01T03:00:00Z' }
    ],
    now
  );
  assert.equal(s.totalViews, 5);
  assert.equal(s.uniqueVisitors, 3);
  assert.equal(s.todayViews, 3);
  assert.equal(s.todayVisitors, 2);
  assert.equal(s.last7Views, 3);
  assert.equal(s.daily.length, 14);
  assert.equal(s.daily.at(-1)?.date, '2026-11-17');
  assert.equal(s.daily.find((d) => d.date === '2026-11-10')?.views, 1);
});
