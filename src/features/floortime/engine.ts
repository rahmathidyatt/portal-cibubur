/**
 * Mesin Floor Time Scheduler — port dari aplikasi Streamlit
 * github.com/rahmathidyatt/floor-time (app.py).
 *
 * Aturan yang sama dengan versi Python:
 * - Hari kerja Senin–Sabtu; minggu lintas bulan diikutkan (Senin pertama s/d Sabtu terakhir).
 * - Senin–Jumat: Pagi 08.00–12.30, Siang 12.30–17.00. Sabtu: Pagi 08.00–11.30, Siang 11.30–15.00.
 * - Agen tidak pernah dua kali pada tanggal yang sama; target 1x/2x/3x per minggu.
 * - Kapasitas shift diperluas otomatis agar target semua agen terpenuhi.
 * - Pemerataan: urutan acak lalu diurutkan berdasarkan jumlah tugas, rotasi hari dari minggu
 *   sebelumnya, beban slot, keragaman unit, jarak hari, dan rotasi shift.
 * Semua tanggal memakai string ISO "YYYY-MM-DD".
 */

/* ------------------------------------------------------------------ */
/* Konstanta                                                           */
/* ------------------------------------------------------------------ */

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** 0 = Senin ... 6 = Minggu (sama dengan date.weekday() di Python). */
export const DAY_NAMES_ID = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

export const SHIFT_NAMES = ['Pagi', 'Siang'] as const;

const WEEKDAY_SHIFTS: [string, string][] = [
  ['Pagi', '08.00-12.30'],
  ['Siang', '12.30-17.00']
];
const SATURDAY_SHIFTS: [string, string][] = [
  ['Pagi', '08.00-11.30'],
  ['Siang', '11.30-15.00']
];

export function shiftTemplatesFor(weekday: number): [string, string][] {
  if (weekday === 5) return SATURDAY_SHIFTS;
  if (weekday >= 0 && weekday <= 4) return WEEKDAY_SHIFTS;
  return [];
}

export const DEFAULT_POSTER_NOTES = [
  'Agen yang mendapatkan jadwal floor time masih berada di kantor.',
  'Penanganan klien berdasarkan agen yang melakukan absensi pertama.'
];

/* ------------------------------------------------------------------ */
/* Tipe data                                                           */
/* ------------------------------------------------------------------ */

export interface Agent {
  id: string;
  name: string;
  code: string;
  /** Kolom Office, mis. "Brighton Priority Cibubur, Bogor". */
  office: string;
  jobTitle: string;
  /** Total kehadiran bulan sebelumnya. */
  attendance: number;
}

export interface ShiftSlot {
  /** `${date}__${shiftIndex}` */
  key: string;
  weekNo: number;
  date: string;
  weekday: number;
  shiftIndex: number;
  shiftName: string;
  timeLabel: string;
  baseCapacity: number;
}

export interface AssignmentEntry {
  agentId: string;
  displayName: string;
  isUrgent?: boolean;
}

export interface UrgentRequest {
  agentId: string;
  date: string;
  shiftIndex: number;
  note?: string;
}

export interface ScheduleWeek {
  weekNo: number;
  dates: string[];
}

/** Hasil penjadwalan satu bulan; dipakai juga sebagai data jadwal yang diterbitkan. */
export interface ScheduleData {
  year: number;
  month: number; // 1-12
  hubName: string;
  notes: string[];
  maxWeekly: number;
  weeks: ScheduleWeek[];
  /** tanggal ISO → nama hari libur */
  holidays: Record<string, string>;
  slots: ShiftSlot[];
  /** slot.key → daftar agen */
  assignments: Record<string, AssignmentEntry[]>;
  agents: Agent[];
}

export interface ScheduleConfig {
  year: number;
  month: number;
  hubName: string;
  notes: string[];
  weekdayCapacity: number;
  saturdayCapacity: number;
  maxWeekly: number;
  holidays: Record<string, string>;
  urgentRequests: UrgentRequest[];
  /** Kode audit: isi agar hasil acak dapat diulang. Kosong = acak baru setiap generate. */
  seed?: string;
}

/* ------------------------------------------------------------------ */
/* Utilitas teks & tanggal                                             */
/* ------------------------------------------------------------------ */

