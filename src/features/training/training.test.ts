import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GridCell, GridSheet } from '../../utils/xlsxGrid';
import {
  TRAINING_MODULES,
  agentStatus,
  buildTrainingBc,
  buildAgentTrainingBc,
  defaultDeadline,
  greetingForHour,
  importTrainingSheet,
  moduleStatus,
  outstandingModules,
  parseScore,
  pendingBatches,
  registerToBatch,
  setScore,
  type TrainingAgent
} from './training';

const ids = TRAINING_MODULES.map((m) => m.id);
const allScores = (n: number) => Object.fromEntries(ids.map((id) => [id, n]));

test('status sesi & agen (minimal 60)', () => {
  const a: TrainingAgent = { id: '1', name: 'A', scores: { ...allScores(80), negosiasi: 40 }, pending: {} };
  assert.equal(moduleStatus(a, 'negosiasi'), 'tidak-lulus');
  assert.equal(agentStatus(a), 'belum');
  assert.deepEqual(outstandingModules(a).map((m) => m.id), ['negosiasi']);
  const b = setScore(a, 'negosiasi', 60);
  assert.equal(agentStatus(b), 'lulus');
  assert.equal(agentStatus({ ...a, graduated: true }), 'lulus');
});

test('daftar batch hanya sesi yang belum lulus; nilai menutup status menunggu', () => {
  const a: TrainingAgent = { id: '1', name: 'A', scores: { 'bisnis-bersama': 100, 'etika-pelayanan': 40 }, pending: {} };
  const r = registerToBatch(a, '2026-11-20');
  assert.equal(Object.keys(r.pending).length, 11);
  assert.ok(!('bisnis-bersama' in r.pending));
  assert.equal(agentStatus(r), 'menunggu');
  assert.equal(moduleStatus(setScore(r, 'etika-pelayanan', 80), 'etika-pelayanan'), 'lulus');
  assert.deepEqual(pendingBatches([r, { ...a, id: '2', pending: { negosiasi: '' } }]), ['2026-11-20', '']);
});

test('nilai ganda dari rekap', () => {
  assert.equal(parseScore('100 & 80'), 100);
  assert.equal(parseScore('80/100'), 100);
  assert.equal(parseScore(''), undefined);
  assert.equal(parseScore('0'), 0);
});

test('BC pengingat berisi agen & sesi yang menunggu nilai', () => {
  const agents: TrainingAgent[] = [
    { id: '1', name: 'URIP (XJTA)', scores: {}, pending: { 'bisnis-bersama': '2026-11-20', negosiasi: '2026-11-20' } },
    { id: '2', name: 'AYU (HAYP)', scores: {}, pending: { 'dokumen-kepemilikan': '2026-12-04' } },
    { id: '3', name: 'LULUS (AAAA)', scores: allScores(100), pending: {} }
  ];
  const opts = { deadline: '2026-11-06', deadlineTime: '17.00', greeting: 'Selamat siang' };
  const all = buildTrainingBc(agents, opts);
  assert.match(all, /^Selamat siang, Bapak\/Ibu\./);
  assert.match(all, /- AYU \(HAYP\)\n- URIP \(XJTA\)/);
  assert.match(all, /adalah Jumat, 06 November 2026, pukul 17\.00 WIB\./);
  assert.ok(!all.includes('LULUS'));
  const batch = buildTrainingBc(agents, { ...opts, batchDate: '2026-11-20' });
  assert.ok(!batch.includes('AYU'));
  assert.equal(buildTrainingBc([agents[2]], opts), '');
  const one = buildAgentTrainingBc(agents[0], opts);
  assert.match(one, /Bapak\/Ibu URIP \(XJTA\)/);
  assert.match(one, /1\. Bisnis Bersama Brighton\n2\. Negosiasi/);
  assert.match(one, /batch Jumat–Senin, 20–23 November 2026 untuk 2 sesi/);
  const ibu = buildAgentTrainingBc({ ...agents[0], gender: 'P', pending: { negosiasi: '2026-11-23' } }, { ...opts, nextBatch: { start: '2026-11-23', end: '2026-11-26' } });
  assert.match(ibu, /^Selamat siang, Ibu URIP \(XJTA\)\.\n\nKami informasikan bahwa Ibu telah terdaftar sebagai peserta Training Bright On batch Senin–Kamis, 23–26 November 2026 untuk 1 sesi berikut:/);
  assert.match(ibu, /WAJIB menuliskan Nama dan Kode Agen/);
  assert.equal(defaultDeadline('2026-11-10', '2026-11-01'), '2026-11-06');
  assert.equal(defaultDeadline(undefined, '2026-11-19'), '2026-11-20');
  assert.equal(greetingForHour(12), 'Selamat siang');
});

function grid(rows: Record<string, [string, string | null]>): GridSheet {
  const cells = new Map<string, GridCell>();
  for (const [ref, [value, fill]] of Object.entries(rows)) cells.set(ref, { value, fill, isDate: false });
  return { name: 'BRIGHT ON ', cells, maxRow: 7, maxCol: 13 };
}

