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
  'Brighton Warrior',
  'Brighton Champion',
  'Brighton Vision',
  'Brighton Winner',
  'Brighton Priority'
];

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
