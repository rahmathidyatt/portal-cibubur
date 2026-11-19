import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../floortime/spreadsheet';
import { birthdayReminders, birthdaysOn, parseBirthDate, parseBirthdayRows } from './birthdays';

test('format tanggal lahir yang didukung', () => {
  assert.deepEqual(parseBirthDate('15-Nov-79'), { month: 11, day: 15, year: 1979 });
  assert.deepEqual(parseBirthDate('4-Nov-76'), { month: 11, day: 4, year: 1976 });
  assert.deepEqual(parseBirthDate('6 Mei 1990'), { month: 5, day: 6, year: 1990 });
  assert.deepEqual(parseBirthDate('17 Agustus 1985'), { month: 8, day: 17, year: 1985 });
  assert.deepEqual(parseBirthDate('15/11/1979'), { month: 11, day: 15, year: 1979 });
  assert.deepEqual(parseBirthDate('1979-11-15'), { month: 11, day: 15, year: 1979 });
  assert.deepEqual(parseBirthDate('29221'), { month: 1, day: 1, year: 1980 }); // seri Excel 1980-01-01
  assert.deepEqual(parseBirthDate('15 Nov'), { month: 11, day: 15 });
  assert.equal(parseBirthDate('31-Nov-79'), null);
  assert.equal(parseBirthDate('abc'), null);
});

test('file ekspor contoh (14 agen November)', () => {
  const rows = parseCsv(readFileSync(new URL('./__fixtures__/export-november.csv', import.meta.url), 'utf8'));
  const { entries, skipped } = parseBirthdayRows(rows);
  assert.equal(entries.length, 14);
  assert.equal(skipped.length, 0);
  assert.ok(entries.every((e) => e.month === 11));
  assert.equal(entries[0].code, 'OGVA');
  assert.equal(entries[0].name, 'DIDIT (OGVA)');
  assert.deepEqual([entries[0].month, entries[0].day], [11, 1]);
  assert.equal(typeof entries[0].year, 'number');
});

test('baris bermasalah dilewati dengan alasan', () => {
  const { entries, skipped } = parseBirthdayRows([
    { Code: '', 'Nama Panggilan': 'BUDI (ABCD)', 'Tgl Lahir': '1-Jan-90' },
    { Code: 'XYZW', 'Nama Panggilan': 'SARI (XYZW)', 'Tgl Lahir': '??' },
    { Code: '', 'Nama Panggilan': '', 'Tgl Lahir': '' }
  ]);
  assert.equal(entries[0].code, 'ABCD');
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].line, 3);
});

test('pengingat H dan H-1, termasuk pergantian bulan dan 29 Februari', () => {
  const list = [
    { code: 'A', name: 'A', month: 11, day: 17 },
    { code: 'B', name: 'B', month: 11, day: 18 },
    { code: 'C', name: 'C', month: 12, day: 1 },
    { code: 'D', name: 'D', month: 2, day: 29 }
  ];
  const r = birthdayReminders(list, '2026-11-17');
  assert.deepEqual(r.today.map((b) => b.code), ['A']);
  assert.deepEqual(r.tomorrow.map((b) => b.code), ['B']);
  assert.deepEqual(birthdayReminders(list, '2026-11-30').tomorrow.map((b) => b.code), ['C']);
  assert.deepEqual(birthdaysOn(list, '2027-02-28').map((b) => b.code), ['D']);
  assert.deepEqual(birthdaysOn(list, '2028-02-28').map((b) => b.code), []);
  assert.deepEqual(birthdaysOn(list, '2028-02-29').map((b) => b.code), ['D']);
});
