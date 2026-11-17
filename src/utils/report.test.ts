import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportXlsx, c } from './report';
import { readXlsxGrid } from './xlsxGrid';
import { trainingReport } from '../features/training/trainingReport';
import { medproReport, dropReport } from '../features/medpro/medproReport';
import { importTrainingSheet, findTrainingSheet, agentStatus } from '../features/training/training';
import { importMedproSheet, findMedproSheet } from '../features/medpro/medpro';

test('Excel laporan: warna & angka terbaca kembali', async () => {
  const bytes = await buildReportXlsx([
    {
      name: 'Uji',
      doc: { title: 'Judul', tables: [{ columns: [{ label: 'A', width: 10 }, { label: 'B', width: 10 }], rows: [[c('x', { fill: '00FF00' }), c(1500, { money: true })]] }] }
    }
  ]);
  const [sheet] = await readXlsxGrid(bytes);
  assert.equal(sheet.name, 'Uji');
  assert.equal(sheet.cells.get('A1')?.value, 'Judul');
  assert.equal(sheet.cells.get('A4')?.fill, '00FF00');
  assert.equal(sheet.cells.get('B4')?.value, '1500');
});

test('ekspor training bisa diimpor ulang tanpa kehilangan status', async () => {
  const agents = [
    { id: '1', name: 'MARSEL (GFXY)', scores: Object.fromEntries(['bisnis-bersama', 'etika-pelayanan', 'tentang-bisnis', 'kebiasaan-sukses', 'listing-modal', 'primary-secondary', 'dokumen-kepemilikan', 'alur-transaksi', 'branding-expose', 'klien-percaya', 'negosiasi'].map((k) => [k, 80])), pending: {} },
    { id: '2', name: 'URIP (XJTA)', scores: { 'etika-pelayanan': 80 }, pending: { negosiasi: '2026-11-20' } },
    { id: '3', name: 'AISAH (UWVV)', scores: { 'bisnis-bersama': 40 }, pending: {} }
  ];
  const bytes = await buildReportXlsx([{ name: 'TRAINING', doc: trainingReport(agents, '18 Nov 2026') }]);
  const back = importTrainingSheet(findTrainingSheet(await readXlsxGrid(bytes))!).agents.map((a, i) => ({ ...a, id: String(i) }));
  assert.deepEqual(back.map((a) => [a.name, agentStatus(a)]), [
    ['MARSEL (GFXY)', 'lulus'],
    ['URIP (XJTA)', 'menunggu'],
    ['AISAH (UWVV)', 'belum']
  ]);
  assert.equal(back[2].scores['bisnis-bersama'], 40);
  assert.equal(back[1].scores['negosiasi'], undefined);
  assert.equal(back[1].scores['etika-pelayanan'], 80);
});

test('ekspor medpro bisa diimpor ulang (periode & tanda sesuai)', async () => {
  const notas = [
    { id: 'a', date: '2026-10-26', invoice: '022349/ASP/FP/X/2026', banner: 171000, branding: 0, checked: true, paidOn: '2026-11-13' },
    { id: 'b', date: '2026-11-10', invoice: '022589/ASP/FP/XI/2026', banner: 0, branding: 50000, checked: false, paidOn: null }
  ];
  const drops = [{ id: 'd', date: '2026-06-10', office: 'BALI', notaNo: '01K48F', amount: 14850, checked: true, paidOn: '2026-06-12' }];
  const bytes = await buildReportXlsx([
    { name: 'NOTA MEDPRO', doc: medproReport(notas, '2026-11-27', '18 Nov 2026') },
    { name: 'DROP BANNER', doc: dropReport(drops, '18 Nov 2026') }
  ]);
  const sheets = await readXlsxGrid(bytes);
  const r = importMedproSheet(findMedproSheet(sheets)!);
  assert.equal(r.notas.length, 2);
  const a = r.notas.find((n) => n.invoice === '022349/ASP/FP/X/2026')!;
  const b = r.notas.find((n) => n.invoice === '022589/ASP/FP/XI/2026')!;
  assert.equal(a.checked, true);
  assert.equal(a.banner, 171000);
  assert.ok(a.paidOn);
  assert.equal(b.paidOn, null);
  assert.equal(b.checked, false);
});
