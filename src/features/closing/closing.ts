/** Closing agen (jual beli / sewa / primary) untuk ditampilkan di beranda. */

export type ClosingRole = 'L' | 'S' | 'L/S' | 'PL';
export type ClosingType = 'Jual Beli' | 'Sewa Menyewa' | 'Primary';

export const CLOSING_TYPES: ClosingType[] = ['Jual Beli', 'Sewa Menyewa', 'Primary'];
/** Closing Primary: 1 agen (selling) + maksimal 2 Project Leader. */
export const MAX_PROJECT_LEADERS = 2;
export const CLOSING_ROLES: { value: ClosingRole; label: string }[] = [
  { value: 'L', label: 'L (Listing)' },
  { value: 'S', label: 'S (Selling)' },
  { value: 'L/S', label: 'L/S (Listing & Selling)' }
];
export const DEFAULT_AREA = 'Cibubur, Bogor';

export interface ClosingAgent {
  role: ClosingRole;
  name: string;
  /** mis. "Brighton Harmony" */
  unit: string;
  area: string;
  /** Kode PA, mis. "XFDL" (boleh kosong). */
  code: string;
}

export interface ClosingFlyer {
  id: string;
  /** Lokasi file (mode Supabase). */
  path?: string;
  /** Gambar kecil untuk grid beranda (hemat kuota). */
  thumbPath?: string;
  /** Gambar (mode lokal / sebelum diunggah). */
  dataUrl?: string;
  thumbDataUrl?: string;
}

export interface Closing {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: ClosingType;
  location: string;
  agents: ClosingAgent[];
  flyers: ClosingFlyer[];
  /** Diisi saat flyer dihapus otomatis (lebih dari 12 bulan); data closing tetap disimpan. */
  flyersRemovedAt?: string;
  createdAt: string;
}

/** Flyer disimpan 12 bulan; data closing tetap disimpan untuk rekap. */
export const FLYER_RETENTION_MONTHS = 12;

/** Tanggal batas (YYYY-MM-DD): closing sebelum tanggal ini flyernya dihapus. */
export function flyerCutoff(todayIso: string): string {
  const [y, m, d] = todayIso.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-11-18" → "18 November 2026". */
export function formatClosingDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11" → "November 2026". */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function emptyAgent(): ClosingAgent {
  return { role: 'S', name: '', unit: '', area: DEFAULT_AREA, code: '' };
}

/** Agen yang pernah diinput (untuk isian otomatis), kunci = nama huruf kecil. */
export function knownAgents(closings: Closing[]): Map<string, ClosingAgent> {
  const map = new Map<string, ClosingAgent>();
  const sorted = [...closings].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const c of sorted)
    for (const a of c.agents) if (a.name.trim()) map.set(a.name.trim().toLowerCase(), { ...a, role: a.role === 'PL' ? 'S' : a.role });
  return map;
}

/** Validasi sebelum disimpan; mengembalikan pesan atau null. */
export function validateClosing(c: Pick<Closing, 'date' | 'location' | 'agents' | 'flyers' | 'flyersRemovedAt'>): string | null {
  if (!formatClosingDate(c.date)) return 'Isi tanggal closing.';
  if (!c.location.trim()) return 'Isi lokasi / nama properti.';
  if (!c.agents.some((a) => a.name.trim())) return 'Isi minimal satu agen.';
  if (c.flyers.length === 0 && !c.flyersRemovedAt) return 'Unggah flyer closing.';
  return null;
}

/** Atur peran agen saat jenis closing berganti (Primary: agen pertama S, sisanya Project Leader). */
export function applyType(agents: ClosingAgent[], type: ClosingType): ClosingAgent[] {
  if (type === 'Primary') {
    return agents.slice(0, 1 + MAX_PROJECT_LEADERS).map((a, i) => ({ ...a, role: i === 0 ? 'S' : 'PL' }));
  }
  return agents.map((a) => (a.role === 'PL' ? { ...a, role: 'S' } : a));
}

/** Agen utama (bukan Project Leader). */
export function mainAgents(c: Pick<Closing, 'agents'>): ClosingAgent[] {
  return c.agents.filter((a) => a.role !== 'PL' && a.name.trim());
}
