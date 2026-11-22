export interface BusinessManager {
  /** Juga dipakai sebagai nama file foto di src/assets/managers/<id>.webp */
  id: string;
  name: string;
  code: string;
  tier: string;
  /** Foto unggahan admin (data URL). Kosong = pakai foto bawaan src/assets/managers/<id>.webp */
  photoUrl?: string | null;
}

/** Pilihan level yang disarankan di formulir admin (tetap bisa diketik bebas). */
export const BM_TIER_OPTIONS = [
  'Principal',
  'Brighton Warrior',
  'Brighton Champion',
  'Brighton Vision',
  'Brighton Priority',
  'Brighton Winner',
  'Brighton Harmony',
  'Brighton Max'
];

/**
 * Rapikan unit yang diketik admin (unit Brighton sangat banyak, jadi boleh diketik bebas):
 * "eagle" → "Brighton Eagle", "brighton  star one" → "Brighton Star One", "principal" → "Principal".
 */
export function normalizeTier(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (/principal/i.test(t)) return 'Principal';
  const rest = t.replace(/^brighton\s*/i, '');
  const title = rest
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
  return title ? `Brighton ${title}` : '';
}

/** Urutan unit sesuai kebiasaan kantor. */
export const UNIT_ORDER = ['Warrior', 'Champion', 'Vision', 'Priority', 'Winner'];

/** "Brighton Warrior" → "Warrior". */
export function unitOf(tier: string): string {
  const t = tier.trim().replace(/^brighton\s+/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Principal = level tertinggi (ditampilkan di atas Business Manager). */
export function isPrincipal(bm: Pick<BusinessManager, 'tier'>): boolean {
  return /principal/i.test(bm.tier);
}

/** Kelompokkan BM per unit, urut Warrior, Champion, Vision, Priority, Winner, lalu unit lain. */
export function groupByUnit<T extends Pick<BusinessManager, 'tier'>>(list: T[]): { unit: string; members: T[] }[] {
  const map = new Map<string, T[]>();
  for (const bm of list) map.set(unitOf(bm.tier), [...(map.get(unitOf(bm.tier)) ?? []), bm]);
  const rank = (u: string) => (UNIT_ORDER.indexOf(u) === -1 ? 99 : UNIT_ORDER.indexOf(u));
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([unit, members]) => ({ unit, members }));
}

export function validateBusinessManager(
  input: { name: string; code: string; tier: string },
  existing: BusinessManager[] = []
): string | null {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (name.length < 2 || name.length > 60) return 'Nama BM 2–60 karakter.';
  if (!/^[A-Z0-9]{2,10}$/.test(code)) return 'Kode BM 2–10 huruf/angka, mis. AUFZ.';
  if (existing.some((m) => m.code.toUpperCase() === code)) return `Kode ${code} sudah dipakai.`;
  if (input.tier.trim().length < 3 || input.tier.trim().length > 40) return 'Level 3–40 karakter.';
  return null;
}

/** Business Manager Brighton HUB Cibubur (urutan tampil di beranda). */
export const BUSINESS_MANAGERS: BusinessManager[] = [
  { id: 'rudy', name: 'RUDY, CRA®', code: 'AUFZ', tier: 'Brighton Warrior' },
  { id: 'adolf', name: 'ADOLF, CRA®', code: 'WIID', tier: 'Brighton Warrior' },
  { id: 'vira', name: 'VIRA', code: 'AUTU', tier: 'Brighton Warrior' },
  { id: 'edah', name: 'EDAH, CRA®', code: 'DDOG', tier: 'Brighton Warrior' },
  { id: 'risda', name: 'RISDA, CRA®', code: 'TRVG', tier: 'Brighton Champion' },
  { id: 'vee', name: 'VEE, CRA®', code: 'BMWD', tier: 'Brighton Vision' },
  { id: 'moren', name: 'MOREN', code: 'VNIL', tier: 'Brighton Champion' },
  { id: 'ade', name: 'ADE', code: 'FRJU', tier: 'Brighton Winner' },
  { id: 'toni', name: 'TONI, CRA®', code: 'ACYS', tier: 'Brighton Priority' }
];