export function cleanText(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (text.toLowerCase() === 'nan') return '';
  text = text.trim().replace(/^[-•*;]+|[-•*;]+$/g, '');
  return text.replace(/\s+/g, ' ').trim();
}

export function displayName(agent: Pick<Agent, 'name' | 'code'>): string {
  return agent.code ? `${agent.name} (${agent.code})` : agent.name;
}

/** Unit = kata kedua kolom Office ("Brighton Priority Cibubur, Bogor" → "Priority"). */
export function agentUnit(agent: Pick<Agent, 'office'>): string {
  const words = cleanText(agent.office).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const unit = words.length >= 2 ? words[1] : words[0];
  return unit.replace(/^[ ,.;:-]+|[ ,.;:-]+$/g, '');
}

/** "TONI (ACYS)" → ["TONI", "ACYS"] */
export function parseAgentDisplay(value: unknown): [string, string] {
  const text = cleanText(value);
  if (!text) return ['', ''];
  const match = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (match) return [cleanText(match[1]), cleanText(match[2]).toUpperCase()];
  return [text, ''];
}

/** Hash deterministik (cyrb53) → id 14 karakter heksadesimal. */
function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 14);
}

export function makeAgentId(name: string, code: string): string {
  return hashString(`${name.toLowerCase()}|${code.toLowerCase()}`);
}

function parseIntNonNegative(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Math.trunc(Number(String(value).replace(',', '.')));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function isoFromParts(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Senin ... 6 = Minggu */
export function weekdayOf(iso: string): number {
  return (parseIso(iso).getUTCDay() + 6) % 7;
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(a).getTime() - parseIso(b).getTime()) / 86_400_000);
}

export function formatDateId(iso: string, includeYear = false): string {
  const d = parseIso(iso);
  const base = `${String(d.getUTCDate()).padStart(2, '0')} ${MONTH_NAMES_ID[d.getUTCMonth()]}`;
  return includeYear ? `${base} ${d.getUTCFullYear()}` : base;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_ID[month - 1]} ${year}`;
}

export function previousMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

export function dateOptionLabel(iso: string): string {
  return `${DAY_NAMES_ID[weekdayOf(iso)]} | ${formatDateId(iso, true)}`;
}

export function weekRangeLabel(dates: string[]): string {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort();
  const start = parseIso(sorted[0]);
  const end = parseIso(sorted[sorted.length - 1]);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    const monthName = MONTH_NAMES_ID[start.getUTCMonth()].toUpperCase();
    return `${String(start.getUTCDate()).padStart(2, '0')} ${monthName} ${start.getUTCFullYear()} - ${String(end.getUTCDate()).padStart(2, '0')} ${monthName} ${end.getUTCFullYear()}`;
  }
  return `${formatDateId(sorted[0], true).toUpperCase()} - ${formatDateId(sorted[sorted.length - 1], true).toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/* Data agen                                                           */
/* ------------------------------------------------------------------ */

/**
 * Normalisasi baris tabel (hasil baca Excel/CSV) menjadi daftar agen.
 * Format utama: No | Nama | Jabatan | Office | Total. Alias lama tetap dibaca.
 */
export function rowsToAgents(rows: Record<string, unknown>[]): { agents: Agent[]; warnings: string[] } {
  const agents: Agent[] = [];
  const warnings: string[] = [];
  if (rows.length === 0) return { agents, warnings };

  const columns = Object.keys(rows[0]);
  const normalized = new Map(columns.map((c) => [c.trim().toLowerCase(), c]));
  const find = (candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const hit = normalized.get(c.toLowerCase());
      if (hit !== undefined) return hit;
    }
    return undefined;
  };

  let agentCol = find(['Agent', 'Agen', 'Nama Agen', 'Nama', 'Property Advisor', 'PA']);
  const nameCol = find(['Name']);
  const codeCol = find(['Code', 'Kode', 'Kode Agen']);
  const attendanceCol = find([
    'Kehadiran', 'Attendance', 'Previous Month Attendance',
    'previousMonthAttendance', 'Total Kehadiran', 'Total'
  ]);
  const officeCol = find(['Office', 'Kantor', 'Business Unit', 'BusinessUnit', 'Bisnis Unit', 'BU', 'Unit']);
  const jobCol = find(['Jabatan', 'Position', 'Role', 'Job Title', 'Title']);
  if (agentCol === undefined && nameCol === undefined) agentCol = columns[0];

  const seen = new Set<string>();
  for (const row of rows) {
    let name: string;
    let code: string;
    if (nameCol !== undefined) {
      name = cleanText(row[nameCol]);
      code = codeCol !== undefined ? cleanText(row[codeCol]).toUpperCase() : '';
    } else {
      const [parsedName, parsedCode] = parseAgentDisplay(row[agentCol as string]);
      name = parsedName;
      const explicit = codeCol !== undefined ? cleanText(row[codeCol]).toUpperCase() : '';
      code = explicit || parsedCode;
    }
    if (!name) continue;
    const id = makeAgentId(name, code);
    if (seen.has(id)) {
      warnings.push(`Duplikat agen diabaikan: ${name}${code ? ` (${code})` : ''}.`);
      continue;
    }
    seen.add(id);
    agents.push({
      id,
      name,
      code,
      office: officeCol !== undefined ? cleanText(row[officeCol]) : '',
      jobTitle: jobCol !== undefined ? cleanText(row[jobCol]) : '',
      attendance: attendanceCol !== undefined ? parseIntNonNegative(row[attendanceCol]) : 0
    });
  }
  return { agents, warnings };
}

