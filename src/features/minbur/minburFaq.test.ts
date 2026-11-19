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

import { answerBirthdays, answerBusinessManagers, matchTaughtFaq, answerFromTaught } from './minburFaq';

test('intent tambahan dari data portal', () => {
  const cases: [string, string][] = [
    ['siapa BM warrior?', 'bm'],
    ['business manager unit priority', 'bm'],
    ['siapa yang ulang tahun hari ini', 'ulang-tahun'],
    ['kantor berdiri sejak kapan', 'usia-kantor'],
    ['siapa jaga besok', 'floortime-besok'],
    ['kapan tanggal merah bulan ini', 'libur'],
    ['portal ini ada fitur apa saja', 'navigasi'],
    ['mau pasang banner', 'messenger']
  ];
  for (const [q, want] of cases) assert.equal(detectIntent(q), want, q);
});

test('answerBusinessManagers menyaring per unit', () => {
  const list = [
    { name: 'RUDY', code: 'AUFZ', tier: 'Brighton Warrior' },
    { name: 'TONI', code: 'ACYS', tier: 'Brighton Priority' }
  ];
  const a = answerBusinessManagers(list, 'BM warrior siapa');
  assert.ok(a.lines.join(' ').includes('RUDY') && !a.lines.join(' ').includes('TONI'));
  assert.ok(answerBusinessManagers(list, 'daftar bm').lines.join(' ').includes('TONI'));
});

test('answerBirthdays hari ini & besok', () => {
  const a = answerBirthdays([{ code: 'ADOL', name: 'ADI', month: 11, day: 19 }, { code: 'X1', name: 'BUDI', month: 11, day: 20 }], '2026-11-19');
  assert.match(a.lines[0], /ADI/);
  assert.match(a.lines[1], /BUDI/);
});

test('matchTaughtFaq memilih kata kunci paling cocok', () => {
  const faqs = [
    { keywords: 'parkir, parkiran', answer: 'Parkir di basement.' },
    { keywords: 'parkir motor', answer: 'Motor di samping kantor.', linkLabel: 'Peta', linkUrl: 'https://x.y' }
  ];
  assert.equal(matchTaughtFaq('dimana parkir motor?', faqs)?.answer, 'Motor di samping kantor.');
  assert.equal(matchTaughtFaq('parkiran mobil', faqs)?.answer, 'Parkir di basement.');
  assert.equal(matchTaughtFaq('jam kantor', faqs), null);
  assert.equal(answerFromTaught(faqs[1]).links?.[0].external, true);
});