test('impor rekap memakai warna: hijau lulus, merah menunggu nilai', () => {
  const header: Record<string, [string, string | null]> = { B4: ['PROPERTY ADVISOR', null] };
  'CDEFGHIJKLM'.split('').forEach((c, i) => (header[`${c}4`] = [TRAINING_MODULES[i].title, 'FF9900']));
  const sheet = grid({
    ...header,
    B5: ['marsel (gfxy)', '00FF00'],
    C5: ['100', null],
    D5: ['80', null],
    B6: ['URIP (XJTA)', 'FF0000'],
    D6: ['80', null],
    B7: ['INDAH (MFQA)', '434343'],
    C7: ['80', null],
    H7: ['40', 'FF0000'],
    I7: ['100', 'FF0000']
  });
  const { agents } = importTrainingSheet(sheet);
  assert.equal(agents.length, 3);
  const [m, u, i] = agents.map((a, n) => ({ ...a, id: String(n) }));
  assert.equal(m.name, 'MARSEL (GFXY)');
  assert.equal(agentStatus(m), 'lulus');
  assert.equal(agentStatus(u), 'menunggu');
  assert.equal(Object.keys(u.pending).length, 10);
  assert.equal(agentStatus(i), 'menunggu');
  assert.deepEqual(Object.keys(i.pending), ['primary-secondary']);
  assert.equal(i.scores['dokumen-kepemilikan'], 100);
});

import { codeTokens, matchRecap, splitAgentName } from './tracking';

test('tracking: kode dari kolom berantakan & pencocokan', () => {
  assert.deepEqual(codeTokens('Rohim (TOHB) | Brighton Shine Cengkareng'), ['TOHB']);
  assert.deepEqual(codeTokens('𝙉𝙏𝘿𝙓'), ['NTDX']);
  assert.deepEqual(codeTokens('Bviw'), ['BVIW']);
  assert.deepEqual(splitAgentName('VERA MARSELLA (GFQG)'), { name: 'VERA MARSELLA', code: 'GFQG' });
  const agents: TrainingAgent[] = [
    { id: 'a', name: 'AYU (HAYP)', scores: { 'bisnis-bersama': 100 }, pending: { 'alur-transaksi': '2026-11-09' } },
    { id: 'b', name: 'URIP (XJTA)', scores: {}, pending: {} },
    { id: 'c', name: 'ZED (ZZZZ)', scores: {}, pending: {} }
  ];
  const row = (moduleId: string, score: number, name: string, unit: string, rawCode: string, location: string) => ({ moduleId, score, name, unit, rawCode, location, date: '2026-11-11' });
  const res = matchRecap(agents, {
    sessions: [],
    rows: [
      row('alur-transaksi', 80, 'AYU', 'Brighton Warrior', 'HAYP', 'Cibubur'),
      row('alur-transaksi', 40, 'Ayu Lestari', 'Brighton Warrior', '', 'Cibubur'),
      row('bisnis-bersama', 100, 'AYU', 'Brighton Warrior', 'HAYP', 'Cibubur'),
      row('negosiasi', 60, 'Urip', 'Brighton Vision', '-', 'Bekasi'),
      row('negosiasi', 60, 'Zed', 'Brighton Crown', '-', 'Solo')
    ]
  });
  assert.deepEqual(res.map((r) => [r.agent.id, r.level, r.findings.map((f) => `${f.moduleId}:${f.row.score}`).join()]), [
    ['a', 'kode', 'alur-transaksi:80'],
    ['b', 'nama', 'negosiasi:60']
  ]);
});

import { buildReminderBc, cancelAllPending } from './training';

test('BC pengingat sesi belum diikuti/lulus', () => {
  const agents: TrainingAgent[] = [
    { id: 'a', name: 'AYU (HAYP)', scores: Object.fromEntries(['bisnis-bersama','etika-pelayanan','tentang-bisnis','kebiasaan-sukses','listing-modal','primary-secondary','dokumen-kepemilikan','alur-transaksi','branding-expose'].map((k) => [k, 80])), pending: { negosiasi: '2026-11-20' } },
    { id: 'b', name: 'URIP (XJTA)', scores: { 'bisnis-bersama': 40 }, pending: {} }
  ];
  agents[0].scores['dokumen-kepemilikan'] = 20;
  const bc = buildReminderBc(agents, { greeting: 'Selamat pagi' });
  assert.match(bc, /\*AYU \(HAYP\)\*\n- Dokumen Kepemilikan Properti \(belum lulus\)\n- Senjata Teknologi Brighton App Bikin #ClosingLebihCepat \(belum mengikuti\)\n- Klien Percaya, Bisnis Berkembang \(belum mengikuti\)\n\n\*URIP/);
  assert.ok(!bc.split('*URIP')[0].includes('Negosiasi'), 'menunggu nilai tidak diingatkan');
  assert.match(bc, /WAJIB menuliskan Nama dan Kode Agen yang sesuai/);
  assert.match(buildReminderBc(agents, { greeting: 'Selamat pagi' }, 'b'), /^Selamat pagi, Bapak\/Ibu URIP \(XJTA\)\./);
  const pak = buildReminderBc([{ ...agents[1], gender: 'L' }], { greeting: 'Selamat pagi', nextBatch: { start: '2026-11-30', end: '2026-12-03' } }, 'b');
  assert.match(pak, /^Selamat pagi, Bapak URIP \(XJTA\)\.\n\nKami ingatkan bahwa masih terdapat sesi Training Bright On yang belum Bapak ikuti atau belum lulus\. Batch berikutnya akan dilaksanakan pada Senin, 30 November – Kamis, 3 Desember 2026\./);
  assert.match(bc, /Jadwal batch berikutnya akan kami informasikan kemudian\./);
  assert.deepEqual(cancelAllPending(agents[0]).pending, {});
});
