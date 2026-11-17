import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BUSINESS_MANAGERS } from './businessManagers';

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
