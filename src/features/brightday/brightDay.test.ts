import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyChoice,
  daysLeft,
  defaultChecks,
  formatCost,
  formatCount,
  formatEventDate,
  formatEventTime,
  isExpired,
  missingFields,
  newReport,
  pdfFileName
} from './brightDay';

test('format sesuai contoh laporan', () => {
  assert.equal(formatEventDate('2026-11-02'), '02 November 2026');
  assert.equal(formatEventTime('14:00'), '14.00 WIB');
  assert.equal(formatEventTime('9.30'), '09.30 WIB');
  assert.equal(formatCost('70000'), 'Rp. 70.000');
  assert.equal(formatCost('220.000'), 'Rp. 220.000');
  assert.equal(formatCost(''), '-');
  assert.equal(formatCount(''), '-');
  assert.equal(pdfFileName({ eventDate: '2026-11-02' }), '02 November 2026 - Brighton HUB Cibubur.pdf');
});

test('centang bawaan & pilihan finance/konsumsi', () => {
  const c = defaultChecks(true, 'a');
  assert.equal(c.proyektor, true);
  assert.equal(c['pengajuan-finance'], true);
  assert.equal(c.reimburse, false);
  assert.equal(c['konsumsi-b'], false);
  let r = newReport('x', '2026-11-19T00:00:00Z');
  r = { ...r, checks: { ...r.checks, survey: false } };
  r = applyChoice(r, { finance: false });
  assert.equal(r.checks['pengajuan-finance'], false);
  assert.equal(r.checks.reimburse, true);
  assert.equal(r.checks.survey, false, 'centang manual lain tidak berubah');
  r = applyChoice(r, { konsumsi: 'c' });
  assert.deepEqual([r.checks['konsumsi-a'], r.checks['konsumsi-c']], [false, true]);
});

test('wajib isi & masa simpan 7 hari', () => {
  const r = newReport('x', '2026-11-12T05:00:00Z');
  assert.deepEqual(missingFields(r), ['Host', 'Narasumber', 'Tanggal acara', 'Waktu acara']);
  assert.equal(isExpired(r.createdAt, new Date('2026-11-19T04:59:00Z')), false);
  assert.equal(isExpired(r.createdAt, new Date('2026-11-19T05:00:00Z')), true);
  assert.equal(daysLeft('2026-11-18T05:00:00Z', new Date('2026-11-19T05:00:00Z')), 6);
});

import { attendanceDateLine, attendanceFileName } from './attendance';

test('daftar hadir: hari & tanggal', () => {
  assert.equal(attendanceDateLine('2026-09-16'), '(RABU, 16 SEPTEMBER 2026)');
  assert.equal(attendanceDateLine('2026-11-02'), '(SENIN, 2 NOVEMBER 2026)');
  assert.equal(attendanceFileName('pa', '2026-09-16'), 'Daftar Hadir PA Bright Day - 16 September 2026.pdf');
});
