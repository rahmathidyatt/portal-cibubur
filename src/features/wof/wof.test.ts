import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Closing } from '../closing/closing';
import { buildWofBc, findWofClaims } from './wof';

const birthdays = [
  { code: 'HVJJ', name: 'WIWIN', month: 10, day: 28 },
  { code: 'AYBK', name: 'ERVA', month: 10, day: 26 },
  { code: 'XFDL', name: 'IMELDA', month: 3, day: 2 }
];
const ag = (name: string, code: string, role: 'S' | 'PL' = 'S') => ({ role, name, unit: 'Brighton Warrior', area: 'Cibubur, Bogor', code });
const closings: Closing[] = [
  { id: '2', date: '2026-10-08', type: 'Sewa Menyewa', location: 'Vila Nusa Indah', agents: [ag('Erva', '')], flyers: [], createdAt: '2' },
  { id: '1', date: '2026-10-05', type: 'Sewa Menyewa', location: 'Premier Savanna', agents: [ag('Wiwin', 'HVJJ'), ag('Imelda', 'XFDL')], flyers: [], createdAt: '1' },
  { id: '3', date: '2026-10-09', type: 'Primary', location: 'Harvest City', agents: [ag('Budi', ''), ag('Wiwin', 'HVJJ', 'PL')], flyers: [], createdAt: '3' },
  { id: '4', date: '2026-11-02', type: 'Jual Beli', location: 'Kota Wisata', agents: [ag('Wiwin', 'HVJJ')], flyers: [], createdAt: '4' }
];

test('WOF: closing di bulan ulang tahun (bukan Project Leader)', () => {
  const claims = findWofClaims(closings, birthdays, '2026-10');
  assert.deepEqual(claims.map((c) => c.code), ['HVJJ', 'AYBK']);
  assert.equal(
    buildWofBc(claims),
    [
      'Klaim wheel of fortune',
      'Nama & Kode PA: WIWIN (HVJJ)',
      'Tanggal Ulang Tahun: 28 Oct',
      'Alamat Transaksi: Sewa Menyewa – PREMIER SAVANNA',
      'Tanggal Transaksi: 05 Oktober 2026',
      '',
      'Nama & Kode PA: ERVA (AYBK)',
      'Tanggal Ulang Tahun: 26 Oct',
      'Alamat Transaksi: Sewa Menyewa – VILA NUSA INDAH',
      'Tanggal Transaksi: 08 Oktober 2026'
    ].join('\n')
  );
  assert.equal(findWofClaims(closings, birthdays, '2026-11').length, 0);
  const withYear = findWofClaims(closings, [{ ...birthdays[0], year: 1986 }], '2026-10');
  assert.match(buildWofBc(withYear), /Tanggal Ulang Tahun: 28 Oct 1986/);
  const coded = findWofClaims(closings, [{ ...birthdays[0], name: 'WIWIN (HVJJ)' }], '2026-10');
  assert.match(buildWofBc(coded), /Nama & Kode PA: WIWIN \(HVJJ\)\n/);
});
