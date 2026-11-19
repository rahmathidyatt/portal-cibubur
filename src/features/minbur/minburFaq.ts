import type { OfficeDaySchedule, OfficeStaffContact } from '../../data/cibuburData';
import type { ScheduleData } from '../floortime/engine';
import { DAY_NAMES_ID, formatDateId } from '../floortime/engine';
import { slotsForAgentCode } from '../floortime/mySchedule';
import { buildHoursSummary, getOfficeStatus, isStaffBreak, minutesNowInJakarta } from '../../utils/schedule';
import { repeatLabel } from '../../data/recurringAnnouncements';
import { UNIT_ORDER, groupByUnit, isPrincipal, type BusinessManager } from '../../data/businessManagers';
import { birthdayReminders, type AgentBirthday } from '../birthdays/birthdays';
import { officeAnniversary } from '../../utils/anniversary';

/** Minbur = "admin cibubur": bot FAQ sederhana yang menjawab dari data portal. */

export type MinburIntent =
  | 'salam'
  | 'terima-kasih'
  | 'tentang'
  | 'jam'
  | 'lokasi'
  | 'floortime-saya'
  | 'floortime-tukar'
  | 'floortime-hari-ini'
  | 'messenger'
  | 'kontak'
  | 'pengumuman'
  | 'usia-kantor'
  | 'ulang-tahun'
  | 'floortime-besok'
  | 'libur'
  | 'bm'
  | 'navigasi';

export interface MinburLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface MinburAnswer {
  lines: string[];
  links?: MinburLink[];
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/floor\s*-?\s*time|\bft\b/g, 'floortime')
    .replace(/co\s*-?\s*broking/g, 'cobroking')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const has = (t: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(t));

/** Urutan aturan penting: yang lebih spesifik dicek dulu. */
const RULES: { intent: MinburIntent; test: (t: string) => boolean }[] = [
  { intent: 'terima-kasih', test: (t) => has(t, ['terima kasih', 'makasih', 'thanks', 'thank', 'tq\\b', 'thx']) },
  { intent: 'tentang', test: (t) => has(t, ['minbur', 'siapa kamu', 'kamu siapa', 'bot\\b']) && !has(t, ['jam', 'floortime', 'kontak']) },
  {
    intent: 'usia-kantor',
    test: (t) => has(t, ['berdiri', 'sejak kapan', 'umur kantor', 'usia kantor', 'ulang tahun kantor', 'ultah kantor', 'anniversary'])
  },
  { intent: 'ulang-tahun', test: (t) => has(t, ['ulang tahun', 'ulangtahun', 'ultah', 'birthday', 'hbd']) },
  {
    intent: 'floortime-tukar',
    test: (t) => has(t, ['tukar', 'pindah', 'ganti', 'ubah', 'izin', 'request', 'ajukan', 'berhalangan', 'tidak bisa hadir', 'gak bisa', 'ga bisa'])
  },
  {
    intent: 'floortime-saya',
    test: (t) =>
      (has(t, ['saya', 'aku', 'ku\\b', 'gue', 'gw']) && has(t, ['jadwal', 'floortime', 'jaga', 'kapan'])) ||
      (/\bjadwal\s+[a-z]{3,5}\b/.test(t) && !has(t, ['jadwal floortime', 'jadwal hari', 'jadwal kantor', 'jadwal lengkap', 'jadwal besok', 'jadwal libur']))
  },
  { intent: 'floortime-besok', test: (t) => has(t, ['besok']) && has(t, ['floortime', 'jaga', 'piket', 'jadwal', 'siapa']) },
  { intent: 'floortime-hari-ini', test: (t) => has(t, ['floortime', 'jaga', 'piket', 'siapa yang']) },
  { intent: 'libur', test: (t) => has(t, ['libur', 'tanggal merah', 'cuti bersama']) },
  {
    intent: 'bm',
    test: (t) => has(t, ['bm\\b', 'business manager', 'principal', 'warrior', 'champion', 'vision', 'priority', 'winner', 'leader', 'atasan', 'pimpinan'])
  },
  { intent: 'messenger', test: (t) => has(t, ['messenger', 'kurir', 'antar', 'kirim', 'banner', 'order', 'dokumen', 'jemput', 'pasang']) },
  { intent: 'pengumuman', test: (t) => has(t, ['pengumuman', 'info', 'berita', 'cobroking', 'acara', 'event', 'kegiatan']) },
  { intent: 'jam', test: (t) => has(t, ['jam', 'buka', 'tutup', 'operasional kantor', 'istirahat', 'masuk kantor', 'sabtu', 'minggu']) },
  { intent: 'lokasi', test: (t) => has(t, ['alamat', 'lokasi', 'maps', 'dimana', 'di mana', 'peta', 'arah', 'telepon kantor', 'telp']) },
  { intent: 'kontak', test: (t) => has(t, ['kontak', 'wa\\b', 'whatsapp', 'nomor', 'hubungi', 'admin', 'finance', 'keuangan', 'operasional', 'invoice', 'komisi', 'bayar']) },
  { intent: 'navigasi', test: (t) => has(t, ['halaman', 'menu', 'fitur', 'bisa apa', 'apa saja', 'bantuan', 'help']) },
  { intent: 'salam', test: (t) => has(t, ['halo', 'hai', 'hi\\b', 'hello', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'permisi', 'min\\b']) }
];

