/** Analisis pemakaian Gemini dari tabel ai_usage_log (dicatat edge function minbur-ai). */

export type UsageStatus = 'ok' | 'busy' | 'rate_limit' | 'timeout' | 'error';
export type ModelLabel = 'Flash' | 'Flash-Lite';

export interface UsageRow {
  createdAt: string;
  mode: string;
  model: string;
  status: UsageStatus;
  fallback: boolean;
  durationMs: number | null;
  question: string | null;
}

export interface GeminiLimits {
  flash: number;
  lite: number;
}

/** Perkiraan jatah gratis harian (bisa diubah admin sesuai halaman Rate limit di AI Studio). */
export const DEFAULT_LIMITS: GeminiLimits = { flash: 20, lite: 500 };

export const MODE_LABEL: Record<string, string> = {
  chat: 'Epigram',
  translate: 'Terjemahan EN',
  wish: 'Ucapan ulang tahun',
  nota: 'Scan nota'
};

export const STATUS_LABEL: Record<UsageStatus, string> = {
  ok: 'Berhasil',
  busy: 'Gemini sibuk',
  rate_limit: 'Kena batas',
  timeout: 'Terlalu lama',
  error: 'Gagal'
};

export function modelLabel(model: string): ModelLabel {
  return /lite/i.test(model) ? 'Flash-Lite' : 'Flash';
}

/** Selisih zona waktu (ms) Los Angeles terhadap UTC pada saat `d`. */
function pacificOffsetMs(d: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Awal jatah harian Gemini: tengah malam waktu Pacific (sekitar 14.00/15.00 WIB). */
export function quotaWindowStart(now: Date): Date {
  const off = pacificOffsetMs(now);
  const local = new Date(now.getTime() + off);
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocal - pacificOffsetMs(new Date(midnightLocal - off)));
}

/** Pemakaian jatah sejak reset terakhir (permintaan yang ditolak karena batas tidak dihitung). */
export function usageToday(rows: UsageRow[], now: Date): Record<ModelLabel, number> {
  const start = quotaWindowStart(now).getTime();
  const out: Record<ModelLabel, number> = { Flash: 0, 'Flash-Lite': 0 };
  for (const r of rows) {
    if (r.status === 'rate_limit' || new Date(r.createdAt).getTime() < start) continue;
    out[modelLabel(r.model)]++;
  }
  return out;
}

/** "2026-11-22" (tanggal WIB) dari ISO. */
export function wibDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Jumlah panggilan per hari (WIB) selama `days` hari terakhir, urut lama → baru. */
export function dailyCounts(rows: UsageRow[], today: string, days = 30): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(wibDate(r.createdAt), (counts.get(wibDate(r.createdAt)) ?? 0) + 1);
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function countBy<T extends string>(rows: UsageRow[], key: (r: UsageRow) => T): { label: T; count: number }[] {
  const map = new Map<T, number>();
  for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Pertanyaan Epigram terbanyak (huruf kecil, spasi dirapikan). */
export function topQuestions(rows: UsageRow[], limit = 10): { label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    if (r.mode !== 'chat' || !r.question) continue;
    const key = r.question.toLowerCase().replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
    if (!key) continue;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { label: r.question.trim(), count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
