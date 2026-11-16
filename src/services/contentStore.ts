import type { AdminAuth } from './bookingStore';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  writeLocal,
  type SupabaseConfig
} from './supabaseClient';

/** Konten yang dikelola admin: pengumuman kantor. */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO
}

export interface ContentStore {
  listAnnouncements(): Promise<Announcement[]>;
  addAnnouncement(input: { title: string; body: string }, auth: AdminAuth): Promise<void>;
  deleteAnnouncement(id: string, auth: AdminAuth): Promise<void>;
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

/* ----------------------------- localStorage ----------------------------- */


const ANNOUNCEMENT_KEY = 'portal-cibubur:announcements';

function createLocalContentStore(): ContentStore {
  return {
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
    }
  };
}

/* ------------------------------- Supabase ------------------------------- */

function createSupabaseContentStore(config: SupabaseConfig): ContentStore {
  return {
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
