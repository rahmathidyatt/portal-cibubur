import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageLabel, summarizeViews } from './analytics';

test('ringkasan kunjungan per sesi, halaman, jam & perangkat (WIB)', () => {
  const now = new Date('2026-11-17T06:00:00Z'); // 13.00 WIB
  const s = summarizeViews(
    [
      { v: 'a', s: 's1', p: 'beranda', d: 'mobile', at: '2026-11-17T01:00:00Z' }, // 08.00 WIB
      { v: 'a', s: 's1', p: 'floortime', d: 'mobile', at: '2026-11-17T01:05:00Z' },
      { v: 'b', s: 's2', p: 'beranda', d: 'desktop', at: '2026-11-17T05:30:00Z' }, // 12.30 WIB
      { v: 'b', s: 's3', p: 'floortime', d: 'desktop', at: '2026-11-10T03:00:00Z' },
      { v: 'c', at: '2026-10-01T03:00:00Z' }
    ],
    now,
    14
  );
  assert.equal(s.totalViews, 4);
  assert.equal(s.uniqueVisitors, 3);
  assert.equal(s.todayViews, 2);
  assert.equal(s.todayVisitors, 2);
  assert.equal(s.rangeViews, 3);
  assert.equal(s.pageViews, 4);
  assert.deepEqual(s.topPages, [
    { path: 'beranda', views: 2 },
    { path: 'floortime', views: 2 }
  ]);
  assert.equal(s.hours[8], 1);
  assert.equal(s.hours[12], 1);
  assert.equal(s.devices.mobile, 1);
  assert.equal(s.devices.desktop, 2);
  assert.equal(s.daily.length, 14);
  assert.equal(s.daily.at(-1)?.views, 2);
});

test('rentang 7 hari dan pembanding periode sebelumnya', () => {
  const now = new Date('2026-11-17T06:00:00Z');
  const s = summarizeViews(
    [
      { v: 'a', s: 'x1', at: '2026-11-16T03:00:00Z' },
      { v: 'a', s: 'x2', at: '2026-11-08T03:00:00Z' },
      { v: 'a', s: 'x3', at: '2026-11-05T03:00:00Z' }
    ],
    now,
    7
  );
  assert.equal(s.rangeViews, 1);
  assert.equal(s.prevRangeViews, 2);
  assert.equal(s.daily.length, 7);
});

test('label halaman', () => {
  assert.equal(pageLabel('staf-nota'), 'Admin · Nota Messenger');
  assert.equal(pageLabel('lainnya'), 'lainnya');
});
