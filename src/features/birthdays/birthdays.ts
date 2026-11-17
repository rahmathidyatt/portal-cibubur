import type { Row } from '../floortime/spreadsheet';

/**
 * Data ulang tahun agen. Tahun lahir sengaja tidak disimpan:
 * portal hanya butuh tanggal & bulan untuk pengingat.
 */
export interface AgentBirthday {
  code: string;
  name: string;
  month: number; // 1-12
  day: number; // 1-31
}

export interface ParseResult {
  entries: AgentBirthday[];
  /** Baris yang dilewati beserta alasannya (nomor baris mengikuti file, judul = baris 1). */
  skipped: { line: number; reason: string }[];
}

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, peb: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, aug: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, nop: 11, november: 11,
  des: 12, dec: 12, desember: 12, december: 12
};

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function valid(month: number, day: number): { month: number; day: number } | null {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  return { month, day };
}

/**
 * Membaca tanggal lahir dalam format yang umum dipakai:
 * "15-Nov-79", "15 November 1979", "15/11/1979", "1979-11-15", atau nomor seri tanggal Excel.
 */
export function parseBirthDate(raw: string): { month: number; day: number } | null {
  const s = raw.trim();
  if (!s) return null;
  // Nomor seri Excel (hari sejak 1899-12-30).
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000);
    return valid(d.getUTCMonth() + 1, d.getUTCDate());
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{2,4}))?$/);
  if (m) return valid(Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{1,2})[-/. ]+([A-Za-z]+)\.?(?:[-/., ]+(\d{2,4}))?$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    return month ? valid(month, Number(m[1])) : null;
  }
  return null;
}

function pick(row: Row, keys: string[]): string {
  for (const [k, v] of Object.entries(row)) {
    const norm = k.toLowerCase().replace(/[^a-z]/g, '');
    if (keys.includes(norm)) return (v ?? '').trim();
  }
  return '';
}

/** Mengubah baris CSV/XLSX (kolom Code, Nama Panggilan, Tgl Lahir) menjadi data ulang tahun. */
export function parseBirthdayRows(rows: Row[]): ParseResult {
  const entries = new Map<string, AgentBirthday>();
  const skipped: ParseResult['skipped'] = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const name = pick(row, ['namapanggilan', 'nama', 'name', 'namaagen']);
    let code = pick(row, ['code', 'kode', 'kodeagen']).toUpperCase();
    const date = pick(row, ['tgllahir', 'tanggallahir', 'tgl', 'tanggal', 'birthdate', 'birthday', 'dob']);
    if (!name && !code && !date) return; // baris kosong
    if (!code) code = name.match(/\(([A-Za-z0-9]+)\)\s*$/)?.[1]?.toUpperCase() ?? '';
    if (!name) return void skipped.push({ line, reason: 'Nama kosong' });
    if (!code) return void skipped.push({ line, reason: 'Kode agen kosong' });
    const parsed = parseBirthDate(date);
    if (!parsed) return void skipped.push({ line, reason: `Tanggal lahir tidak terbaca: "${date}"` });
    entries.set(code, { code, name: name.replace(/\s+/g, ' '), ...parsed });
  });
  return { entries: [...entries.values()].sort(compareBirthday), skipped };
}

export function compareBirthday(a: AgentBirthday, b: AgentBirthday): number {
  return a.month - b.month || a.day - b.day || a.name.localeCompare(b.name);
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Ulang tahun pada tanggal ISO tertentu (29 Feb dirayakan 28 Feb di tahun biasa). */
export function birthdaysOn(list: AgentBirthday[], iso: string): AgentBirthday[] {
  const [y, m, d] = iso.split('-').map(Number);
  return list
    .filter(
      (b) =>
        (b.month === m && b.day === d) ||
        (!isLeap(y) && m === 2 && d === 28 && b.month === 2 && b.day === 29)
    )
    .sort(compareBirthday);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Pengingat beranda: yang berulang tahun hari ini (H) dan besok (H-1). */
export function birthdayReminders(list: AgentBirthday[], todayIso: string) {
  return { today: birthdaysOn(list, todayIso), tomorrow: birthdaysOn(list, addDaysIso(todayIso, 1)) };
}
