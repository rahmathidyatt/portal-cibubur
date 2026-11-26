import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GridCell, GridSheet } from '../../utils/xlsxGrid';
import {
  adjustedPayday,
  buildDropBc,
  buildPaymentBc,
  importMedproSheet,
  invoiceBr,
  invoiceFormatWarning,
  nextPayday,
  parseLooseDate,
  parseRupiah,
  summarize,
  validateNotaInput,
  type MedproNota
} from './medpro';

test('INVOICE BR = nomor nota + -CIBUBUR', () => {
  assert.equal(invoiceBr('022589/ASP/FP/XI/2026'), '022589-CIBUBUR');
  assert.equal(invoiceBr(' 020777/ASP/SJ/ IX/2026 '), '020777-CIBUBUR');
  assert.equal(invoiceFormatWarning('022589/ASP/FP/XI/2026'), null);
  assert.ok(invoiceFormatWarning('019544/ASP/SJVIII/2026'));
});

test('validasi input nota', () => {
  const ok = { date: '2026-11-17', invoice: '022589/ASP/FP/XI/2026', banner: 118000, branding: 0 };
  assert.equal(validateNotaInput(ok), null);
  assert.match(validateNotaInput({ ...ok, invoice: '' }) ?? '', /wajib/);
  assert.match(validateNotaInput({ ...ok, banner: 0 }) ?? '', /nominal/);
  assert.equal(parseRupiah('Rp 1.250.000'), 1250000);
});

test('jadwal bayar 14 & 28, Sabtu/Minggu dimajukan ke Jumat', () => {
  assert.equal(adjustedPayday(2026, 11, 14), '2026-11-13'); // Sabtu
  assert.equal(adjustedPayday(2026, 11, 28), '2026-11-27'); // Sabtu
  assert.equal(adjustedPayday(2026, 6, 14), '2026-06-12'); // Minggu
  assert.equal(adjustedPayday(2026, 10, 14), '2026-10-14'); // Rabu
  assert.equal(nextPayday('2026-11-17'), '2026-11-27');
  assert.equal(nextPayday('2026-11-27'), '2026-11-27');
  assert.equal(nextPayday('2026-11-28'), '2026-12-14');
  assert.equal(nextPayday('2026-12-29'), '2027-01-14');
});

const nota = (invoice: string, banner: number, branding: number, date = '2026-11-10'): MedproNota => ({
  id: invoice,
  date,
  invoice,
  banner,
  branding,
  checked: true,
  paidOn: null
});

test('BC pembayaran sesuai format', () => {
  const list = [
    nota('018374/ASP/SJ/VII/2026', 100000, 0),
    nota('018368/ASP/SJ/VII/2026', 0, 20000),
    nota('018425/ASP/SJ/VII/2026', 50000, 25000, '2026-11-11')
  ];
  assert.equal(
    buildPaymentBc(list),
    'INVOICE PEMBAYARAN BANNER BRIGHTON CIBUBUR\n\n018374/ASP/SJ/VII/2026\n018425/ASP/SJ/VII/2026\n\n' +
      'INVOICE PEMBAYARAN ALAT BRANDING BRIGHTON CIBUBUR\n\n018368/ASP/SJ/VII/2026\n018425/ASP/SJ/VII/2026'
  );
  assert.equal(buildPaymentBc([list[0]]), 'INVOICE PEMBAYARAN BANNER BRIGHTON CIBUBUR\n\n018374/ASP/SJ/VII/2026');
  assert.deepEqual(summarize(list), { count: 3, checked: 3, banner: 150000, branding: 45000, total: 195000 });
  assert.equal(
    buildDropBc([{ id: '1', date: '2026-06-10', office: 'BALI', notaNo: '01K48F', amount: 14850, checked: true, paidOn: null }]),
    'INVOICE PEMBAYARAN DROP BANNER BRIGHTON CIBUBUR\n\n01K48F (BALI)'
  );
});

