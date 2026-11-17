import type { AdminAuth } from './bookingStore';
import { getSupabaseConfig, randomId, readLocal, supabaseFetch, writeLocal } from './supabaseClient';

/**
 * Statistik kunjungan portal.
 * Satu kunjungan = satu sesi browser (refresh / pindah halaman di tab yang sama tidak dihitung ulang).
 * Pengunjung unik dikenali dari ID acak di browser; tidak ada data pribadi yang dikirim.
 */
export interface DailyViews {
  date: string; // YYYY-MM-DD (WIB)
  views: number;
  visitors: number;
}

export interface ViewStats {
  totalViews: number;
  uniqueVisitors: number;
  todayViews: number;
  todayVisitors: number;
  last7Views: number;
  daily: DailyViews[]; // urut naik, 14 hari terakhir
}

const VISITOR_KEY = 'portal-cibubur:visitor-id';
const SESSION_KEY = 'portal-cibubur:visit-recorded';
const LOCAL_VIEWS_KEY = 'portal-cibubur:page-views';

function visitorId(): string {
  let id = readLocal<string>(VISITOR_KEY, '');
  if (!id) {
    id = randomId();
    writeLocal(VISITOR_KEY, id);
  }
  return id;
}

function jakartaDate(d: Date): string {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Dipanggil sekali saat portal dibuka. */
export async function recordVisit(path: string): Promise<void> {
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return;
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage tidak tersedia: tetap catat sekali per pemuatan halaman.
  }
  const visitor = visitorId();
  const config = getSupabaseConfig();
  try {
    if (config) {
      await supabaseFetch(config, 'rest/v1/rpc/record_page_view', {
        method: 'POST',
        body: JSON.stringify({ p_visitor: visitor, p_path: path.slice(0, 64) })
      });
    } else {
      const list = readLocal<{ v: string; at: string }[]>(LOCAL_VIEWS_KEY, []);
      writeLocal(LOCAL_VIEWS_KEY, [...(Array.isArray(list) ? list : []), { v: visitor, at: new Date().toISOString() }]);
    }
  } catch {
    // Statistik tidak boleh mengganggu pemakaian portal.
  }
}

export function summarizeViews(views: { v: string; at: string }[], now: Date, days = 14): ViewStats {
  const today = jakartaDate(now);
  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  for (const { v, at } of views) {
    const day = jakartaDate(new Date(at));
    const bucket = byDay.get(day) ?? { views: 0, visitors: new Set<string>() };
    bucket.views += 1;
    bucket.visitors.add(v);
    byDay.set(day, bucket);
  }
  const daily: DailyViews[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = jakartaDate(new Date(now.getTime() - i * 86_400_000));
    const b = byDay.get(date);
    daily.push({ date, views: b?.views ?? 0, visitors: b?.visitors.size ?? 0 });
  }
  return {
    totalViews: views.length,
    uniqueVisitors: new Set(views.map((x) => x.v)).size,
    todayViews: byDay.get(today)?.views ?? 0,
    todayVisitors: byDay.get(today)?.visitors.size ?? 0,
    last7Views: daily.slice(-7).reduce((s, d) => s + d.views, 0),
    daily
  };
}

export async function getViewStats(auth: AdminAuth): Promise<ViewStats> {
  if (!auth.isAdmin) throw new Error('Statistik hanya untuk admin.');
  const config = getSupabaseConfig();
  if (!config) {
    const list = readLocal<{ v: string; at: string }[]>(LOCAL_VIEWS_KEY, []);
    return summarizeViews(Array.isArray(list) ? list : [], new Date());
  }
  const res = await supabaseFetch(config, 'rest/v1/rpc/page_view_stats', {
    method: 'POST',
    accessToken: auth.accessToken,
    body: JSON.stringify({ p_days: 14 })
  });
  return (await res.json()) as ViewStats;
}