export function detectIntent(text: string): MinburIntent | null {
  const t = normalize(text);
  if (!t) return null;
  return RULES.find((r) => r.test(t))?.intent ?? null;
}

/** Kode agen di dalam pertanyaan, mis. "jadwal ADOL" → "ADOL" (dicocokkan dengan daftar kode). */
export function findAgentCode(text: string, knownCodes: string[]): string | null {
  const set = new Set(knownCodes.map((c) => c.toUpperCase()).filter(Boolean));
  for (const token of text.toUpperCase().split(/[^A-Z0-9]+/)) {
    if (token.length >= 3 && set.has(token)) return token;
  }
  return null;
}

export const QUICK_QUESTIONS: { label: string; text: string }[] = [
  { label: 'Floor time hari ini', text: 'Siapa floor time hari ini?' },
  { label: 'Jaga besok', text: 'Siapa jaga floor time besok?' },
  { label: 'Jadwal saya', text: 'Kapan jadwal floor time saya?' },
  { label: 'Jam kantor', text: 'Jam kantor buka sampai jam berapa?' },
  { label: 'Order messenger', text: 'Bagaimana order smart messenger?' },
  { label: 'Pengumuman', text: 'Ada pengumuman apa?' },
  { label: 'Business Manager', text: 'Siapa saja BM di HUB Cibubur?' },
  { label: 'Ulang tahun', text: 'Siapa yang ulang tahun hari ini?' },
  { label: 'Kontak staf', text: 'Minta kontak staf kantor' }
];

export function waLink(contact: OfficeStaffContact): string {
  return `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(contact.defaultMessage)}`;
}

function divisionName(c: OfficeStaffContact): string {
  return c.division === 'OPERASIONAL' ? 'Operasional' : c.division === 'FINANCE' ? 'Finance' : 'Messenger';
}

export function contactLine(c: OfficeStaffContact): string {
  return `${divisionName(c)}: ${c.staffName} — ${c.phoneDisplay}`;
}

export function answerHours(weeklyHours: OfficeDaySchedule[], now: Date): MinburAnswer {
  const status = getOfficeStatus(weeklyHours, now);
  const label = status.label.replace(' · ', ', ');
  const lines = [`Kantor sedang ${label.charAt(0).toLowerCase()}${label.slice(1)}.`];
  if (isStaffBreak(status, minutesNowInJakarta(now))) lines.push('Saat ini staf sedang istirahat (12.00–13.00), balasan mungkin sedikit lebih lama.');
  lines.push(`Jam operasional: ${buildHoursSummary(weeklyHours)}.`, 'Istirahat staf setiap hari kerja pukul 12.00–13.00 WIB.');
  return { lines, links: [{ label: 'Lihat jam & lokasi', href: '#jam-operasional' }] };
}

export function answerFloorToday(data: ScheduleData | null, today: string, when: 'hari ini' | 'besok' = 'hari ini'): MinburAnswer {
  const links = [{ label: 'Jadwal floor time lengkap', href: '#floortime' }];
  if (!data) return { lines: ['Jadwal floor time bulan ini belum terbit. Coba cek lagi nanti ya.'], links };
  const cap = when.charAt(0).toUpperCase() + when.slice(1);
  if (data.holidays[today] !== undefined) return { lines: [`${cap} libur (${data.holidays[today]}), tidak ada floor time.`], links };
  const slots = data.slots.filter((s) => s.date === today).sort((a, b) => a.shiftIndex - b.shiftIndex);
  if (slots.length === 0) return { lines: [`Tidak ada floor time ${when}.`], links };
  const lines = [`Floor time ${when} (${DAY_NAMES_ID[slots[0].weekday]}, ${formatDateId(today)}):`];
  for (const s of slots) {
    const names = (data.assignments[s.key] ?? []).map((e) => e.displayName);
    lines.push(`• ${s.shiftName} ${s.timeLabel.replace('-', '–')}: ${names.length ? names.join(', ') : 'belum ada petugas'}`);
  }
  return { lines, links };
}

