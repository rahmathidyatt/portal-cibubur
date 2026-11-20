import type { AgentBirthday } from '../birthdays/birthdays';
import { formatMonth, mainAgents, type Closing } from '../closing/closing';

/**
 * WOF (Wheel of Fortune): agen yang closing di bulan ulang tahunnya.
 * Menghubungkan data Ulang tahun agen dengan data Closing.
 */
export interface WofClaim {
  name: string;
  code: string;
  birthday: AgentBirthday;
  closing: Closing;
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ID_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const norm = (s: string) => s.trim().toUpperCase();

const stripCode = (s: string) => norm(s).replace(/\s*\([^)]*\)\s*$/, '');
const firstWord = (s: string) => stripCode(s).split(/\s+/)[0] ?? '';

/**
 * Closing di bulan `month` (YYYY-MM) oleh agen yang berulang tahun di bulan itu.
 * Pencocokan ketat: kode PA saat closing harus sama dengan kode di data ulang tahun,
 * dan nama depannya juga harus sama. Nama sama dengan kode berbeda = orang berbeda.
 */
export function findWofClaims(closings: Closing[], birthdays: AgentBirthday[], month: string): WofClaim[] {
  const m = Number(month.slice(5, 7));
  const byCode = new Map(birthdays.map((b) => [norm(b.code), b]));
  const claims: WofClaim[] = [];
  const seen = new Set<string>();
  const sorted = closings.filter((c) => c.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  for (const c of sorted) {
    for (const a of mainAgents(c)) {
      const code = norm(a.code);
      if (!code) continue;
      const b = byCode.get(code);
      if (!b || b.month !== m || firstWord(b.name) !== firstWord(a.name)) continue;
      const key = `${c.id}:${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Nama & kode ditulis sesuai data saat closing.
      claims.push({ name: stripCode(a.name), code, birthday: b, closing: c });
    }
  }
  return claims;
}

/** Agen closing di bulan itu yang kodenya kosong (tidak bisa dicek WOF). */
export function closingsWithoutCode(closings: Closing[], month: string): { name: string; closing: Closing }[] {
  return closings
    .filter((c) => c.date.startsWith(month))
    .flatMap((c) => mainAgents(c).filter((a) => !a.code.trim()).map((a) => ({ name: a.name.trim(), closing: c })));
}

/** "28 Oct 1986" (tahun ditulis bila tersedia). */
export function formatBirthday(b: AgentBirthday): string {
  return `${String(b.day).padStart(2, '0')} ${EN_MONTHS[b.month - 1]}${b.year ? ` ${b.year}` : ''}`;
}

/** "2026-10-05" → "05 Oktober 2026". */
export function formatTransactionDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${ID_MONTHS[m - 1]} ${y}`;
}

export function buildWofBc(claims: WofClaim[]): string {
  if (claims.length === 0) return '';
  const blocks = claims.map((c) =>
    [
      `Nama & Kode PA: ${c.name}${c.code ? ` (${c.code})` : ''}`,
      `Tanggal Ulang Tahun: ${formatBirthday(c.birthday)}`,
      `Alamat Transaksi: ${c.closing.type} – ${c.closing.location.trim().toUpperCase()}`,
      `Tanggal Transaksi: ${formatTransactionDate(c.closing.date)}`
    ].join('\n')
  );
  return ['Klaim wheel of fortune', blocks.join('\n\n')].join('\n');
}

export { formatMonth };
