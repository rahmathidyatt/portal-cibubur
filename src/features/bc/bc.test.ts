import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWibDateTime, isDue, nextOccurrence, normalizePhone, trainingSchedules, validateBc, waSendLink, wibIso, wibParts } from './bc';

test('waktu WIB', () => {
  const iso = wibIso('2026-11-23', '09.00');
  assert.equal(iso, '2026-11-23T02:00:00.000Z');
  assert.deepEqual(wibParts(iso), { date: '2026-11-23', time: '09:00' });
  assert.equal(formatWibDateTime(iso), 'Senin, 23 Nov 2026 · 09.00 WIB');
});

test('jadwal berulang melompati waktu yang sudah lewat', () => {
  const start = wibIso('2026-11-16', '08:00');
  const now = new Date(wibIso('2026-11-24', '10:00'));
  assert.equal(nextOccurrence(start, 'weekly', now), wibIso('2026-11-30', '08:00'));
  assert.equal(nextOccurrence(start, 'daily', now), wibIso('2026-11-25', '08:00'));
  assert.equal(nextOccurrence(start, 'none', now), null);
  assert.equal(nextOccurrence(wibIso('2026-01-31', '09:00'), 'monthly', new Date(wibIso('2026-02-01', '00:00'))), wibIso('2026-02-28', '09:00'));
});

test('BC jatuh tempo & tautan WA', () => {
  const now = new Date('2026-11-21T10:00:00Z');
  assert.equal(isDue({ status: 'active', nextAt: '2026-11-21T09:59:00Z' }, now), true);
  assert.equal(isDue({ status: 'done', nextAt: '2026-11-21T09:59:00Z' }, now), false);
  assert.equal(normalizePhone('0812-2496 2159'), '6281224962159');
  assert.equal(waSendLink('Halo & salam', '62812'), 'https://wa.me/62812?text=Halo%20%26%20salam');
  assert.equal(waSendLink('Hi'), 'https://wa.me/?text=Hi');
});

test('validasi & BC training otomatis', () => {
  const now = new Date('2026-11-21T10:00:00Z');
  const d = { title: 'Co-Broking', message: 'Halo', targetId: null, nextAt: '2026-11-20T00:00:00Z', repeat: 'none' as const };
  assert.match(validateBc(d, 'manual', now, true) ?? '', /belum lewat/);
  assert.equal(validateBc({ ...d, nextAt: '2026-11-22T00:00:00Z' }, 'manual', now, true), null);
  const t = trainingSchedules('2026-11-23');
  assert.equal(t[0].nextAt, wibIso('2026-11-20', '09:00'));
  assert.equal(t[1].nextAt, wibIso('2026-11-22', '17:00'));
  assert.equal(t[1].sourceKey, 'training:2026-11-23:group');
});
