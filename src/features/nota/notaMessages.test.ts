import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal, DEFAULT_NOTA_CONFIG, DEFAULT_REKENING } from './notaCalc';
import { buildNotaMessage, buildPhotoMessage, greeting } from './notaMessages';

const meta = {
  tglRequest: '2026-11-17',
  namaAgent: 'RUDY (AUFZ)',
  kantor: 'HUB CIBUBUR',
  pembayaran: 'Transfer',
  rekening: DEFAULT_REKENING,
  estimasiTanggal: '2026-11-18'
};
const jobs = [
  { alamat: 'Perumahan Citra Gran Cibubur Blok R5 No. 12', tugas: 'Pasang banner', keterangan: '' },
  { alamat: '', tugas: '', keterangan: '' }
];

test('salam sesuai jam', () => {
  assert.equal(greeting(8 * 60), 'Selamat pagi');
  assert.equal(greeting(13 * 60), 'Selamat siang');
  assert.equal(greeting(16 * 60), 'Selamat sore');
  assert.equal(greeting(19 * 60), 'Selamat malam');
});

test('pesan nota formal', () => {
  const r = calculateTotal(7, jobs, DEFAULT_NOTA_CONFIG);
  const msg = buildNotaMessage(meta, jobs, r, 10 * 60);
  assert.match(msg, /^Selamat pagi Bapak\/Ibu RUDY \(AUFZ\),/);
  assert.match(msg, /permintaan tanggal Selasa, 17 November 2026/);
  assert.match(msg, /1\. Perumahan Citra Gran Cibubur Blok R5 No\. 12 — Pasang banner/);
  assert.ok(!msg.includes('2. '));
  assert.match(msg, /\*Total tagihan: Rp/);
  assert.match(msg, /No\. rekening:/);
  assert.match(msg, /Hormat kami,\nOperasional Brighton HUB CIBUBUR$/);
});

test('pesan kirim foto', () => {
  const msg = buildPhotoMessage({ ...meta, namaAgent: '' }, jobs, 14 * 60);
  assert.match(msg, /^Selamat siang Bapak\/Ibu,/);
  assert.match(msg, /foto dokumentasi hasil pekerjaan \*Smart Messenger\* tanggal Rabu, 18 November 2026/);
});
