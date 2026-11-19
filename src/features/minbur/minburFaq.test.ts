import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectIntent, findAgentCode, normalize } from './minburFaq';

test('normalize menyatukan penulisan floor time', () => {
  assert.equal(normalize('Siapa Floor-Time hari ini?'), 'siapa floortime hari ini');
});

test('detectIntent mengenali pertanyaan umum', () => {
  const cases: [string, string | null][] = [
    ['Siapa floor time hari ini?', 'floortime-hari-ini'],
    ['yang jaga hari ini siapa', 'floortime-hari-ini'],
    ['Kapan jadwal floor time saya?', 'floortime-saya'],
    ['jadwal ADOL', 'floortime-saya'],
    ['saya mau tukar jadwal floortime', 'floortime-tukar'],
    ['Jam kantor buka sampai jam berapa?', 'jam'],
    ['hari minggu buka?', 'jam'],
    ['alamat kantor dimana', 'lokasi'],
    ['Bagaimana order smart messenger?', 'messenger'],
    ['mau pasang banner', 'messenger'],
    ['nomor WA finance', 'kontak'],
    ['ada pengumuman apa', 'pengumuman'],
    ['co-broking day kapan', 'pengumuman'],
    ['halo min', 'salam'],
    ['makasih ya', 'terima-kasih'],
    ['kamu siapa', 'tentang'],
    ['resep nasi goreng', null]
  ];
  for (const [q, want] of cases) assert.equal(detectIntent(q), want, q);
});

test('findAgentCode hanya mengambil kode yang dikenal', () => {
  assert.equal(findAgentCode('jadwal adol dong', ['ADOL', 'AUFZ']), 'ADOL');
  assert.equal(findAgentCode('jadwal saya', ['ADOL']), null);
});
