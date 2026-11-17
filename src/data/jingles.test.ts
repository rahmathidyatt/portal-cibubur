import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJingleUrl, titleFromFileName, validateJingleFile } from './jingles';

test('judul dari nama file', () => {
  assert.equal(titleFromFileName('Jingle_Rise_And_Multiply_5.mp3.mpeg'), 'Jingle Rise And Multiply');
  assert.equal(titleFromFileName('3dec049f-Jingle_Together_Greater_3.mp3'), 'Jingle Together Greater');
  assert.equal(titleFromFileName('United_for_Impact.mp3'), 'United for Impact');
});

test('validasi file jingle', () => {
  assert.equal(validateJingleFile({ name: 'a.mp3', size: 1000, type: 'audio/mpeg' }), null);
  assert.equal(validateJingleFile({ name: 'a.mp3.mpeg', size: 1000, type: '' }), null);
  assert.match(validateJingleFile({ name: 'a.pdf', size: 1000, type: 'application/pdf' }) ?? '', /audio/);
  assert.match(validateJingleFile({ name: 'a.mp3', size: 20 * 1024 * 1024, type: 'audio/mpeg' }) ?? '', /15 MB/);
});

test('url jingle', () => {
  assert.equal(resolveJingleUrl('jingles/a.mp3', '/'), '/jingles/a.mp3');
  assert.equal(resolveJingleUrl('jingles/a.mp3'), 'jingles/a.mp3');
  assert.equal(resolveJingleUrl('https://x.supabase.co/a.mp3', '/'), 'https://x.supabase.co/a.mp3');
});
