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
  assert.equal(Object.keys(r.pending).length, 10);
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
  assert.match(one, /1\. Bisnis Bersama Brighton\n11\. Negosiasi/);
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
