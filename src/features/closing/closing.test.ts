import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyType, knownAgents, mainAgents, validateClosing, type Closing } from './closing';

const imelda = { role: 'L/S' as const, name: 'Imelda', unit: 'Brighton Harmony', area: 'Cibubur, Bogor', code: 'XFDL' };
const santi = { role: 'S' as const, name: 'Santi', unit: 'Brighton Max', area: 'Cibubur, Bogor', code: '' };

test('Primary: agen pertama selling, sisanya Project Leader (maks. 2)', () => {
  const agents = applyType([imelda, santi, { ...santi, name: 'Vira' }, { ...santi, name: 'X' }], 'Primary');
  assert.deepEqual(agents.map((a) => a.role), ['S', 'PL', 'PL']);
  assert.deepEqual(applyType(agents, 'Jual Beli').map((a) => a.role), ['S', 'PL', 'PL']);
  assert.deepEqual(mainAgents({ agents }).map((a) => a.name), ['Imelda']);
});

test('agen diingat & validasi', () => {
  const closings: Closing[] = [
    { id: '1', date: '2026-11-18', type: 'Primary', location: 'Harvest City', agents: [imelda, { ...santi, role: 'PL' }], flyers: [], createdAt: '1' }
  ];
  assert.equal(knownAgents(closings).get('santi')?.role, 'S');
  assert.equal(validateClosing({ date: '2026-11-18', location: 'X', agents: [imelda], flyers: [] }), 'Unggah flyer closing.');
});

import { flyerCutoff } from './closing';

test('flyer disimpan 12 bulan', () => {
  assert.equal(flyerCutoff('2026-11-20'), '2025-11-20');
  assert.equal(validateClosing({ date: '2025-01-02', location: 'X', agents: [imelda], flyers: [], flyersRemovedAt: '2026-01-03' }), null);
});

import { closingRecapSheets, computeStats } from './closingStats';

test('rekap closing per bulan, jenis, unit, agen, lokasi', () => {
  const mk = (id: string, date: string, type: Closing['type'], location: string, agents: Closing['agents']): Closing => ({ id, date, type, location, agents, flyers: [], createdAt: id });
  const list = [
    mk('1', '2026-11-18', 'Sewa Menyewa', 'Grand Depok City', [imelda]),
    mk('2', '2026-11-19', 'Primary', 'Harvest City', [{ ...imelda, role: 'S' }, { ...santi, role: 'PL' }]),
    mk('3', '2026-03-02', 'Jual Beli', 'harvest city', [santi]),
    mk('4', '2025-12-01', 'Jual Beli', 'Kota Wisata', [santi])
  ];
  const s = computeStats(list, '2026');
  assert.equal(s.total, 3);
  assert.deepEqual(s.byType, { 'Jual Beli': 1, 'Sewa Menyewa': 1, Primary: 1 });
  assert.equal(s.timeline[10].count, 2);
  assert.deepEqual(s.byLocation[0], { label: 'HARVEST CITY', count: 2 });
  assert.deepEqual(s.byAgent[0], { label: 'IMELDA (XFDL)', count: 2 });
  assert.deepEqual(s.byUnit.map((u) => u.label), ['Brighton Harmony', 'Brighton Max']);
  assert.deepEqual(computeStats(list, '').timeline, [{ label: '2025', count: 1 }, { label: '2026', count: 3 }]);
  const sheets = closingRecapSheets(list, '', '20 Nov 2026');
  assert.equal(sheets[0].doc.tables[0].rows.length, 5);
  assert.equal(sheets[1].doc.tables[0].rows.length, 2);
});
