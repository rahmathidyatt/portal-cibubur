/**
 * Report Bright Day: checklist acara Bright Day Onsite + format laporan after event,
 * dicetak persis seperti format laporan ke pusat.
 */

export const BRIGHT_DAY_LOCATION = 'Brighton HUB Cibubur';
export const DEFAULT_ADMIN_IN_CHARGE = 'Rahmat Hidayat';
/** Laporan tersimpan hanya untuk dilihat selama 7 hari, lalu terhapus otomatis. */
export const RETENTION_DAYS = 7;

/** Potongan teks dalam satu baris (tebal / merah). */
export interface Run {
  t: string;
  bold?: boolean;
  red?: boolean;
}
export type Line = Run[];

export type ChecklistRow =
  | { kind: 'section'; label: string; color: string }
  | { kind: 'label'; no: string; lines: Line[] }
  | { kind: 'item'; id: string; no: string; lines: Line[] };

const b = (t: string): Run => ({ t, bold: true });
const n = (t: string): Run => ({ t });
const r = (t: string): Run => ({ t, bold: true, red: true });

export const CHECKLIST: ChecklistRow[] = [
  { kind: 'section', label: 'Pra-Event', color: '#FFFF00' },
  { kind: 'label', no: '', lines: [[b('Cek Perlengkapan:')]] },
  {
    kind: 'item',
    id: 'proyektor',
    no: '1',
    lines: [[b('Proyektor Set')], [n('- Proyektor')], [n('- Layar Proyektor')], [n('- VGA')], [n('- HDMI')], [n('- Kabel Proyektor')]]
  },
  {
    kind: 'item',
    id: 'speaker',
    no: '2',
    lines: [[b('Speaker & Mic Set')], [n('- Speaker')], [n('- Kabel Speaker')], [n('- Mic')], [n('- Baterai')]]
  },
  { kind: 'item', id: 'materi', no: '3', lines: [[b('Materi PDF, PPT + Video'), n(' (Looping & MJN terbaru)')]] },
  { kind: 'item', id: 'buku-tamu', no: '4', lines: [[b('Buku Tamu/Form Absensi'), n(' (Pastikan sudah di-print )')]] },
  { kind: 'item', id: 'roll-banner', no: '5', lines: [[b('Roll Banner'), n(' (Gunakan roll banner terbaru)')]] },
  {
    kind: 'item',
    id: 'laptop',
    no: '6',
    lines: [[b('PC/Laptop Set')], [n('- Laptop/PC Kantor')], [n('- Charger Laptop/Kabel PC')], [n('- Mouse')], [n('- Kabel Roll')]]
  },
  { kind: 'item', id: 'stiker', no: '7', lines: [[b('Stiker Label Bulat Warna'), n(' (Untuk Tamu Tanpa Referral)')]] },
  { kind: 'item', id: 'tanda-terima', no: '8', lines: [[b('Tanda Terima Investasi'), n(' (Tamu Closing/Join Brighton)')]] },
  { kind: 'item', id: 'survey', no: '9', lines: [[b('Survey Kepuasan Peserta'), n(' (Print & Pajang)')]] },
  {
    kind: 'item',
    id: 'pengajuan-finance',
    no: '10',
    lines: [[b('Pengajuan Finance Bright Day '), r('Khusus Bright Day Umum (Kunjungan)')], [n('*Maksimal H-2 Bright Day')]]
  },
  { kind: 'section', label: 'On-Event', color: '#00FFFF' },
  { kind: 'label', no: '1', lines: [[b('Konsumsi Bright Day:')]] },
  {
    kind: 'item',
    id: 'konsumsi-a',
    no: 'a.',
    lines: [
      [b('"Konsumsi di Kantor DENGAN Termos"')],
      [n('- Siapkan Minuman Sachet (Kopi/Teh Celup), Gula dan Papercup')],
      [n('- Pesan & Siapkan Konsumsi Jajan/Snack Sesuai Jumlah Yang Berhak Mendapat Konsumsi')]
    ]
  },
  {
    kind: 'item',
    id: 'konsumsi-b',
    no: 'b.',
    lines: [[b('"Konsumsi di Kantor TANPA Termos"')], [n('- Pesan & Siapkan Kopi/Konsumsi Sesuai Jumlah Yang Berhak Mendapat Konsumsi')]]
  },
  {
    kind: 'item',
    id: 'konsumsi-c',
    no: 'c.',
    lines: [[b('"Konsumsi Jika di Cafe"')], [n('- Siapkan Voucher/Kupon Konsumsi Cafe (Print)')]]
  },
  { kind: 'section', label: 'After-Event', color: '#00FF00' },
  {
    kind: 'item',
    id: 'laporan-pusat',
    no: '1',
    lines: [[b('Laporan Data Peserta & Biaya ke Pusat')], [n('*Maksimal H+3 dari tanggal acara')]]
  },
  {
    kind: 'item',
    id: 'reimburse',
    no: '2',
    lines: [[b('Reimburse Dana Konsumsi Bright Day ke Pusat '), r('Khusus Non Pengajuan Finance')]]
  }
];

