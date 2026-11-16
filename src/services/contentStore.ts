import type { StaffAvailabilityStatus } from '../data/cibuburData';
import type { AdminAuth } from './bookingStore';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  writeLocal,
  type SupabaseConfig
} from './supabaseClient';

/** Konten yang dikelola admin: pengumuman kantor dan status ketersediaan staf. */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO
}

export interface StaffStatus {
  staffId: string;
  status: StaffAvailabilityStatus;
  detail: string;
  updatedAt: string; // ISO
}

export interface OfficeDocument {
  id: string;
  title: string;
  url: string;
  category: string;
  createdAt: string; // ISO
}

export const DOCUMENT_CATEGORIES = ['SOP', 'Template', 'Formulir', 'Lainnya'] as const;

export interface ContentStore {
  listDocuments(): Promise<OfficeDocument[]>;
  addDocument(input: { title: string; url: string; category: string }, auth: AdminAuth): Promise<void>;
  deleteDocument(id: string, auth: AdminAuth): Promise<void>;
  listAnnouncements(): Promise<Announcement[]>;
  addAnnouncement(input: { title: string; body: string }, auth: AdminAuth): Promise<void>;
  deleteAnnouncement(id: string, auth: AdminAuth): Promise<void>;
  listStaffStatuses(): Promise<StaffStatus[]>;
  setStaffStatus(
    input: { staffId: string; status: StaffAvailabilityStatus; detail: string },
    auth: AdminAuth
  ): Promise<void>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah data ini.');
}

export function validateAnnouncement(input: { title: string; body: string }): string | null {
  if (input.title.trim().length < 3) return 'Judul pengumuman minimal 3 karakter.';
  if (input.title.trim().length > 120) return 'Judul pengumuman maksimal 120 karakter.';
  if (input.body.trim().length > 1000) return 'Isi pengumuman maksimal 1.000 karakter.';
  return null;
}

export function validateDocument(input: { title: string; url: string }): string | null {
  if (input.title.trim().length < 3) return 'Nama dokumen minimal 3 karakter.';
  try {
    const url = new URL(input.url.trim());
    if (url.protocol !== 'https:') return 'Tautan harus diawali https://';
  } catch {
    return 'Tautan tidak valid. Contoh: https://drive.google.com/...';
  }
  return null;
}

/* ----------------------------- localStorage ----------------------------- */

const DOCUMENT_KEY = 'portal-cibubur:documents';

const ANNOUNCEMENT_KEY = 'portal-cibubur:announcements';
const STAFF_STATUS_KEY = 'portal-cibubur:staff-status';

function createLocalContentStore(): ContentStore {
  return {
    async listDocuments() {
      const list = readLocal<OfficeDocument[]>(DOCUMENT_KEY, []);
      return (Array.isArray(list) ? list : []).sort((a, b) => a.title.localeCompare(b.title, 'id'));
    },
    async addDocument(input, auth) {
      requireAdmin(auth);
      const list = readLocal<OfficeDocument[]>(DOCUMENT_KEY, []);
      writeLocal(DOCUMENT_KEY, [
        ...(Array.isArray(list) ? list : []),
        {
          id: randomId(),
          title: input.title.trim(),
          url: input.url.trim(),
          category: input.category,
          createdAt: new Date().toISOString()
        }
      ]);
    },
    async deleteDocument(id, auth) {
      requireAdmin(auth);
      const list = readLocal<OfficeDocument[]>(DOCUMENT_KEY, []);
      writeLocal(DOCUMENT_KEY, (Array.isArray(list) ? list : []).filter((d) => d.id !== id));
    },
    async listAnnouncements() {
      const list = readLocal<Announcement[]>(ANNOUNCEMENT_KEY, []);
      return (Array.isArray(list) ? list : []).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    },
    async addAnnouncement(input, auth) {
      requireAdmin(auth);
      const list = readLocal<Announcement[]>(ANNOUNCEMENT_KEY, []);
      writeLocal(ANNOUNCEMENT_KEY, [
        ...(Array.isArray(list) ? list : []),
        {
          id: randomId(),
          title: input.title.trim(),
          body: input.body.trim(),
          createdAt: new Date().toISOString()
        }
      ]);
    },
    async deleteAnnouncement(id, auth) {
      requireAdmin(auth);
      const list = readLocal<Announcement[]>(ANNOUNCEMENT_KEY, []);
      writeLocal(
        ANNOUNCEMENT_KEY,
        (Array.isArray(list) ? list : []).filter((a) => a.id !== id)
      );
    },
    async listStaffStatuses() {
      const map = readLocal<Record<string, StaffStatus>>(STAFF_STATUS_KEY, {});
      return Object.values(map && typeof map === 'object' ? map : {});
    },
    async setStaffStatus(input, auth) {
      requireAdmin(auth);
      const map = readLocal<Record<string, StaffStatus>>(STAFF_STATUS_KEY, {});
      writeLocal(STAFF_STATUS_KEY, {
        ...map,
        [input.staffId]: { ...input, detail: input.detail.trim(), updatedAt: new Date().toISOString() }
      });
    }
  };
}

/* ------------------------------- Supabase ------------------------------- */

function createSupabaseContentStore(config: SupabaseConfig): ContentStore {
  return {
    async listDocuments() {
      const res = await supabaseFetch(
        config,
        'rest/v1/office_documents?select=id,title,url,category,created_at&order=title.asc'
      );
      const rows = (await res.json()) as {
        id: string;
        title: string;
        url: string;
        category: string;
        created_at: string;
      }[];
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        category: r.category,
        createdAt: r.created_at
      }));
    },
    async addDocument(input, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, 'rest/v1/office_documents', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          title: input.title.trim(),
          url: input.url.trim(),
          category: input.category
        })
      });
    },
    async deleteDocument(id, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/office_documents?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    },
    async listAnnouncements() {
      const res = await supabaseFetch(
        config,
        'rest/v1/announcements?select=id,title,body,created_at&order=created_at.desc&limit=20'
      );
      const rows = (await res.json()) as { id: string; title: string; body: string; created_at: string }[];
      return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, createdAt: r.created_at }));
    },
    async addAnnouncement(input, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, 'rest/v1/announcements', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ title: input.title.trim(), body: input.body.trim() })
      });
    },
    async deleteAnnouncement(id, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/announcements?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    },
    async listStaffStatuses() {
      const res = await supabaseFetch(
        config,
        'rest/v1/staff_status?select=staff_id,status,detail,updated_at'
      );
      const rows = (await res.json()) as {
        staff_id: string;
        status: StaffAvailabilityStatus;
        detail: string;
        updated_at: string;
      }[];
      return rows.map((r) => ({
        staffId: r.staff_id,
        status: r.status,
        detail: r.detail,
        updatedAt: r.updated_at
      }));
    },
    async setStaffStatus(input, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, 'rest/v1/staff_status?on_conflict=staff_id', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          staff_id: input.staffId,
          status: input.status,
          detail: input.detail.trim(),
          updated_at: new Date().toISOString()
        })
      });
    }
  };
}

let cached: ContentStore | null = null;

export function getContentStore(): ContentStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseContentStore(config) : createLocalContentStore();
  }
  return cached;
}
