import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, checkNota, itemFileName, normalizeScan, notaNumber, sizeCm, uniqueNames } from './notaSplit';

test('ukuran meter → cm', () => {
  assert.equal(sizeCm('0,8 x 0,5 m'), '80X50');
  assert.equal(sizeCm('2 x 1'), '200X100');
  assert.equal(sizeCm('0,6 x 0,4 m'), '60X40');
  assert.equal(sizeCm(''), '');
});

test('nama file & kategori', () => {
  assert.equal(itemFileName({ label: 'Monika Jual', product: 'BANNER', size: '0,8 x 0,5 m', qty: 1, category: 'banner' }), 'MONIKA JUAL 80X50 1PCS');
  assert.equal(itemFileName({ label: 'Andi', product: 'KARTU NAMA', size: '', qty: 2, category: 'branding' }), 'ANDI KARTU NAMA 2PCS');
  assert.equal(categoryOf('STIKER BANNER'), 'banner');
  assert.equal(categoryOf('ID CARD'), 'branding');
  assert.equal(categoryOf('X-BANNER'), 'banner');
  assert.deepEqual(uniqueNames(['A', 'A', 'B']), ['A', 'A (2)', 'B']);
  assert.equal(notaNumber('022642/ASP/FP/XI/2026'), '022642');
});

test('cek nota 022642', () => {
  const scan = normalizeScan({
    invoice: '022642/ASP/FP/XI/2026',
    date: '2026-11-13',
    total_qty: 6,
    grand_total: '104.000',
    items: [
      { description: 'BANNER MONIKA JUAL', product: 'BANNER', price: 16000, qty: 1, total: 16000 },
      { description: 'BANNER HENDRA & NING JUAL SEWA', product: 'BANNER', price: 32000, qty: 1, total: 32000 },
      { description: 'BANNER LASTRI-ZEIN JUAL', product: 'BANNER', price: 16000, qty: 1, total: 16000 },
      { description: 'BANNER DHANY JUA', product: 'BANNER', price: 8000, qty: 1, total: 8000 },
      { description: 'BANNER IRMA JUAL', product: 'BANNER', price: 16000, qty: 2, total: 32000 }
    ]
  });
  const c = checkNota(scan);
  assert.equal(c.ok, true);
  assert.equal(c.banner, 104000);
  assert.equal(c.branding, 0);
  const bad = checkNota({ ...scan, items: scan.items.map((it, i) => (i === 4 ? { ...it, total: 16000 } : it)) });
  assert.deepEqual(bad.badLines, [4]);
  assert.equal(bad.totalOk, false);
});
