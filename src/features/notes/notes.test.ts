import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDraft, EMPTY_DRAFT, filterNotes, isEmptyDraft, linkify, noteCopyText, sortNotes, toChecklist, toText, type Note } from './notes';

const note = (p: Partial<Note>): Note => ({
  id: 'x',
  title: '',
  body: '',
  isChecklist: false,
  items: [],
  color: 'default',
  labelIds: [],
  pinned: false,
  status: 'active',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...p
});

test('catatan kosong tidak disimpan; item kosong dibuang', () => {
  assert.equal(isEmptyDraft(EMPTY_DRAFT), true);
  assert.equal(isEmptyDraft({ ...EMPTY_DRAFT, isChecklist: true, items: [{ id: 'a', text: ' ', done: false }] }), true);
  const c = cleanDraft({ ...EMPTY_DRAFT, isChecklist: true, items: [{ id: 'a', text: 'Beli map', done: false }, { id: 'b', text: '', done: false }] });
  assert.deepEqual(c.items.map((i) => i.text), ['Beli map']);
});

test('teks ↔ checklist per baris', () => {
  const c = toChecklist({ ...EMPTY_DRAFT, body: '- Cek nota\n\n[x] Kirim BC' });
  assert.deepEqual(c.items.map((i) => i.text), ['Cek nota', 'Kirim BC']);
  assert.equal(toText(c).body, 'Cek nota\nKirim BC');
});

test('salin checklist & urutan pin', () => {
  assert.equal(
    noteCopyText({ title: 'Hari ini', body: '', isChecklist: true, items: [{ id: 'a', text: 'Rekap', done: true }, { id: 'b', text: 'BC', done: false }] }),
    'Hari ini\n\n☑ Rekap\n☐ BC'
  );
  const sorted = sortNotes([note({ id: 'a', updatedAt: '2026-11-03' }), note({ id: 'b', pinned: true, updatedAt: '2026-11-01' })]);
  assert.deepEqual(sorted.map((n) => n.id), ['b', 'a']);
});

test('filter tampilan & link wa.me', () => {
  const list = [note({ id: 'a' }), note({ id: 'b', status: 'archived', labelIds: ['L'] }), note({ id: 'c', status: 'trashed', labelIds: ['L'] })];
  assert.deepEqual(filterNotes(list, { kind: 'notes' }).map((n) => n.id), ['a']);
  assert.deepEqual(filterNotes(list, { kind: 'label', labelId: 'L' }).map((n) => n.id), ['b']);
  assert.deepEqual(filterNotes(list, { kind: 'trash' }).map((n) => n.id), ['c']);
  const parts = linkify('Amat wa.me/6282124962159.');
  assert.equal(parts[1].href, 'https://wa.me/6282124962159');
});
