import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotal,
  DEFAULT_NOTA_CONFIG,
  exampleOnePoint,
  exampleTwoPoints,
  formatDateDisplay,
  formatNumberId,
  formatRupiah,
  sanitizeFilename
} from './notaCalc';

test('contoh 1 alamat: 18,8 KM × Rp900 + 1 titik × Rp5.000', () => {
  const ex = exampleOnePoint();
  const r = calculateTotal(ex.distanceKm, ex.jobs, DEFAULT_NOTA_CONFIG);
  assert.equal(r.jobCount, 1);
  assert.equal(r.bbmFee, 16_920);
  assert.equal(r.serviceFee, 5_000);
  assert.equal(r.total, 21_920);
  assert.equal(r.minimumApplied, false);
});

test('contoh 2 alamat: 50 KM × Rp900 + 2 titik', () => {
  const ex = exampleTwoPoints();
  const r = calculateTotal(ex.distanceKm, ex.jobs, DEFAULT_NOTA_CONFIG);
  assert.equal(r.total, 45_000 + 10_000);
});

test('tarif minimum BBM bila jarak < 10 KM', () => {
  const jobs = [{ alamat: 'Ruko CBB', tugas: 'Pasang Banner', keterangan: '' }];
  const r = calculateTotal(4, jobs, DEFAULT_NOTA_CONFIG);
  assert.equal(r.rawBbmFee, 3_600);
  assert.equal(r.bbmFee, 10_000);
  assert.ok(r.minimumApplied);
  assert.equal(calculateTotal(4, jobs, { ...DEFAULT_NOTA_CONFIG, enableMinimumBbm: false }).bbmFee, 3_600);
  // Tanpa titik pekerjaan, tarif minimum tidak berlaku.
  assert.equal(calculateTotal(4, [{ alamat: '', tugas: '', keterangan: '' }], DEFAULT_NOTA_CONFIG).bbmFee, 3_600);
});

test('format angka, tanggal, dan nama file', () => {
  assert.equal(formatRupiah(1_250_000), 'Rp 1.250.000');
  assert.equal(formatNumberId(18.8), '18,8');
  assert.equal(formatNumberId(50), '50');
  assert.equal(formatDateDisplay('2026-11-17'), '17-Nov-26');
  assert.equal(sanitizeFilename('17-Nov-26_RUDY S.'), '17-Nov-26_RUDY_S');
});
