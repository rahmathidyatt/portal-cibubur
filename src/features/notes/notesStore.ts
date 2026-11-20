import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, randomId, readLocal, supabaseFetch, writeLocal, type SupabaseConfig } from '../../services/supabaseClient';
import { cleanDraft, type ChecklistItem, type Note, type NoteDraft, type NoteLabel, type NoteStatus } from './notes';

export interface NotesStore {
  list(auth: AdminAuth): Promise<Note[]>;
  create(draft: NoteDraft, auth: AdminAuth): Promise<Note>;
  update(id: string, patch: Partial<NoteDraft> & { status?: NoteStatus }, auth: AdminAuth): Promise<void>;
  remove(id: string, auth: AdminAuth): Promise<void>;
  emptyTrash(auth: AdminAuth): Promise<void>;
  listLabels(auth: AdminAuth): Promise<NoteLabel[]>;
  addLabel(name: string, auth: AdminAuth): Promise<NoteLabel>;
  renameLabel(id: string, name: string, auth: AdminAuth): Promise<void>;
  removeLabel(id: string, auth: AdminAuth): Promise<void>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Notes khusus admin.');
}

export function validateLabel(name: string, existing: NoteLabel[], ignoreId?: string): string | null {
  const n = name.trim();
  if (!n) return 'Nama label wajib diisi.';
  if (n.length > 50) return 'Nama label maksimal 50 karakter.';
  if (existing.some((l) => l.id !== ignoreId && l.name.toLowerCase() === n.toLowerCase())) return 'Label itu sudah ada.';
  return null;
}

/* ------------------------------------------------------------- lokal (demo) */

const NOTES_KEY = 'portal-cibubur:notes';
const LABELS_KEY = 'portal-cibubur:note-labels';

function createLocalStore(): NotesStore {
  const notes = () => readLocal<Note[]>(NOTES_KEY, []);
  const labels = () => readLocal<NoteLabel[]>(LABELS_KEY, []);
  return {
    async list(auth) {
      requireAdmin(auth);
      return notes();
    },
    async create(draft, auth) {
      requireAdmin(auth);
      const now = new Date().toISOString();
      const note: Note = { id: randomId(), ...cleanDraft(draft), status: 'active', createdAt: now, updatedAt: now };
      writeLocal(NOTES_KEY, [...notes(), note]);
      return note;
    },
    async update(id, patch, auth) {
      requireAdmin(auth);
      const now = new Date().toISOString();
      writeLocal(
        NOTES_KEY,
        notes().map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n))
      );
    },
    async remove(id, auth) {
      requireAdmin(auth);
      writeLocal(NOTES_KEY, notes().filter((n) => n.id !== id));
    },
    async emptyTrash(auth) {
      requireAdmin(auth);
      writeLocal(NOTES_KEY, notes().filter((n) => n.status !== 'trashed'));
    },
    async listLabels(auth) {
      requireAdmin(auth);
      return [...labels()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
    },
    async addLabel(name, auth) {
      requireAdmin(auth);
      const problem = validateLabel(name, labels());
      if (problem) throw new Error(problem);
      const label = { id: randomId(), name: name.trim() };
      writeLocal(LABELS_KEY, [...labels(), label]);
      return label;
    },
    async renameLabel(id, name, auth) {
      requireAdmin(auth);
      const problem = validateLabel(name, labels(), id);
      if (problem) throw new Error(problem);
      writeLocal(LABELS_KEY, labels().map((l) => (l.id === id ? { ...l, name: name.trim() } : l)));
    },
    async removeLabel(id, auth) {
      requireAdmin(auth);
      writeLocal(LABELS_KEY, labels().filter((l) => l.id !== id));
      writeLocal(NOTES_KEY, notes().map((n) => ({ ...n, labelIds: n.labelIds.filter((x) => x !== id) })));
    }
  };
}

/* ---------------------------------------------------------------- Supabase */

