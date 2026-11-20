import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsTranslation, translateDate, translateStatic } from './translateText';

test('kamus: teks persis & templat angka', () => {
  assert.equal(translateStatic('Beranda'), 'Home');
  assert.equal(
    translateStatic('Setiap hari Senin dilaksanakan Co-Broking Day di lantai 2.'),
    'Co-Broking Day is held every Monday on floor 2.'
  );
  assert.equal(
    translateStatic('Berdiri sejak 3 Mei 2023 · ulang tahun ke-4 5 hari lagi'),
    'Established 3 May 2023 · anniversary no. 4 in 5 days'
  );
});

test('tanggal Indonesia → Inggris', () => {
  assert.equal(translateDate('Jumat, 20 November 2026'), 'Friday, 20 November 2026');
  assert.equal(translateDate('18 Nov · Jual Beli'), null);
});

test('kode agen, angka & URL tidak diterjemahkan', () => {
  assert.equal(needsTranslation('MHBX'), false);
  assert.equal(needsTranslation('19:48'), false);
  assert.equal(needsTranslation('https://x.id/a'), false);
  assert.equal(needsTranslation('Jadwal saya'), true);
});
