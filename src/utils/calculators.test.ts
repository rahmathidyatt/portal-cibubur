import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKpr,
  calculateBphtb,
  calculatePphFinal,
  calculateCommission,
  kprMonthlyPayment,
  parseRupiahInput,
  formatRupiah
} from './calculators';

test('kprMonthlyPayment uses annuity formula', () => {
  // Rp 100 jt, 12%/tahun, 1 tahun -> ± Rp 8.884.879
  assert.equal(Math.round(kprMonthlyPayment(100_000_000, 12, 1)), 8_884_879);
  assert.equal(kprMonthlyPayment(120_000_000, 0, 10), 1_000_000);
  assert.equal(kprMonthlyPayment(0, 7, 15), 0);
});

test('calculateKpr splits DP and principal', () => {
  const r = calculateKpr(1_000_000_000, 20, 7.5, 15);
  assert.equal(r.downPayment, 200_000_000);
  assert.equal(r.principal, 800_000_000);
  assert.ok(r.monthly > 7_000_000 && r.monthly < 8_000_000);
  assert.ok(Math.abs(r.totalInterest - (r.totalPaid - r.principal)) < 1);
});

test('BPHTB, PPh final and commission', () => {
  assert.equal(calculateBphtb(1_000_000_000, 80_000_000), 46_000_000);
  assert.equal(calculateBphtb(50_000_000, 80_000_000), 0);
  assert.equal(calculatePphFinal(1_000_000_000), 25_000_000);
  assert.deepEqual(calculateCommission(1_000_000_000, 2.5, 50), {
    gross: 25_000_000,
    advisorShare: 12_500_000,
    officeShare: 12_500_000
  });
});

test('rupiah helpers', () => {
  assert.equal(parseRupiahInput('Rp 1.250.000.000'), 1_250_000_000);
  assert.equal(parseRupiahInput(''), 0);
  assert.match(formatRupiah(1_250_000), /1\.250\.000/);
});