interface NoteRow {
  id: string;
  title: string;
  body: string;
  is_checklist: boolean;
  items: ChecklistItem[];
  color: string;
  label_ids: string[];
  pinned: boolean;
  status: NoteStatus;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: NoteRow): Note => ({
  id: r.id,
  title: r.title,
  body: r.body,
  isChecklist: r.is_checklist,
  items: Array.isArray(r.items) ? r.items : [],
  color: r.color as Note['color'],
  labelIds: r.label_ids ?? [],
  pinned: r.pinned,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

function toRow(p: Partial<NoteDraft> & { status?: NoteStatus }): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.body !== undefined) row.body = p.body;
  if (p.isChecklist !== undefined) row.is_checklist = p.isChecklist;
  if (p.items !== undefined) row.items = p.items;
  if (p.color !== undefined) row.color = p.color;
  if (p.labelIds !== undefined) row.label_ids = p.labelIds;
  if (p.pinned !== undefined) row.pinned = p.pinned;
  if (p.status !== undefined) row.status = p.status;
  return row;
}

const COLS = 'id,title,body,is_checklist,items,color,label_ids,pinned,status,created_at,updated_at';

function createSupabaseStore(config: SupabaseConfig): NotesStore {
  const call = (path: string, auth: AdminAuth, init: RequestInit = {}) =>
    supabaseFetch(config, path, { ...init, accessToken: auth.accessToken });
  return {
    async list(auth) {
      requireAdmin(auth);
      const res = await call(`rest/v1/notes?select=${COLS}&order=updated_at.desc&limit=2000`, auth);
      return ((await res.json()) as NoteRow[]).map(fromRow);
    },
    async create(draft, auth) {
      requireAdmin(auth);
      const res = await call('rest/v1/notes', auth, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(toRow(cleanDraft(draft)))
      });
      return fromRow(((await res.json()) as NoteRow[])[0]);
    },
    async update(id, patch, auth) {
      requireAdmin(auth);
      await call(`rest/v1/notes?id=eq.${encodeURIComponent(id)}`, auth, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...toRow(patch), updated_at: new Date().toISOString() })
      });
    },
    async remove(id, auth) {
      requireAdmin(auth);
      await call(`rest/v1/notes?id=eq.${encodeURIComponent(id)}&status=eq.trashed`, auth, { method: 'DELETE' });
    },
    async emptyTrash(auth) {
      requireAdmin(auth);
      await call('rest/v1/notes?status=eq.trashed', auth, { method: 'DELETE' });
    },
    async listLabels(auth) {
      requireAdmin(auth);
      const res = await call('rest/v1/note_labels?select=id,name&order=name.asc', auth);
      return (await res.json()) as NoteLabel[];
    },
    async addLabel(name, auth) {
      requireAdmin(auth);
      const res = await call('rest/v1/note_labels', auth, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ name: name.trim().slice(0, 50) })
      });
      return ((await res.json()) as NoteLabel[])[0];
    },
    async renameLabel(id, name, auth) {
      requireAdmin(auth);
      await call(`rest/v1/note_labels?id=eq.${encodeURIComponent(id)}`, auth, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ name: name.trim().slice(0, 50) })
      });
    },
    async removeLabel(id, auth) {
      requireAdmin(auth);
      // Label dilepas dari catatan dulu, lalu labelnya dihapus. Catatannya sendiri tetap ada.
      const res = await call(`rest/v1/notes?select=id,label_ids&label_ids=cs.{${id}}`, auth);
      const rows = (await res.json()) as { id: string; label_ids: string[] }[];
      for (const r of rows) {
        await call(`rest/v1/notes?id=eq.${r.id}`, auth, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ label_ids: r.label_ids.filter((x) => x !== id) })
        });
      }
      await call(`rest/v1/note_labels?id=eq.${encodeURIComponent(id)}`, auth, { method: 'DELETE' });
    }
  };
}

let cached: NotesStore | null = null;

export function getNotesStore(): NotesStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
