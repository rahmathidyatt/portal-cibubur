import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officeAnniversary } from './anniversary';

const FOUNDED = '2023-05-06';

test('usia sebelum dan sesudah tanggal ulang tahun', () => {
  assert.equal(officeAnniversary(FOUNDED, '2026-05-05').age, 2);
  assert.equal(officeAnniversary(FOUNDED, '2026-11-17').age, 3);
});

test('hari H ulang tahun', () => {
  const a = officeAnniversary(FOUNDED, '2026-05-06');
  assert.equal(a.isToday, true);
  assert.equal(a.age, 3);
  assert.equal(a.nextAge, 3);
  assert.equal(a.daysUntil, 0);
});

test('tanggal berdiri bukan ulang tahun', () => {
  const a = officeAnniversary(FOUNDED, '2023-05-06');
  assert.equal(a.isToday, false);
  assert.equal(a.age, 0);
  assert.equal(a.nextDate, '2024-05-06');
});

test('hitung mundur ke ulang tahun berikutnya', () => {
  const a = officeAnniversary(FOUNDED, '2026-11-17');
  assert.equal(a.nextDate, '2027-05-06');
  assert.equal(a.nextAge, 4);
  assert.equal(a.daysUntil, 170);
});
