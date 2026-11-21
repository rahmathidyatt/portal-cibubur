/** BC terjadwal: logika murni (jadwal berulang, tautan WhatsApp, BC training otomatis). */

export type BcRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type BcKind = 'manual' | 'training-reminder' | 'training-group';
export type BcStatus = 'active' | 'done' | 'cancelled';

export interface BcTarget {
  id: string;
  name: string;
  /** Nomor WhatsApp pribadi (62…); kosong = grup. */
  phone: string | null;
}

export interface BcSchedule {
  id: string;
  title: string;
  message: string;
  kind: BcKind;
  targetId: string | null;
  nextAt: string;
  repeat: BcRepeat;
  status: BcStatus;
  sourceKey: string | null;
  lastSentAt: string | null;
}

export type BcDraft = Pick<BcSchedule, 'title' | 'message' | 'targetId' | 'nextAt' | 'repeat'>;

export const REPEAT_LABEL: Record<BcRepeat, string> = {
  none: 'Sekali',
  daily: 'Setiap hari',
  weekly: 'Setiap minggu',
  monthly: 'Setiap bulan'
};

/** "2026-11-23" + "09.00" → ISO dengan zona WIB. */
export function wibIso(date: string, time: string): string {
  const [h, m] = time.replace('.', ':').split(':');
  return new Date(`${date}T${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}:00+07:00`).toISOString();
}

/** Tanggal & jam WIB dari ISO: { date: "2026-11-23", time: "09:00" }. */
export function wibParts(iso: string): { date: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "Jumat, 20 Nov 2026 · 09.00 WIB". */
export function formatWibDateTime(iso: string): string {
  const { date, time } = wibParts(iso);
  const [y, m, d] = date.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${day}, ${d} ${MONTHS[m - 1]} ${y} · ${time.replace(':', '.')} WIB`;
}

function addInterval(iso: string, repeat: BcRepeat): string {
  const d = new Date(iso);
  if (repeat === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (repeat === 'monthly') {
    // Pakai tanggal WIB agar akhir bulan tidak meleset (31 → tanggal terakhir bulan berikutnya).
    const { date, time } = wibParts(iso);
    const [y, m, day] = date.split('-').map(Number);
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const next = new Date(Date.UTC(y, m, Math.min(day, last)));
    return wibIso(next.toISOString().slice(0, 10), time);
  }
  return d.toISOString();
}

/** Jadwal berikutnya setelah dikirim (null untuk BC sekali kirim). */
export function nextOccurrence(iso: string, repeat: BcRepeat, now: Date): string | null {
  if (repeat === 'none') return null;
  let next = addInterval(iso, repeat);
  for (let i = 0; i < 1000 && new Date(next) <= now; i++) next = addInterval(next, repeat);
  return next;
}

export function isDue(s: Pick<BcSchedule, 'status' | 'nextAt'>, now: Date): boolean {
  return s.status === 'active' && new Date(s.nextAt) <= now;
}

/** Nomor WA: "0812-…" / "+62 812…" → "62812…". */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

/** Tautan WhatsApp: ke nomor pribadi langsung, atau pilih chat/grup sendiri. */
export function waSendLink(text: string, phone?: string | null): string {
  const t = encodeURIComponent(text);
  return phone ? `https://wa.me/${phone}?text=${t}` : `https://wa.me/?text=${t}`;
}

export function validateBc(d: BcDraft, kind: BcKind, now: Date, isNew: boolean): string | null {
  if (!d.title.trim()) return 'Judul BC wajib diisi.';
  if (d.title.length > 120) return 'Judul maksimal 120 karakter.';
  if (kind === 'manual' && !d.message.trim()) return 'Isi pesan BC wajib diisi.';
  if (d.message.length > 6000) return 'Pesan maksimal 6000 karakter.';
  if (Number.isNaN(new Date(d.nextAt).getTime())) return 'Tanggal & jam kirim tidak valid.';
  if (isNew && new Date(d.nextAt) <= now) return 'Pilih waktu kirim yang belum lewat.';
  return null;
}

/** Dua BC training otomatis per batch: Pengingat H-3 09.00 & Daftar peserta H-1 17.00. */
export function trainingSchedules(batchStart: string): { sourceKey: string; kind: BcKind; title: string; nextAt: string }[] {
  const shift = (days: number) => {
    const [y, m, d] = batchStart.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  return [
    {
      sourceKey: `training:${batchStart}:reminder`,
      kind: 'training-reminder',
      title: 'Pengingat Training Bright On',
      nextAt: wibIso(shift(-3), '09:00')
    },
    {
      sourceKey: `training:${batchStart}:group`,
      kind: 'training-group',
      title: 'Daftar peserta Training Bright On',
      nextAt: wibIso(shift(-1), '17:00')
    }
  ];
}

/** Urutan tampilan: yang paling dekat waktunya dulu. */
export function sortSchedules(list: BcSchedule[]): BcSchedule[] {
  return [...list].sort((a, b) => a.nextAt.localeCompare(b.nextAt));
}
