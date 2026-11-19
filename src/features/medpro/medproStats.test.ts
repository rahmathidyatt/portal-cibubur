import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMedproStats, medproRecapSheets, shortRupiah } from './medproStats';

test('rekap medpro per bulan, pembayaran & drop', () => {
  const nota = (id: string, date: string, banner: number, branding: number, paidOn: string | null) => ({ id, date, invoice: `INV${id}-CIBUBUR`, banner, branding, checked: true, paidOn });
  const notas = [nota('1', '2026-11-02', 100000, 50000, '2026-11-13'), nota('2', '2026-11-20', 200000, 0, null), nota('3', '2025-12-01', 10000, 0, '2025-12-12')];
  const drops = [{ id: 'd', date: '2026-10-05', office: 'Bali', notaNo: 'D1', amount: 75000, checked: true, paidOn: '2026-11-13' }];
  const s = computeMedproStats(notas, drops, '2026');
  assert.deepEqual([s.notaCount, s.banner, s.branding, s.drop, s.total], [2, 300000, 50000, 75000, 425000]);
  assert.equal(s.timeline[10].count, 350000);
  assert.equal(s.timeline[9].count, 75000);
  assert.deepEqual(s.payments[0], { paidOn: '2026-11-13', notas: 1, drops: 1, total: 225000 });
  assert.deepEqual(s.dropByOffice, [{ label: 'BALI', count: 75000 }]);
  assert.deepEqual(computeMedproStats(notas, drops, '').timeline.map((t) => t.label), ['2025', '2026']);
  assert.equal(shortRupiah(1_250_000), '1,3 jt');
  assert.equal(medproRecapSheets(notas, drops, '', 'x').length, 4);
});