export function answerMySchedule(data: ScheduleData | null, code: string, today: string): MinburAnswer {
  const links = [{ label: 'Buka Jadwal saya', href: '#floortime' }];
  if (!code) {
    return {
      lines: [
        'Minbur belum tahu kode agen Anda.',
        'Ketik kode agen Anda, misalnya "jadwal ADOL", atau pilih nama Anda di menu Jadwal saya pada halaman Floor Time.'
      ],
      links
    };
  }
  if (!data) return { lines: ['Jadwal floor time bulan ini belum terbit.'], links };
  const agent = data.agents.find((a) => a.code.toUpperCase() === code.toUpperCase());
  if (!agent) return { lines: [`Kode ${code.toUpperCase()} tidak ditemukan di jadwal bulan ini.`], links };
  const slots = slotsForAgentCode(data, code).filter((s) => s.date >= today);
  if (slots.length === 0) return { lines: [`${agent.name} (${agent.code}) tidak punya jadwal floor time lagi bulan ini.`], links };
  return {
    lines: [
      `Jadwal floor time ${agent.name} (${agent.code}) berikutnya:`,
      ...slots.slice(0, 6).map((s) => `• ${DAY_NAMES_ID[s.weekday]}, ${formatDateId(s.date)} · ${s.shiftName} ${s.timeLabel.replace('-', '–')}${s.date === today ? ' (hari ini)' : ''}`),
      ...(slots.length > 6 ? [`…dan ${slots.length - 6} jadwal lagi.`] : [])
    ],
    links
  };
}

export function answerAnnouncements(
  items: { title: string; body: string; repeatWeekday?: number | null }[],
  today: string
): MinburAnswer {
  if (items.length === 0) return { lines: ['Belum ada pengumuman saat ini.'] };
  const ordered = [...items.filter((a) => a.repeatWeekday), ...items.filter((a) => !a.repeatWeekday)].slice(0, 4);
  return {
    lines: [
      'Pengumuman terbaru:',
      ...ordered.map((a) => {
        const when = a.repeatWeekday ? ` (${repeatLabel(a.repeatWeekday, today).label})` : '';
        return `• ${a.title}${when}${a.body ? ` — ${a.body}` : ''}`;
      })
    ],
    links: [{ label: 'Lihat di beranda', href: '#beranda' }]
  };
}

/* ---------------- Pengetahuan tambahan dari data portal ---------------- */

export function answerBusinessManagers(list: Pick<BusinessManager, 'name' | 'code' | 'tier'>[], text: string): MinburAnswer {
  const links = [{ label: 'Lihat Business Manager', href: '#business-manager' }];
  if (list.length === 0) return { lines: ['Data Business Manager belum tersedia.'], links };
  const t = normalize(text);
  const principals = list.filter(isPrincipal);
  const groups = groupByUnit(list.filter((m) => !isPrincipal(m)));
  const askedUnit = UNIT_ORDER.find((u) => t.includes(u.toLowerCase()));
  const label = (m: Pick<BusinessManager, 'name' | 'code'>) => (m.code ? `${m.name} (${m.code})` : m.name);
  if (askedUnit) {
    const g = groups.find((x) => x.unit === askedUnit);
    return {
      lines: g ? [`Business Manager Brighton ${askedUnit}:`, ...g.members.map((m) => `• ${label(m)}`)] : [`Belum ada BM untuk unit ${askedUnit}.`],
      links
    };
  }
  if (/\bprincipal\b/.test(t)) {
    return { lines: principals.length ? ['Principal:', ...principals.map((m) => `• ${label(m)}`)] : ['Belum ada Principal di HUB Cibubur.'], links };
  }
  return {
    lines: [
      `Business Manager HUB Cibubur (${groups.reduce((n, g) => n + g.members.length, 0)} BM):`,
      ...groups.map((g) => `• ${g.unit}: ${g.members.map(label).join(', ')}`)
    ],
    links
  };
}