export const CHECK_ITEMS = CHECKLIST.filter((x): x is Extract<ChecklistRow, { kind: 'item' }> => x.kind === 'item');

export type Konsumsi = 'a' | 'b' | 'c';

export interface BrightDayPhoto {
  id: string;
  /** Lokasi file di penyimpanan (mode Supabase). */
  path?: string;
  /** Data gambar JPEG (data URL) — mode lokal, atau setelah diunduh untuk PDF/pratinjau. */
  dataUrl?: string;
}

export interface BrightDayReport {
  id: string;
  createdAt: string;
  host: string;
  speaker: string;
  /** YYYY-MM-DD */
  eventDate: string;
  /** "14.00" */
  eventTime: string;
  adminInCharge: string;
  /** Pakai pengajuan finance? Ya → centang no.10, Tidak → centang Reimburse. */
  finance: boolean;
  konsumsi: Konsumsi;
  checks: Record<string, boolean>;
  notes: Record<string, string>;
  registered: string;
  attended: string;
  paWithGuests: string;
  closing: string;
  cost: string;
  evaluation: string;
  photos: BrightDayPhoto[];
}

/** Centang bawaan: semua tercentang, kecuali pilihan konsumsi lain & pasangan finance/reimburse. */
export function defaultChecks(finance: boolean, konsumsi: Konsumsi): Record<string, boolean> {
  const checks: Record<string, boolean> = {};
  for (const item of CHECK_ITEMS) checks[item.id] = true;
  checks['pengajuan-finance'] = finance;
  checks.reimburse = !finance;
  checks['konsumsi-a'] = konsumsi === 'a';
  checks['konsumsi-b'] = konsumsi === 'b';
  checks['konsumsi-c'] = konsumsi === 'c';
  return checks;
}

export function newReport(id: string, nowIso: string): BrightDayReport {
  return {
    id,
    createdAt: nowIso,
    host: '',
    speaker: '',
    eventDate: '',
    eventTime: '',
    adminInCharge: DEFAULT_ADMIN_IN_CHARGE,
    finance: true,
    konsumsi: 'a',
    checks: defaultChecks(true, 'a'),
    notes: {},
    registered: '',
    attended: '',
    paWithGuests: '',
    closing: '',
    cost: '',
    evaluation: '',
    photos: []
  };
}

/** Ubah pilihan finance / konsumsi sambil mempertahankan centang item lain. */
export function applyChoice(report: BrightDayReport, change: { finance?: boolean; konsumsi?: Konsumsi }): BrightDayReport {
  const finance = change.finance ?? report.finance;
  const konsumsi = change.konsumsi ?? report.konsumsi;
  const base = defaultChecks(finance, konsumsi);
  const checks = { ...report.checks };
  if (change.finance !== undefined) {
    checks['pengajuan-finance'] = base['pengajuan-finance'];
    checks.reimburse = base.reimburse;
  }
  if (change.konsumsi !== undefined) {
    for (const k of ['konsumsi-a', 'konsumsi-b', 'konsumsi-c']) checks[k] = base[k];
  }
  return { ...report, finance, konsumsi, checks };
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-11-02" → "02 November 2026". */
export function formatEventDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** "14:00" / "14.00" → "14.00 WIB". */
export function formatEventTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})[.:](\d{2})/);
  return m ? `${m[1].padStart(2, '0')}.${m[2]} WIB` : '';
}

/** "70000" / "70.000" → "Rp. 70.000"; kosong → "-". */
export function formatCost(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '-';
  return `Rp. ${Number(digits).toLocaleString('id-ID')}`;
}

/** Angka laporan; kosong → "-". */
export function formatCount(raw: string): string {
  const v = raw.trim();
  return v === '' ? '-' : v;
}

export function pdfFileName(report: Pick<BrightDayReport, 'eventDate'>): string {
  const date = formatEventDate(report.eventDate);
  return `${date || 'Report Bright Day'} - ${BRIGHT_DAY_LOCATION}.pdf`;
}

/** Hal yang wajib diisi sebelum PDF dibuat. */
export function missingFields(report: BrightDayReport): string[] {
  const missing: string[] = [];
  if (!report.host.trim()) missing.push('Host');
  if (!report.speaker.trim()) missing.push('Narasumber');
  if (!formatEventDate(report.eventDate)) missing.push('Tanggal acara');
  if (!formatEventTime(report.eventTime)) missing.push('Waktu acara');
  return missing;
}

export function expiresAt(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + RETENTION_DAYS * 86_400_000);
}

export function isExpired(createdAt: string, now: Date): boolean {
  return expiresAt(createdAt).getTime() <= now.getTime();
}

/** Sisa hari sebelum terhapus (dibulatkan ke atas, minimal 0). */
export function daysLeft(createdAt: string, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt(createdAt).getTime() - now.getTime()) / 86_400_000));
}
