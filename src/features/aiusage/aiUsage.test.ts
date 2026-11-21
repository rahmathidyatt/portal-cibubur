import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCounts, modelLabel, quotaWindowStart, topQuestions, usageToday, type UsageRow } from './aiUsage';

const row = (p: Partial<UsageRow>): UsageRow => ({
  createdAt: '2026-11-22T10:00:00Z',
  mode: 'chat',
  model: 'gemini-flash-latest',
  status: 'ok',
  fallback: false,
  durationMs: 1000,
  question: null,
  ...p
});

test('reset jatah = tengah malam Pacific (PST, UTC-8)', () => {
  assert.equal(quotaWindowStart(new Date('2026-11-22T10:00:00Z')).toISOString(), '2026-11-22T08:00:00.000Z');
  assert.equal(quotaWindowStart(new Date('2026-11-22T07:00:00Z')).toISOString(), '2026-11-21T08:00:00.000Z');
  // Musim panas (PDT, UTC-7)
  assert.equal(quotaWindowStart(new Date('2026-07-10T12:00:00Z')).toISOString(), '2026-07-10T07:00:00.000Z');
});

test('pemakaian hari ini per model, 429 tidak dihitung', () => {
  const rows = [
    row({}),
    row({ model: 'gemini-flash-lite-latest' }),
    row({ status: 'rate_limit' }),
    row({ createdAt: '2026-11-22T07:00:00Z' })
  ];
  assert.deepEqual(usageToday(rows, new Date('2026-11-22T12:00:00Z')), { Flash: 1, 'Flash-Lite': 1 });
  assert.equal(modelLabel('gemini-3.1-flash-lite'), 'Flash-Lite');
});

test('harian & pertanyaan terbanyak', () => {
  const rows = [row({ question: 'Beda HGB dan HGU?' }), row({ question: 'beda hgb dan hgu' }), row({ question: 'jam kantor', createdAt: '2026-11-20T03:00:00Z' })];
  const d = dailyCounts(rows, '2026-11-22', 3);
  assert.deepEqual(d.map((x) => x.count), [1, 0, 2]);
  assert.deepEqual(topQuestions(rows)[0], { label: 'Beda HGB dan HGU?', count: 2 });
});
