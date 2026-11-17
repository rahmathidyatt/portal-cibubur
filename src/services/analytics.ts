import type { AdminAuth } from './bookingStore';
import { getSupabaseConfig, randomId, readLocal, supabaseFetch, writeLocal } from './supabaseClient';

/**
 * Statistik kunjungan portal (khusus admin).
 * - Kunjungan = satu sesi browser (tab baru / browser dibuka ulang = sesi baru).
 * - Setiap halaman yang dibuka dalam sesi dicatat sekali (untuk "halaman terpopuler").
 * - Pengunjung unik dikenali dari ID acak di browser; tidak ada data pribadi yang dikirim.
 */
export type Device = 'mobile' | 'tablet' | 'desktop';

export interface DailyViews {
  date: string; // YYYY-MM-DD (WIB)
  views: number; // kunjungan
  visitors: number;
}

export interface ViewStats {
  rangeDays: number;
  totalViews: number;
  uniqueVisitors: number;
  todayViews: number;
  todayVisitors: number;
  last7Views: number;
  rangeViews: number;
  rangeVisitors: number;
  prevRangeViews: number;
  pageViews: number;
  daily: DailyViews[];
  topPages: { path: string; views: number }[];
  /** Kunjungan per jam mulai (0–23 WIB) dalam rentang. */
  hours: number[];
  devices: Record<Device | 'unknown', number>;
}

const VISITOR_KEY = 'portal-cibubur:visitor-id';
const SESSION_KEY = 'portal-cibubur:session-id';
const SEEN_KEY = 'portal-cibubur:pages-seen';
const LOCAL_VIEWS_KEY = 'portal-cibubur:page-views';

interface LocalHit {
  v: string;
  at: string;
  s?: string;
  p?: string;
  d?: Device;
}