export function filterAgentsForSchedule(
  agents: Agent[],
  minimumAttendance = 0,
  excludedIds: Iterable<string> = []
): Agent[] {
  const minimum = Math.max(0, Math.trunc(minimumAttendance));
  const excluded = new Set(excludedIds);
  return agents.filter((a) => a.attendance >= minimum && !excluded.has(a.id));
}

export type RosterSort = 'default' | 'desc' | 'asc';

export function sortAgentsForRoster(agents: Agent[], mode: RosterSort = 'default'): Agent[] {
  const list = [...agents];
  if (mode === 'desc') return list.sort((a, b) => b.attendance - a.attendance);
  if (mode === 'asc') return list.sort((a, b) => a.attendance - b.attendance);
  return list;
}

/* ------------------------------------------------------------------ */
/* Kalender & slot                                                     */
/* ------------------------------------------------------------------ */

/** Senin–Sabtu dari semua minggu yang menyentuh bulan target. */
export function getMonthWorkDates(year: number, month: number): string[] {
  const first = isoFromParts(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = isoFromParts(year, month, lastDay);
  const startMonday = addDaysIso(first, -weekdayOf(first));
  let lastActive = last;
  if (weekdayOf(lastActive) === 6) lastActive = addDaysIso(lastActive, -1);
  const endSaturday = addDaysIso(lastActive, 5 - weekdayOf(lastActive));

  const dates: string[] = [];
  for (let d = startMonday; d <= endSaturday; d = addDaysIso(d, 1)) {
    if (weekdayOf(d) <= 5) dates.push(d);
  }
  return dates;
}

export function groupDatesByWeek(dates: string[]): ScheduleWeek[] {
  const groups = new Map<string, string[]>();
  for (const d of dates) {
    const monday = addDaysIso(d, -weekdayOf(d));
    const list = groups.get(monday) ?? [];
    list.push(d);
    groups.set(monday, list);
  }
  return [...groups.keys()]
    .sort()
    .map((monday, i) => ({ weekNo: i + 1, dates: (groups.get(monday) ?? []).sort() }));
}

export function slotKey(date: string, shiftIndex: number): string {
  return `${date}__${shiftIndex}`;
}

export function buildSlots(
  weeks: ScheduleWeek[],
  holidays: Record<string, string>,
  weekdayCapacity: number,
  saturdayCapacity: number
): ShiftSlot[] {
  const slots: ShiftSlot[] = [];
  for (const week of weeks) {
    for (const date of week.dates) {
      const weekday = weekdayOf(date);
      if (weekday > 5 || holidays[date] !== undefined) continue;
      const capacity = weekday === 5 ? saturdayCapacity : weekdayCapacity;
      shiftTemplatesFor(weekday).forEach(([shiftName, timeLabel], shiftIndex) => {
        slots.push({
          key: slotKey(date, shiftIndex),
          weekNo: week.weekNo,
          date,
          weekday,
          shiftIndex,
          shiftName,
          timeLabel,
          baseCapacity: capacity
        });
      });
    }
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* Acak                                                                */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

/** RNG ber-seed (cyrb128 + sfc32) agar kode audit menghasilkan jadwal yang sama. */
export function makeRng(seed?: string): Rng {
  if (!seed || !seed.trim()) return Math.random;
  const str = seed.trim();
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  let a = h1 >>> 0, b = h2 >>> 0, c = h3 >>> 0, d = h4 >>> 0;
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rng: Rng): void {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

function compareTuples(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function minBy<T>(items: T[], key: (item: T) => number[]): T {
  let best = items[0];
  let bestKey = key(best);
  for (let i = 1; i < items.length; i++) {
    const k = key(items[i]);
    if (compareTuples(k, bestKey) < 0) {
      best = items[i];
      bestKey = k;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Penjadwalan                                                         */
/* ------------------------------------------------------------------ */

export interface GenerateResult {
  data: ScheduleData;
  warnings: string[];
  validation: { ok: boolean; messages: string[] };
}

export function generateSchedule(agents: Agent[], config: ScheduleConfig): GenerateResult {
  const rng = makeRng(config.seed);
  const warnings: string[] = [];
  const weeks = groupDatesByWeek(getMonthWorkDates(config.year, config.month));
  const holidays = { ...config.holidays };
  const slots = buildSlots(weeks, holidays, config.weekdayCapacity, config.saturdayCapacity);
  const maxWeekly = config.maxWeekly;

  const assignments: Record<string, AssignmentEntry[]> = {};
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const monthCounts = new Map(agents.map((a) => [a.id, 0]));
  const monthShiftCounts = new Map(agents.map((a) => [a.id, [0, 0]]));
  const lastDateByAgent = new Map<string, string | null>(agents.map((a) => [a.id, null]));
  let previousWeekDays = new Map(agents.map((a) => [a.id, new Set<number>()]));
  const weekdayCounts = new Map(agents.map((a) => [a.id, [0, 0, 0, 0, 0, 0]]));

  const slotsByWeek = new Map<number, ShiftSlot[]>();
  const dateToWeek = new Map<string, number>();
  for (const slot of slots) {
    const list = slotsByWeek.get(slot.weekNo) ?? [];
    list.push(slot);
    slotsByWeek.set(slot.weekNo, list);
    dateToWeek.set(slot.date, slot.weekNo);
  }

  const urgentByWeek = new Map<number, UrgentRequest[]>();
  for (const req of config.urgentRequests) {
    const weekNo = dateToWeek.get(req.date);
    if (weekNo === undefined) {
      const name = agentMap.get(req.agentId);
      warnings.push(`Request ${name ? displayName(name) : 'agen'} dilewati karena tanggal tidak aktif.`);
      continue;
    }
    const list = urgentByWeek.get(weekNo) ?? [];
    list.push(req);
    urgentByWeek.set(weekNo, list);
  }

  for (const week of weeks) {
    const weekSlots = slotsByWeek.get(week.weekNo) ?? [];
    const capacity = new Map<string, number>();
    for (const slot of weekSlots) {
      assignments[slot.key] = [];
      capacity.set(slot.key, slot.baseCapacity);
    }
    if (weekSlots.length === 0) {
      warnings.push(`Periode ${weekRangeLabel(week.dates)} tidak memiliki hari kerja aktif.`);
      continue;
    }

    const activeDates = [...new Set(weekSlots.map((s) => s.date))].sort();
    const label = weekRangeLabel(activeDates);
    const activeDays = activeDates.length;
    const weeklyTarget = Math.min(maxWeekly, activeDays);
    const required = agents.length * weeklyTarget;
    const totalInitial = weekSlots.reduce((sum, s) => sum + s.baseCapacity, 0);
    if (activeDays < maxWeekly) {
      warnings.push(
        `Periode ${label}: hanya ${activeDays} hari aktif; target ${maxWeekly}x tidak dapat dipenuhi tanpa tugas ganda sehari. Setiap agen dijadwalkan maksimal ${weeklyTarget}x.`
      );
    }
    if (required > totalInitial) {
      const perSlot = Math.ceil(required / weekSlots.length);
      for (const slot of weekSlots) capacity.set(slot.key, Math.max(slot.baseCapacity, perSlot));
      warnings.push(`Periode ${label}: kapasitas shift diperluas agar setiap agen mendapat ${weeklyTarget}x jadwal.`);
    }

    const weeklyCounts = new Map(agents.map((a) => [a.id, 0]));
    const agentDates = new Map(agents.map((a) => [a.id, new Set<string>()]));
    const slotLookup = new Map(weekSlots.map((s) => [slotKey(s.date, s.shiftIndex), s]));

    const assign = (agent: Agent, slot: ShiftSlot, urgent = false): boolean => {
      const dates = agentDates.get(agent.id)!;
      if (dates.has(slot.date)) return false;
      if ((weeklyCounts.get(agent.id) ?? 0) >= maxWeekly) return false;
      if (assignments[slot.key].length >= (capacity.get(slot.key) ?? 0)) {
        if (urgent) capacity.set(slot.key, (capacity.get(slot.key) ?? 0) + 1);
        else return false;
      }
      assignments[slot.key].push({ agentId: agent.id, displayName: displayName(agent), isUrgent: urgent });
      weeklyCounts.set(agent.id, (weeklyCounts.get(agent.id) ?? 0) + 1);
      dates.add(slot.date);
      monthCounts.set(agent.id, (monthCounts.get(agent.id) ?? 0) + 1);
      monthShiftCounts.get(agent.id)![slot.shiftIndex] += 1;
      lastDateByAgent.set(agent.id, slot.date);
      weekdayCounts.get(agent.id)![slot.weekday] += 1;
      return true;
    };

    const slotScore = (slot: ShiftSlot, agent: Agent): number[] => {
      const loadRatio = assignments[slot.key].length / Math.max(capacity.get(slot.key) ?? 1, 1);
      const shiftRepeat = monthShiftCounts.get(agent.id)![slot.shiftIndex];
      const sameUnit = agent.office
        ? assignments[slot.key].filter((e) => agentMap.get(e.agentId)?.office === agent.office).length
        : 0;
      const last = lastDateByAgent.get(agent.id);
      let adjacent = 0;
      if (last) {
        const delta = Math.abs(daysBetween(slot.date, last));
        adjacent = delta === 1 ? 2 : delta === 2 ? 1 : 0;
      }
      return [loadRatio, sameUnit, adjacent, shiftRepeat, rng()];
    };

    // 1) Request khusus lebih dahulu (tetap tunduk pada tanggal unik & batas mingguan).
    for (const req of urgentByWeek.get(week.weekNo) ?? []) {
      const agent = agentMap.get(req.agentId);
      const slot = slotLookup.get(slotKey(req.date, req.shiftIndex));
      if (!agent || !slot) {
        warnings.push('Satu request khusus dilewati karena agen/slot tidak valid.');
        continue;
      }
      if (!assign(agent, slot, true)) {
        warnings.push(
          `Request ${displayName(agent)} pada ${formatDateId(req.date, true)} dilewati karena bentrok tanggal, batas mingguan, atau kapasitas.`
        );
      }
    }

    // 2) Putaran ke-1, ke-2, ke-3: setiap agen mendapat kesempatan secara merata.
    for (let round = 1; round <= weeklyTarget; round++) {
      const ordered = [...agents];
      shuffle(ordered, rng);
      ordered.sort(
        (a, b) =>
          (weeklyCounts.get(a.id)! - weeklyCounts.get(b.id)!) ||
          (monthCounts.get(a.id)! - monthCounts.get(b.id)!)
      );
      for (const agent of ordered) {
        if (weeklyCounts.get(agent.id)! >= round) continue;
        const usedDates = agentDates.get(agent.id)!;
        const prevDays = previousWeekDays.get(agent.id)!;
        let available = weekSlots.filter((s) => !usedDates.has(s.date));
        const rotated = available.filter((s) => !prevDays.has(s.weekday));
        if (rotated.length > 0) available = rotated;
        let candidates = available.filter(
          (s) => assignments[s.key].length < (capacity.get(s.key) ?? 0)
        );
        if (candidates.length === 0 && available.length > 0) {
          const chosen = minBy(available, (s) => [assignments[s.key].length, ...slotScore(s, agent)]);
          capacity.set(chosen.key, assignments[chosen.key].length + 1);
          candidates = [chosen];
        }
        if (candidates.length === 0) continue;
        const rotatedCandidates = candidates.filter((s) => !prevDays.has(s.weekday));
        if (rotatedCandidates.length > 0) candidates = rotatedCandidates;
        const chosen = minBy(candidates, (s) => [
          weekdayCounts.get(agent.id)![s.weekday],
          ...slotScore(s, agent)
        ]);
        assign(agent, chosen);
      }
    }

    for (const agent of agents) {
      const got = weeklyCounts.get(agent.id)!;
      if (got < weeklyTarget) {
        warnings.push(
          `${displayName(agent)}: mendapat ${got} dari target ${weeklyTarget}x pada ${label} karena kapasitas tanggal yang tersedia tidak cukup.`
        );
      }
    }
    previousWeekDays = new Map(
      agents.map((a) => [a.id, new Set([...agentDates.get(a.id)!].map(weekdayOf))])
    );
  }

  const data: ScheduleData = {
    year: config.year,
    month: config.month,
    hubName: config.hubName,
    notes: config.notes.map(cleanText).filter(Boolean),
    maxWeekly,
    weeks,
    holidays,
    slots,
    assignments,
    agents
  };
  return { data, warnings, validation: validateSchedule(data) };
}

/* ------------------------------------------------------------------ */
/* Validasi                                                            */
/* ------------------------------------------------------------------ */

export function validateSchedule(data: ScheduleData): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  const entries = Object.entries(data.assignments).flatMap(([key, list]) =>
    list.map((e) => ({ key, ...e }))
  );
  if (entries.length === 0) {
    return { ok: false, messages: ['Jadwal kosong. Periksa daftar agen, hari aktif, dan kapasitas shift.'] };
  }
  const agentIds = new Set(data.agents.map((a) => a.id));
  const slotMap = new Map(data.slots.map((s) => [s.key, s]));
  let ok = true;

  if (entries.some((e) => !agentIds.has(e.agentId))) {
    ok = false;
    messages.push('Terdapat assignment dengan Agent ID yang tidak dikenal.');
  }
  if (entries.some((e) => !slotMap.has(e.key))) {
    ok = false;
    messages.push('Terdapat tanggal assignment di luar periode jadwal.');
  }
  if (entries.some((e) => data.holidays[slotMap.get(e.key)?.date ?? ''] !== undefined)) {
    ok = false;
    messages.push('Terdapat agen yang masih terjadwal pada hari libur.');
  }
  const perDate = new Map<string, number>();
  for (const e of entries) {
    const date = slotMap.get(e.key)?.date ?? e.key.split('__')[0];
    const k = `${e.agentId}|${date}`;
    perDate.set(k, (perDate.get(k) ?? 0) + 1);
  }
  if ([...perDate.values()].some((n) => n > 1)) {
    ok = false;
    messages.push('Terdapat agen yang muncul lebih dari sekali pada tanggal yang sama.');
  }
  for (const week of data.weeks) {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (slotMap.get(e.key)?.weekNo !== week.weekNo) continue;
      counts.set(e.agentId, (counts.get(e.agentId) ?? 0) + 1);
    }
    const over = [...counts.entries()].filter(([, n]) => n > data.maxWeekly);
    if (over.length > 0) {
      ok = false;
      const names = over.map(([id]) => {
        const a = data.agents.find((x) => x.id === id);
        return a ? displayName(a) : id;
      });
      messages.push(
        `Periode ${weekRangeLabel(week.dates)}: batas ${data.maxWeekly}x/minggu terlampaui oleh ${names.join(', ')}.`
      );
    }
  }
  return { ok, messages };
}

/** Jumlah tugas tiap agen dalam satu bulan (untuk ringkasan). */
export function countAssignments(data: ScheduleData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const list of Object.values(data.assignments)) {
    for (const e of list) counts.set(e.agentId, (counts.get(e.agentId) ?? 0) + 1);
  }
  return counts;
}
