import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BUSINESS_MANAGERS, validateBusinessManager } from './businessManagers';

test('business managers: 9 orang, kode unik, setiap foto tersedia', () => {
  assert.equal(BUSINESS_MANAGERS.length, 9);
  assert.equal(new Set(BUSINESS_MANAGERS.map((m) => m.code)).size, 9);
  for (const m of BUSINESS_MANAGERS) {
    assert.ok(
      existsSync(new URL(`../assets/managers/${m.id}.webp`, import.meta.url)),
      `foto ${m.id}.webp tidak ditemukan`
    );
  }
});

test('validateBusinessManager', () => {
  assert.equal(validateBusinessManager({ name: 'BUDI, CRA®', code: 'abcd', tier: 'Brighton Winner' }), null);
  assert.match(validateBusinessManager({ name: 'B', code: 'ABCD', tier: 'Brighton Winner' }) ?? '', /Nama/);
  assert.match(validateBusinessManager({ name: 'Budi', code: 'AB-1', tier: 'Brighton Winner' }) ?? '', /Kode/);
  assert.match(
    validateBusinessManager({ name: 'Budi', code: 'aufz', tier: 'Brighton Winner' }, BUSINESS_MANAGERS) ?? '',
    /AUFZ sudah dipakai/
  );
});

import { groupByUnit, isPrincipal, unitOf } from './businessManagers';

test('unit BM & principal', () => {
  assert.equal(unitOf('Brighton Warrior'), 'Warrior');
  assert.equal(unitOf('brighton VISION'), 'Vision');
  assert.ok(isPrincipal({ tier: 'Principal' }));
  assert.ok(!isPrincipal({ tier: 'Brighton Winner' }));
  const g = groupByUnit([
    { tier: 'Brighton Winner' },
    { tier: 'Brighton Warrior' },
    { tier: 'Brighton Priority' },
    { tier: 'Brighton Warrior' },
    { tier: 'Brighton Champion' }
  ]);
  assert.deepEqual(g.map((x) => [x.unit, x.members.length]), [
    ['Warrior', 2],
    ['Champion', 1],
    ['Priority', 1],
    ['Winner', 1]
  ]);
});
