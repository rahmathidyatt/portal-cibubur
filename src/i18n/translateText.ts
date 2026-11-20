import { EN_DICTIONARY } from './en';

/**
 * Terjemahan teks tampilan ID → EN tanpa AI: kamus statis (angka diganti {0},{1}, …)
 * dan nama hari/bulan. Mengembalikan null bila teks perlu diterjemahkan Gemini.
 */

const NUM = /\d+(?:[.,:]\d+)*/g;

export function templateKey(core: string): { key: string; nums: string[] } {
  const nums: string[] = [];
  const key = core.replace(NUM, (m) => `{${nums.push(m) - 1}}`);
  return { key, nums };
}

const DATE_WORDS: Record<string, string> = {
  senin: 'Monday',
  selasa: 'Tuesday',
  rabu: 'Wednesday',
  kamis: 'Thursday',
  jumat: 'Friday',
  "jum'at": 'Friday',
  sabtu: 'Saturday',
  minggu: 'Sunday',
  januari: 'January',
  februari: 'February',
  maret: 'March',
  april: 'April',
  mei: 'May',
  juni: 'June',
  juli: 'July',
  agustus: 'August',
  september: 'September',
  oktober: 'October',
  november: 'November',
  desember: 'December',
  jan: 'Jan',
  feb: 'Feb',
  mar: 'Mar',
  apr: 'Apr',
  jun: 'Jun',
  jul: 'Jul',
  agu: 'Aug',
  agt: 'Aug',
  ags: 'Aug',
  sep: 'Sep',
  okt: 'Oct',
  nov: 'Nov',
  des: 'Dec',
  sen: 'Mon',
  sel: 'Tue',
  rab: 'Wed',
  kam: 'Thu',
  jum: 'Fri',
  sab: 'Sat',
  min: 'Sun',
  wib: 'WIB'
};

/** "Jumat, 20 November 2026" → "Friday, 20 November 2026" (hanya bila seluruhnya tanggal). */
export function translateDate(core: string): string | null {
  const words = core.match(/[A-Za-z']+/g);
  if (!words || !words.every((w) => DATE_WORDS[w.toLowerCase()])) return null;
  return core.replace(/[A-Za-z']+/g, (w) => DATE_WORDS[w.toLowerCase()]);
}

/** Butuh diterjemahkan sama sekali? (tanpa huruf, kode agen, atau URL → tidak). */
export function needsTranslation(core: string): boolean {
  if (!/[A-Za-z]{2}/.test(core)) return false;
  if (/^[A-Z0-9]{2,8}$/.test(core)) return false; // kode agen
  if (/^(https?:\/\/|www\.|#)\S+$/.test(core)) return false;
  if (/^\S+@\S+$/.test(core)) return false;
  return true;
}

export function translateStatic(core: string): string | null {
  const exact = EN_DICTIONARY[core];
  if (exact !== undefined) return exact;
  const { key, nums } = templateKey(core);
  const tpl = nums.length > 0 ? EN_DICTIONARY[key] : undefined;
  if (tpl !== undefined) return tpl.replace(/\{(\d+)\}/g, (_, i: string) => nums[Number(i)] ?? '');
  return translateDate(core);
}
