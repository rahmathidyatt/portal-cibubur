/** Notes: catatan ala Google Keep (khusus admin). Logika murni tanpa UI. */

export type NoteStatus = 'active' | 'archived' | 'trashed';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  isChecklist: boolean;
  items: ChecklistItem[];
  color: NoteColor;
  labelIds: string[];
  pinned: boolean;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NoteLabel {
  id: string;
  name: string;
}

export type NoteDraft = Pick<Note, 'title' | 'body' | 'isChecklist' | 'items' | 'color' | 'labelIds' | 'pinned'>;

export const NOTE_COLORS = [
  { id: 'default', name: 'Default', card: 'bg-white', swatch: 'bg-white' },
  { id: 'red', name: 'Merah', card: 'bg-red-50', swatch: 'bg-red-200' },
  { id: 'orange', name: 'Oranye', card: 'bg-orange-50', swatch: 'bg-orange-200' },
  { id: 'yellow', name: 'Kuning', card: 'bg-amber-50', swatch: 'bg-amber-200' },
  { id: 'green', name: 'Hijau', card: 'bg-emerald-50', swatch: 'bg-emerald-200' },
  { id: 'teal', name: 'Toska', card: 'bg-teal-50', swatch: 'bg-teal-200' },
  { id: 'blue', name: 'Biru', card: 'bg-sky-50', swatch: 'bg-sky-200' },
  { id: 'purple', name: 'Ungu', card: 'bg-violet-50', swatch: 'bg-violet-200' },
  { id: 'pink', name: 'Merah muda', card: 'bg-pink-50', swatch: 'bg-pink-200' },
  { id: 'gray', name: 'Abu-abu', card: 'bg-slate-100', swatch: 'bg-slate-300' }
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number]['id'];

export function colorOf(id: string) {
  return NOTE_COLORS.find((c) => c.id === id) ?? NOTE_COLORS[0];
}

export const EMPTY_DRAFT: NoteDraft = {
  title: '',
  body: '',
  isChecklist: false,
  items: [],
  color: 'default',
  labelIds: [],
  pinned: false
};

export function newItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Catatan kosong (tanpa judul, isi, maupun item) tidak disimpan. */
export function isEmptyDraft(d: NoteDraft): boolean {
  if (d.title.trim()) return false;
  return d.isChecklist ? d.items.every((i) => !i.text.trim()) : !d.body.trim();
}

/** Bersihkan sebelum disimpan: buang item kosong, batasi panjang. */
export function cleanDraft(d: NoteDraft): NoteDraft {
  return {
    ...d,
    title: d.title.slice(0, 200),
    body: d.isChecklist ? '' : d.body.slice(0, 20000),
    items: d.isChecklist
      ? d.items
          .filter((i) => i.text.trim())
          .slice(0, 200)
          .map((i) => ({ id: i.id, text: i.text.slice(0, 500), done: i.done }))
      : []
  };
}

/** Ubah teks ↔ checklist tanpa kehilangan isi (per baris). */
export function toChecklist(d: NoteDraft): NoteDraft {
  const items = d.body
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\[[ xX]\])\s*/, '').trimEnd())
    .filter((t) => t.trim())
    .map((text) => ({ id: newItemId(), text, done: false }));
  return { ...d, isChecklist: true, body: '', items };
}

export function toText(d: NoteDraft): NoteDraft {
  return { ...d, isChecklist: false, items: [], body: d.items.map((i) => i.text).join('\n') };
}

/** Teks yang disalin tombol Salin (checklist pakai ☐ / ☑). */
export function noteCopyText(n: Pick<Note, 'title' | 'body' | 'isChecklist' | 'items'>): string {
  const content = n.isChecklist ? n.items.map((i) => `${i.done ? '☑' : '☐'} ${i.text}`).join('\n') : n.body;
  return [n.title.trim(), content.trim()].filter(Boolean).join('\n\n');
}

/** Urutan tampilan: disematkan dulu, lalu yang terakhir diubah. */
export function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

export type NotesView = { kind: 'notes' } | { kind: 'label'; labelId: string } | { kind: 'archive' } | { kind: 'trash' } | { kind: 'guide' };

export function filterNotes(list: Note[], view: NotesView): Note[] {
  switch (view.kind) {
    case 'notes':
      return list.filter((n) => n.status === 'active');
    case 'label':
      return list.filter((n) => n.status !== 'trashed' && n.labelIds.includes(view.labelId));
    case 'archive':
      return list.filter((n) => n.status === 'archived');
    case 'trash':
      return list.filter((n) => n.status === 'trashed');
    case 'guide':
      return [];
  }
}

/** Pecah teks menjadi potongan biasa dan link (https://…, www.…, wa.me/…). */
export function linkify(text: string): { text: string; href?: string }[] {
  const re = /\b((?:https?:\/\/|www\.)[^\s]+|wa\.me\/[^\s]+)/gi;
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const raw = m[0].replace(/[),.;!?]+$/, '');
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: raw, href: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