export function answerBirthdays(list: AgentBirthday[], today: string): MinburAnswer {
  const { today: now, tomorrow } = birthdayReminders(list, today);
  const names = (xs: AgentBirthday[]) => xs.map((b) => (b.code ? `${b.name} (${b.code})` : b.name)).join(', ');
  const lines: string[] = [];
  if (now.length) lines.push(`🎂 Hari ini ulang tahun: ${names(now)}. Jangan lupa ucapkan selamat!`);
  if (tomorrow.length) lines.push(`Besok ulang tahun: ${names(tomorrow)}.`);
  if (!lines.length) lines.push('Tidak ada agen yang berulang tahun hari ini maupun besok.');
  return { lines };
}

export function answerAnniversary(foundedIso: string, today: string): MinburAnswer {
  const a = officeAnniversary(foundedIso, today);
  const [y, m, d] = foundedIso.split('-').map(Number);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const since = `${d} ${months[m - 1]} ${y}`;
  return {
    lines: a.isToday
      ? [`Hari ini Brighton HUB Cibubur berulang tahun ke-${a.age}! 🎉 Kantor berdiri sejak ${since}.`]
      : [`Brighton HUB Cibubur berdiri sejak ${since}, sekarang berusia ${a.age} tahun.`, `Ulang tahun ke-${a.nextAge} tinggal ${a.daysUntil} hari lagi.`]
  };
}

export const NAVIGATION_ANSWER: MinburAnswer = {
  lines: [
    'Yang bisa Anda temukan di portal ini:',
    '• Beranda: floor time hari ini, pengumuman, order messenger, ulang tahun.',
    '• Floor Time: jadwal lengkap, Jadwal saya (+ simpan ke kalender), dan formulir pindah/tukar jadwal.',
    '• Business Manager per unit, Kontak staf, serta Jam & lokasi kantor.',
    'Tanyakan saja ke Minbur, misalnya "siapa jaga besok?" atau "BM Warrior siapa?".'
  ],
  links: [
    { label: 'Floor Time', href: '#floortime' },
    { label: 'Business Manager', href: '#business-manager' },
    { label: 'Kontak staf', href: '#kontak-staf' },
    { label: 'Jam & lokasi', href: '#jam-operasional' }
  ]
};

export function answerHolidays(data: ScheduleData | null, today: string, weeklyHours: OfficeDaySchedule[]): MinburAnswer {
  const closed = weeklyHours.filter((d) => d.isClosed).map((d) => d.dayNameId);
  const lines = closed.length ? [`Kantor tutup setiap hari ${closed.join(' dan ')}.`] : [];
  if (data) {
    const upcoming = Object.entries(data.holidays)
      .filter(([iso]) => iso >= today)
      .sort(([a], [b]) => a.localeCompare(b));
    if (upcoming.length) {
      lines.push('Hari libur bulan ini (tanpa floor time):', ...upcoming.map(([iso, name]) => `• ${formatDateId(iso)}${name ? ` — ${name}` : ''}`));
    } else {
      lines.push('Tidak ada hari libur nasional tersisa di jadwal floor time bulan ini.');
    }
  }
  return { lines, links: [{ label: 'Lihat jam & lokasi', href: '#jam-operasional' }] };
}

/* ---------------- Tanya-jawab yang diajarkan admin ---------------- */

export interface TaughtFaq {
  keywords: string;
  answer: string;
  linkLabel?: string | null;
  linkUrl?: string | null;
}

/**
 * Cari jawaban ajaran admin yang paling cocok. Sebuah kata kunci dianggap cocok jika semua katanya
 * ada di pertanyaan (awal kata). Skor = jumlah kata dari kata kunci yang cocok; yang tertinggi menang.
 */
export function matchTaughtFaq<T extends TaughtFaq>(text: string, faqs: T[]): T | null {
  const t = normalize(text);
  if (!t) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const f of faqs) {
    let score = 0;
    for (const raw of f.keywords.split(',')) {
      const words = normalize(raw).split(' ').filter(Boolean);
      if (words.length && words.every((w) => new RegExp(`\\b${w}`).test(t))) score += words.length;
    }
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

export function answerFromTaught(f: TaughtFaq): MinburAnswer {
  const url = (f.linkUrl ?? '').trim();
  return {
    lines: f.answer.split(/\n+/).map((l) => l.trim()).filter(Boolean),
    links: url ? [{ label: f.linkLabel?.trim() || 'Buka link', href: url, external: !url.startsWith('#') }] : undefined
  };
}
