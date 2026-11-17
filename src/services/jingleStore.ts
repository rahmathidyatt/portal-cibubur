import type { AdminAuth } from './bookingStore';
import { DEFAULT_JINGLES, type Jingle } from '../data/jingles';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  writeLocal,
  type SupabaseConfig
} from './supabaseClient';

/** Daftar jingle: dibaca semua pengunjung, ditambah/dihapus admin. */
export interface JingleStore {
  list(): Promise<Jingle[]>;
  add(input: { title: string; file: File }, auth: AdminAuth): Promise<void>;
  remove(jingle: Jingle, auth: AdminAuth): Promise<void>;
  /** Batas ukuran unggahan di mode ini (byte). */
  maxBytes: number;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah daftar jingle.');
}

/* ------------------------- localStorage (demo) ------------------------- */

const KEY = 'portal-cibubur:jingles';

function readAll(): Jingle[] {
  const list = readLocal<Jingle[] | null>(KEY, null);
  return Array.isArray(list) ? list : DEFAULT_JINGLES;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}

function createLocalStore(): JingleStore {
  return {
    // Mode demo menyimpan lagu di browser, jadi ukurannya dibatasi.
    maxBytes: 3 * 1024 * 1024,
    async list() {
      return readAll();
    },
    async add({ title, file }, auth) {
      requireAdmin(auth);
      const url = await fileToDataUrl(file);
      const next = [...readAll(), { id: randomId(), title: title.trim(), url }];
      writeLocal(KEY, next);
      if (readLocal<Jingle[] | null>(KEY, null)?.length !== next.length) {
        throw new Error('Penyimpanan browser penuh. Di mode demo gunakan file yang lebih kecil.');
      }
    },
    async remove(jingle, auth) {
      requireAdmin(auth);
      writeLocal(KEY, readAll().filter((j) => j.id !== jingle.id));
    }
  };
}

/* ------------------------------- Supabase ------------------------------ */

interface Row {
  id: string;
  title: string;
  url: string;
  storage_path: string | null;
}

function extOf(file: File): string {
  const m = file.name.toLowerCase().match(/\.(mp3|m4a|aac|wav|ogg)(\.mpeg)?$/);
  return m ? m[1] : 'mp3';
}

function createSupabaseStore(config: SupabaseConfig): JingleStore {
  return {
    maxBytes: 15 * 1024 * 1024,
    async list() {
      const res = await supabaseFetch(
        config,
        'rest/v1/jingles?select=id,title,url,storage_path&order=sort_order.asc,created_at.asc'
      );
      const rows = (await res.json()) as Row[];
      return rows.map((r) => ({ id: r.id, title: r.title, url: r.url, storagePath: r.storage_path }));
    },
    async add({ title, file }, auth) {
      requireAdmin(auth);
      const path = `${randomId()}.${extOf(file)}`;
      await supabaseFetch(config, `storage/v1/object/jingles/${path}`, {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { 'Content-Type': file.type || 'audio/mpeg', 'x-upsert': 'false' },
        body: file
      });
      try {
        await supabaseFetch(config, 'rest/v1/jingles', {
          method: 'POST',
          accessToken: auth.accessToken,
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            title: title.trim(),
            url: `${config.url}/storage/v1/object/public/jingles/${path}`,
            storage_path: path
          })
        });
      } catch (err) {
        // Jangan tinggalkan file yatim bila baris gagal disimpan.
        await supabaseFetch(config, `storage/v1/object/jingles/${path}`, {
          method: 'DELETE',
          accessToken: auth.accessToken
        }).catch(() => undefined);
        throw err;
      }
    },
    async remove(jingle, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/jingles?id=eq.${encodeURIComponent(jingle.id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
      if (jingle.storagePath) {
        await supabaseFetch(config, `storage/v1/object/jingles/${jingle.storagePath}`, {
          method: 'DELETE',
          accessToken: auth.accessToken
        }).catch(() => undefined);
      }
    }
  };
}

let cached: JingleStore | null = null;

export function getJingleStore(): JingleStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}

/** Diberitahukan ke pemutar agar daftar lagu diperbarui setelah admin mengubahnya. */
export const JINGLES_CHANGED_EVENT = 'portal-cibubur:jingles-changed';
