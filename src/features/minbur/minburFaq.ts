import type { OfficeDaySchedule, OfficeStaffContact } from '../../data/cibuburData';
import type { ScheduleData } from '../floortime/engine';
import { DAY_NAMES_ID, formatDateId } from '../floortime/engine';
import { slotsForAgentCode } from '../floortime/mySchedule';
import { buildHoursSummary, getOfficeStatus, isStaffBreak, minutesNowInJakarta } from '../../utils/schedule';
import { repeatLabel } from '../../data/recurringAnnouncements';

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
  | 'pengumuman';

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
  { intent: 'tentang', test: (t) => has(t, ['minbur', 'siapa kamu', 'kamu siapa', 'bot']) && !has(t, ['jam', 'floortime', 'kontak']) },
  {
    intent: 'floortime-tukar',
    test: (t) => has(t, ['tukar', 'pindah', 'ganti', 'ubah', 'izin', 'request', 'ajukan', 'berhalangan', 'tidak bisa hadir', 'gak bisa', 'ga bisa'])
  },
  {
    intent: 'floortime-saya',
    test: (t) => (has(t, ['saya', 'aku', 'ku\\b', 'gue', 'gw']) && has(t, ['jadwal', 'floortime', 'jaga', 'kapan'])) || /\bjadwal\s+[a-z]{3,5}\b/.test(t) && !has(t, ['jadwal floortime', 'jadwal hari', 'jadwal kantor', 'jadwal lengkap'])
  },
  { intent: 'floortime-hari-ini', test: (t) => has(t, ['floortime', 'jaga', 'piket', 'siapa yang']) },
  { intent: 'messenger', test: (t) => has(t, ['messenger', 'kurir', 'antar', 'kirim', 'banner', 'order', 'dokumen', 'jemput', 'pasang']) },
  { intent: 'pengumuman', test: (t) => has(t, ['pengumuman', 'info', 'berita', 'cobroking', 'acara', 'event', 'kegiatan']) },
  { intent: 'jam', test: (t) => has(t, ['jam', 'buka', 'tutup', 'operasional kantor', 'libur', 'istirahat', 'masuk kantor', 'sabtu', 'minggu']) },
  { intent: 'lokasi', test: (t) => has(t, ['alamat', 'lokasi', 'maps', 'dimana', 'di mana', 'peta', 'arah', 'telepon kantor', 'telp']) },
  { intent: 'kontak', test: (t) => has(t, ['kontak', 'wa\\b', 'whatsapp', 'nomor', 'hubungi', 'admin', 'finance', 'keuangan', 'operasional', 'invoice', 'komisi', 'bayar']) },
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
  { label: 'Jadwal saya', text: 'Kapan jadwal floor time saya?' },
  { label: 'Jam kantor', text: 'Jam kantor buka sampai jam berapa?' },
  { label: 'Order messenger', text: 'Bagaimana order smart messenger?' },
  { label: 'Pengumuman', text: 'Ada pengumuman apa?' },
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

export function answerFloorToday(data: ScheduleData | null, today: string): MinburAnswer {
  const links = [{ label: 'Jadwal floor time lengkap', href: '#floortime' }];
  if (!data) return { lines: ['Jadwal floor time bulan ini belum terbit. Coba cek lagi nanti ya.'], links };
  if (data.holidays[today] !== undefined) return { lines: [`Hari ini libur (${data.holidays[today]}), tidak ada floor time.`], links };
  const slots = data.slots.filter((s) => s.date === today).sort((a, b) => a.shiftIndex - b.shiftIndex);
  if (slots.length === 0) return { lines: ['Tidak ada floor time hari ini.'], links };
  const lines = [`Floor time hari ini (${DAY_NAMES_ID[slots[0].weekday]}, ${formatDateId(today)}):`];
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