function visitorId(): string {
  let id = readLocal<string>(VISITOR_KEY, '');
  if (!id) {
    id = randomId();
    writeLocal(VISITOR_KEY, id);
  }
  return id;
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

let memorySession = '';
const memorySeen = new Set<string>();

function sessionId(): string {
  const store = sessionStore();
  let id = store?.getItem(SESSION_KEY) ?? memorySession;
  if (!id) {
    id = randomId();
    store?.setItem(SESSION_KEY, id);
    memorySession = id;
  }
  return id;
}

/** Tandai halaman sudah tercatat di sesi ini; false bila sudah pernah. */
function markSeen(path: string): boolean {
  const store = sessionStore();
  let seen: string[] = [];
  try {
    seen = JSON.parse(store?.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    seen = [];
  }
  if (seen.includes(path) || memorySeen.has(path)) return false;
  memorySeen.add(path);
  store?.setItem(SEEN_KEY, JSON.stringify([...seen, path]));
  return true;
}

export function detectDevice(width: number, userAgent: string): Device {
  if (/iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(userAgent) || width < 640) return 'mobile';
  if (width < 1024 && 'ontouchstart' in window) return 'tablet';
  return 'desktop';
}

function jakartaDate(d: Date): string {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function jakartaHour(d: Date): number {
  return new Date(d.getTime() + 7 * 3_600_000).getUTCHours();
}

let pendingVisit: Promise<void> = Promise.resolve();

/** Selesai setelah halaman terakhir tercatat (agar statistik sudah menghitungnya). */
export function whenVisitRecorded(): Promise<void> {
  return pendingVisit;
}

/** Catat halaman yang dibuka (sekali per halaman per sesi). */
export function recordVisit(path: string): Promise<void> {
  const page = (path || 'beranda').slice(0, 64);
  if (!markSeen(page)) return pendingVisit;
  pendingVisit = pendingVisit.then(() => doRecord(page)).catch(() => undefined);
  return pendingVisit;
}

async function doRecord(path: string): Promise<void> {
  const hit = {
    v: visitorId(),
    s: sessionId(),
    p: path,
    d: detectDevice(window.innerWidth, navigator.userAgent)
  };
  const config = getSupabaseConfig();
  try {
    if (config) {
      await supabaseFetch(config, 'rest/v1/rpc/record_page_view', {
        method: 'POST',
        body: JSON.stringify({ p_visitor: hit.v, p_path: hit.p, p_session: hit.s, p_device: hit.d })
      });
    } else {
      const list = readLocal<LocalHit[]>(LOCAL_VIEWS_KEY, []);
      writeLocal(LOCAL_VIEWS_KEY, [...(Array.isArray(list) ? list : []), { ...hit, at: new Date().toISOString() }]);
    }
  } catch {
    // Statistik tidak boleh mengganggu pemakaian portal.
  }
}

/** Ringkasan dari daftar catatan halaman (dipakai mode demo & tes; sama dengan fungsi SQL). */
export function summarizeViews(hits: LocalHit[], now: Date, days = 14): ViewStats {
  const today = jakartaDate(now);
  const from = jakartaDate(new Date(now.getTime() - (days - 1) * 86_400_000));
  const prevFrom = jakartaDate(new Date(now.getTime() - (2 * days - 1) * 86_400_000));
  // Satu sesi = waktu catatan paling awal di sesi tersebut.
  const sessions = new Map<string, { v: string; ms: number; d: string; hour: number; device?: Device }>();
  hits.forEach((h, i) => {
    const sid = h.s ?? `row-${i}`;
    const at = new Date(h.at);
    const cur = sessions.get(sid);
    if (!cur || at.getTime() < cur.ms) {
      sessions.set(sid, { v: h.v, ms: at.getTime(), d: jakartaDate(at), hour: jakartaHour(at), device: h.d ?? cur?.device });
    } else if (!cur.device && h.d) {
      cur.device = h.d;
    }
  });
  const all = [...sessions.values()];
  const inRange = all.filter((s) => s.d >= from && s.d <= today);
  const daily: DailyViews[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = jakartaDate(new Date(now.getTime() - i * 86_400_000));
    const list = all.filter((s) => s.d === date);
    daily.push({ date, views: list.length, visitors: new Set(list.map((s) => s.v)).size });
  }
  const todayList = all.filter((s) => s.d === today);
  const last7From = jakartaDate(new Date(now.getTime() - 6 * 86_400_000));
  const pages = new Map<string, number>();
  for (const h of hits) {
    const d = jakartaDate(new Date(h.at));
    if (d < from || d > today) continue;
    const p = h.p || 'beranda';
    pages.set(p, (pages.get(p) ?? 0) + 1);
  }
  const hours = Array.from({ length: 24 }, () => 0);
  const devices: ViewStats['devices'] = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
  for (const s of inRange) {
    hours[s.hour] += 1;
    devices[s.device ?? 'unknown'] += 1;
  }
  return {
    rangeDays: days,
    totalViews: all.length,
    uniqueVisitors: new Set(all.map((s) => s.v)).size,
    todayViews: todayList.length,
    todayVisitors: new Set(todayList.map((s) => s.v)).size,
    last7Views: all.filter((s) => s.d >= last7From && s.d <= today).length,
    rangeViews: inRange.length,
    rangeVisitors: new Set(inRange.map((s) => s.v)).size,
    prevRangeViews: all.filter((s) => s.d >= prevFrom && s.d < from).length,
    pageViews: [...pages.values()].reduce((a, b) => a + b, 0),
    daily,
    topPages: [...pages.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
      .slice(0, 8),
    hours,
    devices
  };
}

/** Ringkasan kunjungan untuk menu admin "Statistik portal". */
export async function getViewStats(auth: AdminAuth, days = 14): Promise<ViewStats> {
  if (!auth.isAdmin) throw new Error('Statistik hanya untuk admin.');
  const config = getSupabaseConfig();
  if (!config) {
    const list = readLocal<LocalHit[]>(LOCAL_VIEWS_KEY, []);
    return summarizeViews(Array.isArray(list) ? list : [], new Date(), days);
  }
  const res = await supabaseFetch(config, 'rest/v1/rpc/page_view_stats', {
    method: 'POST',
    accessToken: auth.accessToken,
    body: JSON.stringify({ p_days: days })
  });
  return (await res.json()) as ViewStats;
}

/** Nama halaman yang mudah dibaca untuk path rute. */
export function pageLabel(path: string): string {
  const labels: Record<string, string> = {
    beranda: 'Beranda',
    floortime: 'Floortime',
    'dealing-room': 'Dealing Room',
    'jadwal-saya': 'Jadwal saya',
    'business-manager': 'Business Manager',
    'kontak-staf': 'Kontak staf',
    'jam-operasional': 'Jam & lokasi',
    'staf-statistik': 'Admin · Statistik',
    'staf-floor-time': 'Admin · Floor Time Scheduler',
    'staf-nota': 'Admin · Nota Messenger',
    'staf-jingle': 'Admin · Jingle',
    'staf-ulang-tahun': 'Admin · Ulang tahun'
  };
  return labels[path] ?? path;
}
