import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, readLocal, supabaseFetch, writeLocal, type SupabaseConfig } from '../../services/supabaseClient';
import { RETENTION_DAYS, isExpired, type BrightDayPhoto, type BrightDayReport } from './brightDay';
import { dataUrlBytes } from '../../utils/image';

/**
 * Penyimpanan Report Bright Day (khusus admin). Laporan & fotonya hanya disimpan
 * selama 7 hari; yang lebih lama dibersihkan otomatis setiap halaman dibuka.
 */
export interface BrightDayStore {
  /** Laporan yang masih berlaku (terbaru dulu). Laporan kedaluwarsa ikut dibersihkan. */
  list(auth: AdminAuth): Promise<BrightDayReport[]>;
  save(report: BrightDayReport, auth: AdminAuth): Promise<BrightDayReport>;
  remove(report: BrightDayReport, auth: AdminAuth): Promise<void>;
  /** Isi gambar (data URL) untuk pratinjau & PDF. */
  photoDataUrl(photo: BrightDayPhoto, auth: AdminAuth): Promise<string>;
}

const BUCKET = 'bright-day';

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat membuka Report Bright Day.');
}

/** Data laporan yang disimpan (foto hanya lokasi file-nya). */
function stripPhotos(report: BrightDayReport): BrightDayReport {
  return { ...report, photos: report.photos.map((p) => ({ id: p.id, path: p.path })) };
}

const LOCAL_KEY = 'portal-cibubur:bright-day-reports';

function createLocalStore(): BrightDayStore {
  const read = () => readLocal<BrightDayReport[]>(LOCAL_KEY, []);
  return {
    async list(auth) {
      requireAdmin(auth);
      const now = new Date();
      const all = read();
      const alive = all.filter((r) => !isExpired(r.createdAt, now));
      if (alive.length !== all.length) writeLocal(LOCAL_KEY, alive);
      return alive.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async save(report, auth) {
      requireAdmin(auth);
      const list = read().filter((r) => r.id !== report.id);
      const saved = { ...report, photos: report.photos.map((p) => ({ id: p.id, dataUrl: p.dataUrl })) };
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify([...list, saved]));
      } catch {
        throw new Error('Penyimpanan browser penuh. Kurangi jumlah foto.');
      }
      return saved;
    },
    async remove(report, auth) {
      requireAdmin(auth);
      writeLocal(LOCAL_KEY, read().filter((r) => r.id !== report.id));
    },
    async photoDataUrl(photo) {
      if (!photo.dataUrl) throw new Error('Foto tidak ditemukan.');
      return photo.dataUrl;
    }
  };
}

interface Row {
  id: string;
  created_at: string;
  report: BrightDayReport;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
    reader.readAsDataURL(blob);
  });
}

function createSupabaseStore(config: SupabaseConfig): BrightDayStore {
  const removeFiles = async (paths: string[], auth: AdminAuth) => {
    if (paths.length === 0) return;
    await supabaseFetch(config, `storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      accessToken: auth.accessToken,
      body: JSON.stringify({ prefixes: paths })
    });
  };
  const fetchRows = async (filter: string, auth: AdminAuth): Promise<Row[]> => {
    const res = await supabaseFetch(config, `rest/v1/bright_day_reports?select=id,created_at,report&${filter}`, {
      accessToken: auth.accessToken
    });
    return (await res.json()) as Row[];
  };
  const pathsOf = (r: BrightDayReport) => r.photos.map((p) => p.path).filter((p): p is string => !!p);

  return {
    async list(auth) {
      requireAdmin(auth);
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
      // Bersihkan laporan yang sudah lewat 7 hari (beserta fotonya).
      try {
        const expired = await fetchRows(`created_at=lt.${encodeURIComponent(cutoff)}`, auth);
        for (const row of expired) {
          await removeFiles(pathsOf(row.report), auth).catch(() => undefined);
          await supabaseFetch(config, `rest/v1/bright_day_reports?id=eq.${row.id}`, { method: 'DELETE', accessToken: auth.accessToken });
        }
      } catch {
        /* dicoba lagi saat halaman dibuka berikutnya */
      }
      const rows = await fetchRows(`created_at=gte.${encodeURIComponent(cutoff)}&order=created_at.desc`, auth);
      return rows.map((r) => ({ ...r.report, id: r.id, createdAt: r.created_at }));
    },
    async save(report, auth) {
      requireAdmin(auth);
      const photos: BrightDayPhoto[] = [];
      for (const p of report.photos) {
        if (p.path) {
          photos.push(p);
          continue;
        }
        if (!p.dataUrl) continue;
        const path = `${report.id}/${p.id}.jpg`;
        await supabaseFetch(config, `storage/v1/object/${BUCKET}/${path}`, {
          method: 'POST',
          accessToken: auth.accessToken,
          headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
          body: new Blob([dataUrlBytes(p.dataUrl) as BlobPart], { type: 'image/jpeg' })
        });
        photos.push({ ...p, path });
      }
      const next = { ...report, photos };
      // Foto yang dihapus dari laporan ikut dihapus dari penyimpanan.
      const [old] = await fetchRows(`id=eq.${report.id}`, auth);
      if (old) {
        const keep = new Set(pathsOf(next));
        await removeFiles(pathsOf(old.report).filter((p) => !keep.has(p)), auth).catch(() => undefined);
      }
      await supabaseFetch(config, 'rest/v1/bright_day_reports?on_conflict=id', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: report.id,
          created_at: report.createdAt,
          event_date: /^\d{4}-\d{2}-\d{2}$/.test(report.eventDate) ? report.eventDate : null,
          report: stripPhotos(next)
        })
      });
      return next;
    },
    async remove(report, auth) {
      requireAdmin(auth);
      const [row] = await fetchRows(`id=eq.${report.id}`, auth);
      await removeFiles([...new Set([...pathsOf(report), ...(row ? pathsOf(row.report) : [])])], auth).catch(() => undefined);
      await supabaseFetch(config, `rest/v1/bright_day_reports?id=eq.${report.id}`, { method: 'DELETE', accessToken: auth.accessToken });
    },
    async photoDataUrl(photo, auth) {
      if (photo.dataUrl) return photo.dataUrl;
      if (!photo.path) throw new Error('Foto tidak ditemukan.');
      const res = await supabaseFetch(config, `storage/v1/object/authenticated/${BUCKET}/${photo.path}`, {
        accessToken: auth.accessToken
      });
      return blobToDataUrl(await res.blob());
    }
  };
}

let cached: BrightDayStore | null = null;

export function getBrightDayStore(): BrightDayStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
