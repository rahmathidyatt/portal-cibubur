/** Pencapaian kantor (penghargaan/sertifikat) yang ditampilkan di beranda. */
export interface Achievement {
  id: string;
  /** Nama penghargaan, mis. "BOC Awards 2026". */
  award: string;
  /** Kategori, mis. "TOP 15 Brighton HUB · Bisnis Tanpa Batas". */
  title: string;
  /** Peringkat, mis. "#12" (boleh kosong). */
  rank: string;
  /** Periode seperti tertulis, mis. "Januari – Juni 2026". */
  periodLabel: string;
  /** Akhir periode (YYYY-MM-DD), dihitung otomatis dari teks periode; untuk urutan terbaru di depan. */
  periodEnd: string;
  /** Poster unggahan admin (data URL). Kosong = poster bawaan aplikasi untuk id ini. */
  photoUrl: string | null;
}

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'boc-awards-2026',
    award: 'BOC Awards 2026',
    title: 'TOP 15 Brighton HUB · Bisnis Tanpa Batas',
    rank: '#12',
    periodLabel: 'Januari – Juni 2026',
    periodEnd: '2026-06-30',
    photoUrl: null
  }
];

export function sortAchievements(list: Achievement[]): Achievement[] {
  return [...list].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || a.title.localeCompare(b.title));
}

/** "12" → "#12", "#12" tetap, "" tetap kosong. */
export function normalizeRank(rank: string): string {
  const r = rank.trim();
  if (!r) return '';
  return /^\d+$/.test(r) ? `#${r}` : r;
}

const MONTHS: [RegExp, number][] = [
  [/^jan/, 1],
  [/^feb/, 2],
  [/^(mar|maret)/, 3],
  [/^apr/, 4],
  [/^(mei|may)/, 5],
  [/^jun/, 6],
  [/^jul/, 7],
  [/^(agu|agt|aug)/, 8],
  [/^sep/, 9],
  [/^(okt|oct)/, 10],
  [/^nov/, 11],
  [/^(des|dec)/, 12]
];

/**
 * Tanggal akhir periode dari teksnya: "Januari – Juni 2026" → 2026-06-30, "Tahun 2025" → 2025-12-31.
 * Bila tidak terbaca, pakai cadangan (mis. hari ini).
 */
export function periodEndFrom(label: string, fallback: string): string {
  const words = label.toLowerCase().match(/[a-z]+|\d{4}/g) ?? [];
  let month = 0;
  let year = 0;
  for (const w of words) {
    if (/^\d{4}$/.test(w)) year = Number(w);
    else {
      const m = MONTHS.find(([re]) => re.test(w) && w.length >= 3);
      if (m) month = m[1];
    }
  }
  if (!year) return fallback;
  const mm = month || 12;
  const last = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  return `${year}-${String(mm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function validateAchievement(
  input: Pick<Achievement, 'award' | 'title' | 'rank' | 'periodLabel'>,
  hasPoster: boolean
): string | null {
  if (input.award.trim().length < 3 || input.award.trim().length > 80) return 'Nama penghargaan 3–80 karakter.';
  if (input.title.trim().length < 3 || input.title.trim().length > 120) return 'Kategori 3–120 karakter.';
  if (input.rank.trim().length > 20) return 'Peringkat maksimal 20 karakter.';
  if (input.periodLabel.trim().length < 4 || input.periodLabel.trim().length > 60) return 'Isi periode, mis. Januari – Juni 2026.';
  if (!hasPoster) return 'Unggah poster/sertifikatnya.';
  return null;
}