test('tanggal longgar dari rekap', () => {
  assert.deepEqual(parseLooseDate('11 AGUSTUS', { year: 2026, month: 0 }), { date: '2026-08-11', rest: '' });
  assert.deepEqual(parseLooseDate('26 AGUTUS', { year: 2026, month: 0 }), { date: '2026-08-26', rest: '' });
  assert.deepEqual(parseLooseDate('18 DROP HI', { year: 2026, month: 8 }), { date: '2026-08-18', rest: 'DROP HI' });
  assert.deepEqual(parseLooseDate('10 JUNI DROP BALI', { year: 2026, month: 0 }), { date: '2026-06-10', rest: 'DROP BALI' });
  assert.equal(parseLooseDate('2026-09-10', null)?.date, '2026-09-10');
});

test('impor rekap: tiap tabel = periode, tabel terakhir = periode berjalan, hijau = sesuai', () => {
  const cells = new Map<string, GridCell>();
  const put = (ref: string, value: string, fill: string | null = null, isDate = false) =>
    cells.set(ref, { value, fill, isDate });
  for (const [col, hdr] of [
    ['A', 'TANGGAL'],
    ['B', 'INVOICE BR'],
    ['C', 'INVOICE'],
    ['D', 'BANNER/PLANK'],
    ['E', 'ALAT BRANDING'],
    ['F', 'TOTAL']
  ]) {
    put(`${col}3`, hdr);
    put(`${col}11`, hdr);
  }
  put('A4', '26 oktober');
  put('B4', '022349-CIBUBUR', '00FF00');
  put('C4', '022349/ASP/FP/X/2026');
  put('D4', '171000');
  put('B5', '022346-CIBUBUR', '00FF00');
  put('C5', '022346/ASP/FP/X/2026');
  put('E5', '50000');
  put('A6', 'TOTAL TAGIHAN', 'FFB3B3');
  put('A12', '2026-11-10', null, true);
  put('B12', '022589-CIBUBUR');
  put('C12', '022589/ASP/FP/XI/2026');
  put('E12', '50000');
  put('W12', '10 JUNI DROP BALI');
  put('X12', '01K48F', '00FF00');
  put('Y12', '14850');
  const sheet: GridSheet = { name: 'NEW MEDPRO', cells, maxRow: 13, maxCol: 25 };
  const r = importMedproSheet(sheet);
  assert.equal(r.periods, 2);
  assert.equal(r.notas.length, 3);
  const [a, b, c] = r.notas;
  assert.equal(a.date, '2026-10-26');
  assert.equal(b.date, '2026-10-26');
  assert.equal(a.paidOn, '2026-10-28');
  assert.equal(a.checked, true);
  assert.equal(c.paidOn, null);
  assert.equal(c.checked, false);
  assert.equal(r.drops.length, 1);
  assert.deepEqual(r.drops[0], { date: '2026-06-10', office: 'BALI', notaNo: '01K48F', amount: 14850, checked: true, paidOn: '2026-06-12' });
});

test('rincian nota: cek silang kolom & pesan WA barang tiba', async () => {
  const { lineMismatch, arrivalMessage } = await import('./medpro');
  const { categoryOf } = await import('./notaSplit');
  const items = [
    { description: 'BANNER MONIKA JUAL', product: 'BANNER', label: 'MONIKA JUAL', size: '0,8 x 0,5 m', price: 16000, qty: 1, total: 16000, category: 'banner' as const },
    { description: 'STIKER IRMA JUAL', product: 'STIKER', label: 'IRMA JUAL', size: '', price: 51000, qty: 2, total: 102000, category: 'branding' as const }
  ];
  assert.equal(lineMismatch({ banner: 16000, branding: 102000, items }), null);
  assert.match(lineMismatch({ banner: 118000, branding: 0, items }) ?? '', /Banner\/plank 16\.000 ≠ kolom 118\.000/);
  assert.equal(categoryOf('STIKER IRMA'), 'banner');
  assert.equal(categoryOf('STICKER logo'), 'banner');
  assert.equal(categoryOf('ID CARD'), 'branding');
  assert.equal(
    arrivalMessage(items[0], 'Selamat pagi'),
    'Selamat pagi, Bapak/Ibu.\n\nKami informasikan Banner *MONIKA JUAL* ukuran 0,8 x 0,5 m sudah tersedia di kantor Brighton HUB Cibubur dan dapat diambil pada jam operasional.\n\nTerima kasih.'
  );
  assert.match(arrivalMessage(items[1], 'Selamat sore'), /Stiker \*IRMA JUAL\* \(2 pcs\)/);
});
