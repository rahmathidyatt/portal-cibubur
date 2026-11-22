import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRank, periodEndFrom, sortAchievements, validateAchievement, type Achievement } from './achievementData';

const a = (id: string, periodEnd: string): Achievement => ({ id, award: 'X Awards', title: 'Kategori', rank: '', periodLabel: '', periodEnd, photoUrl: 'data:image/webp;base64,AA' });

test('pencapaian: terbaru di depan, peringkat dirapikan, validasi', () => {
  assert.deepEqual(sortAchievements([a('lama', '2025-12-31'), a('baru', '2026-06-30')]).map((x) => x.id), ['baru', 'lama']);
  assert.equal(normalizeRank('12'), '#12');
  assert.equal(normalizeRank(' #3 '), '#3');
  assert.equal(normalizeRank('Juara 1'), 'Juara 1');
  assert.equal(validateAchievement({ ...a('x', ''), periodLabel: 'Januari – Juni 2026' }, true), null);
  assert.match(validateAchievement({ ...a('x', ''), periodLabel: '' }, true) ?? '', /periode/);
  assert.match(validateAchievement({ ...a('x', ''), periodLabel: 'Juni 2026' }, false) ?? '', /poster/);
  assert.equal(periodEndFrom('Januari – Juni 2026', 'X'), '2026-06-30');
  assert.equal(periodEndFrom('Period: January - February 2024', 'X'), '2024-02-29');
  assert.equal(periodEndFrom('Tahun 2025', 'X'), '2025-12-31');
  assert.equal(periodEndFrom('Semester ganjil', '2026-11-22'), '2026-11-22');
});
