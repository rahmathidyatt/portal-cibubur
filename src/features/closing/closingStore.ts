import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, readLocal, supabaseFetch, writeLocal, type SupabaseConfig } from '../../services/supabaseClient';
import { dataUrlBytes } from '../../utils/image';
import type { Closing, ClosingFlyer } from './closing';

/** Data closing: dibaca semua pengunjung (beranda), diubah hanya oleh admin. */
export interface ClosingStore {
  /** Semua closing, terbaru dulu. Bisa dibatasi satu bulan ("2026-11"). */
  list(month?: string): Promise<Closing[]>;
  save(closing: Closing, auth: AdminAuth): Promise<Closing>;
  remove(closing: Closing, auth: AdminAuth): Promise<void>;
  /** Hapus flyer closing yang tanggalnya sebelum `cutoff` (data closing tetap). Mengembalikan jumlah closing. */
  purgeFlyers(cutoff: string, auth: AdminAuth): Promise<number>;
  /** Alamat gambar flyer untuk <img> (thumb = versi kecil untuk grid). */
  flyerSrc(flyer: ClosingFlyer, thumb?: boolean): string;
}

export const CLOSINGS_CHANGED = 'closings-changed';
const BUCKET = 'closing-flyers';

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah data closing.');
}

function inMonth(c: Closing, month?: string): boolean {
  return !month || c.date.startsWith(month);
}

const sortDesc = (a: Closing, b: Closing) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

const LOCAL_KEY = 'portal-cibubur:closings';

function createLocalStore(): ClosingStore {
  const read = () => readLocal<Closing[]>(LOCAL_KEY, []);
  return {
    async list(month) {
      return read().filter((c) => inMonth(c, month)).sort(sortDesc);
    },
    async save(closing, auth) {
      requireAdmin(auth);
      const next = [...read().filter((c) => c.id !== closing.id), closing];
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        throw new Error('Penyimpanan browser penuh. Hapus beberapa closing lama.');
      }
      return closing;
    },
    async remove(closing, auth) {
      requireAdmin(auth);
      writeLocal(LOCAL_KEY, read().filter((c) => c.id !== closing.id));
    },
    async purgeFlyers(cutoff, auth) {
      requireAdmin(auth);
      const now = new Date().toISOString();
      let n = 0;
      const next = read().map((c) => {
        if (c.date >= cutoff || c.flyers.length === 0) return c;
        n++;
        return { ...c, flyers: [], flyersRemovedAt: now };
      });
      if (n) writeLocal(LOCAL_KEY, next);
      return n;
    },
    flyerSrc(flyer, thumb) {
      return (thumb ? flyer.thumbDataUrl : undefined) ?? flyer.dataUrl ?? '';
    }
  };
}

interface Row {
  id: string;
  closing_date: string;
  created_at: string;
  data: Omit<Closing, 'id' | 'date' | 'createdAt'>;
}

function createSupabaseStore(config: SupabaseConfig): ClosingStore {
  const pathsOf = (c: Pick<Closing, 'flyers'>) =>
    c.flyers.flatMap((f) => [f.path, f.thumbPath]).filter((p): p is string => !!p);
  const upload = (path: string, dataUrl: string, auth: AdminAuth) =>
    supabaseFetch(config, `storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      accessToken: auth.accessToken,
      // Nama file unik per unggahan, jadi aman disimpan lama di cache browser/CDN.
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
      body: new Blob([dataUrlBytes(dataUrl) as BlobPart], { type: 'image/jpeg' })
    });
  const removeFiles = async (paths: string[], auth: AdminAuth) => {
    if (paths.length === 0) return;
    await supabaseFetch(config, `storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      accessToken: auth.accessToken,
      body: JSON.stringify({ prefixes: paths })
    });
  };
  const fetchRows = async (filter: string, auth?: AdminAuth): Promise<Row[]> => {
    const res = await supabaseFetch(config, `rest/v1/closings?select=id,closing_date,created_at,data&${filter}`, {
      accessToken: auth?.accessToken
    });
    return (await res.json()) as Row[];
  };
  const toClosing = (r: Row): Closing => ({ ...r.data, id: r.id, date: r.closing_date, createdAt: r.created_at });

  return {
    async list(month) {
      let filter = 'order=closing_date.desc,created_at.desc';
      if (month) {
        const [y, m] = month.split('-').map(Number);
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        filter += `&closing_date=gte.${month}-01&closing_date=lt.${next}`;
      }
      return (await fetchRows(filter)).map(toClosing);
    },
    async save(closing, auth) {
      requireAdmin(auth);
      const flyers: ClosingFlyer[] = [];
      for (const f of closing.flyers) {
        if (f.path) {
          flyers.push({ id: f.id, path: f.path, thumbPath: f.thumbPath });
          continue;
        }
        if (!f.dataUrl) continue;
        const path = `${closing.id}/${f.id}.jpg`;
        await upload(path, f.dataUrl, auth);
        let thumbPath: string | undefined;
        if (f.thumbDataUrl) {
          thumbPath = `${closing.id}/${f.id}-thumb.jpg`;
          await upload(thumbPath, f.thumbDataUrl, auth);
        }
        flyers.push({ id: f.id, path, thumbPath });
      }
      const [old] = await fetchRows(`id=eq.${closing.id}`, auth);
      if (old) {
        const keep = new Set(pathsOf({ flyers }));
        await removeFiles(pathsOf(old.data).filter((p) => !keep.has(p)), auth).catch(() => undefined);
      }
      const { id, date, createdAt, ...rest } = { ...closing, flyers };
      await supabaseFetch(config, 'rest/v1/closings?on_conflict=id', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id, closing_date: date, created_at: createdAt, data: rest })
      });
      return { ...closing, flyers };
    },
    async purgeFlyers(cutoff, auth) {
      requireAdmin(auth);
      const old = (await fetchRows(`closing_date=lt.${cutoff}`, auth)).filter((r) => (r.data.flyers ?? []).length > 0);
      for (const row of old) {
        await removeFiles(pathsOf(row.data), auth).catch(() => undefined);
        await supabaseFetch(config, `rest/v1/closings?id=eq.${row.id}`, {
          method: 'PATCH',
          accessToken: auth.accessToken,
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ data: { ...row.data, flyers: [], flyersRemovedAt: new Date().toISOString() } })
        });
      }
      return old.length;
    },
    async remove(closing, auth) {
      requireAdmin(auth);
      await removeFiles(pathsOf(closing), auth).catch(() => undefined);
      await supabaseFetch(config, `rest/v1/closings?id=eq.${closing.id}`, { method: 'DELETE', accessToken: auth.accessToken });
    },
    flyerSrc(flyer, thumb) {
      if (thumb && flyer.thumbDataUrl) return flyer.thumbDataUrl;
      if (flyer.dataUrl) return flyer.dataUrl;
      const path = (thumb && flyer.thumbPath) || flyer.path;
      return path ? `${config.url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}` : '';
    }
  };
}

let cached: ClosingStore | null = null;

export function getClosingStore(): ClosingStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
