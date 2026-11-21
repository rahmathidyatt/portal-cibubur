import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentText, parseClosingText } from './closingPaste';
import { applyType, type Closing } from './closing';
import { rewardEntries } from './closingReward';

const SAMPLE = `Sewa Menyewa – TARUM BARAT CIKARANG
- PA:
- L: Maria Brighton Priority Galaxy, Bekasi
- S: Theda Brighton Priority Cibubur, Bogor @Priority Theda (FWVP)

Jual Beli – AMAZING CIKEAS HILL
- PA:
- PL: Lenny Brighton Paradise Cibubur, Bogor @Paradise Lenny (IQID)
- PL: Rudy Brighton Warrior Cibubur, Bogor @BM Warrior Rudy (AUFZ)
- S: Vira Brighton Warrior Cibubur, Bogor @BM Warrior Vira (AUTU)`;

test('teks WhatsApp terbaca menjadi closing', () => {
  const r = parseClosingText(SAMPLE);
  assert.equal(r.length, 2);
  assert.equal(r[0].type, 'Sewa Menyewa');
  assert.equal(r[0].location, 'TARUM BARAT CIKARANG');
  assert.deepEqual(r[0].agents[0], { role: 'L', name: 'Maria', unit: 'Brighton Priority', area: 'Galaxy, Bekasi', code: '' });
  assert.deepEqual(r[0].agents[1], { role: 'S', name: 'Theda', unit: 'Brighton Priority', area: 'Cibubur, Bogor', code: 'FWVP' });
  // Ada PL → otomatis Primary, Selling di urutan pertama.
  assert.equal(r[1].type, 'Primary');
  assert.deepEqual(r[1].agents.map((a) => `${a.role}:${a.name}:${a.code}`), ['S:Vira:AUTU', 'PL:Lenny:IQID', 'PL:Rudy:AUFZ']);
});

test('agen tanpa tag: kode kosong', () => {
  assert.equal(parseAgentText('Maria Brighton Priority Galaxy, Bekasi').code, '');
});

test('PL dipertahankan di Jual Beli', () => {
  const agents = [{ role: 'PL' as const, name: 'A', unit: '', area: '', code: '' }];
  assert.equal(applyType(agents, 'Jual Beli')[0].role, 'PL');
});

test('reward: hanya Cibubur, batas H+6, expired H+7, termasuk PL', () => {
  const c = (id: string, date: string, agents: Closing['agents']): Closing => ({ id, date, type: 'Jual Beli', location: 'X', agents, flyers: [], createdAt: '' });
  const closings = [
    c('a', '2026-11-21', parseClosingText(SAMPLE)[1].agents),
    c('b', '2026-11-10', parseClosingText(SAMPLE)[0].agents),
    c('old', '2026-07-30', parseClosingText(SAMPLE)[1].agents)
  ];
  const r = rewardEntries(closings, [{ closingId: 'a', agentKey: 'vira|AUTU', claimedBy: 'Vira', claimedAt: '2026-11-22' }], '2026-11-27');
  assert.equal(r.filter((e) => e.closing.id === 'a').length, 3);
  assert.equal(r.filter((e) => e.closing.id === 'b').length, 1); // Maria (Bekasi) tidak ikut
  assert.equal(r.some((e) => e.closing.id === 'old'), false);
  const lenny = r.find((e) => e.agent.name === 'Lenny')!;
  assert.equal(lenny.deadline, '2026-11-27');
  assert.equal(lenny.status, 'open');
  assert.equal(r.find((e) => e.agent.name === 'Vira')!.status, 'claimed');
  assert.equal(r.find((e) => e.closing.id === 'b')!.status, 'expired');
  assert.equal(rewardEntries(closings, [], '2026-11-28').find((e) => e.agent.name === 'Lenny')!.status, 'expired');
});
