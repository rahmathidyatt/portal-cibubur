/**
 * Daftar hadir Bright Day (tamu/calon agen & PA), mengikuti lembar Google Sheets
 * "Buku Tamu Absensi Bright Day". Yang berubah hanya hari & tanggal acara.
 */

export type AttendanceKind = 'tamu' | 'pa';

export interface AttendanceSheet {
  kind: AttendanceKind;
  label: string;
  /** Warna judul & kepala tabel. */
  color: string;
  /** Garis kolom (pt, dari kiri). */
  cols: number[];
  headers: string[];
  /** Batas vertikal (pt, dari atas): judul, baris kosong, kepala tabel. */
  titleTop: number;
  titleBottom: number;
  headTop: number;
  headBottom: number;
  rows: number;
  rowHeight: number;
  titleSize: number;
  titleBaselines: [number, number];
  textSize: number;
}

export const PAGE = { w: 595, h: 842 };

export const ATTENDANCE_SHEETS: Record<AttendanceKind, AttendanceSheet> = {
  tamu: {
    kind: 'tamu',
    label: 'Daftar hadir tamu (calon agen)',
    color: '#FFFF00',
    cols: [56.5, 86.5, 207.5, 328, 436, 537.5],
    headers: ['No', 'Nama', 'Kontak', 'Info', 'TTD'],
    titleTop: 53.5,
    titleBottom: 93.5,
    headTop: 113.5,
    headBottom: 133.5,
    rows: 20,
    rowHeight: 32.725,
    titleSize: 8.5,
    titleBaselines: [71.7, 81.6],
    textSize: 7.2
  },
  pa: {
    kind: 'pa',
    label: 'Daftar hadir PA',
    color: '#FF9900',
    cols: [50, 77, 238, 395, 544.5],
    headers: ['No', 'Nama (Kode PA)', 'Bisnis Unit', 'TTD'],
    titleTop: 53.5,
    titleBottom: 90,
    headTop: 108,
    headBottom: 126,
    rows: 15,
    rowHeight: 36.3,
    titleSize: 7.7,
    titleBaselines: [70.1, 79.1],
    textSize: 6.55
  }
};

export const ATTENDANCE_TITLE = 'DAFTAR HADIR PESERTA BRIGHT DAY BRIGHTON HUB CIBUBUR';

const DAYS = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const MONTHS = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

/** "2026-09-16" → "(RABU, 16 SEPTEMBER 2026)". */
export function attendanceDateLine(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `(${day}, ${d} ${MONTHS[m - 1]} ${y})`;
}

export function attendanceFileName(kind: AttendanceKind, iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = `${d} ${MONTHS[m - 1].charAt(0)}${MONTHS[m - 1].slice(1).toLowerCase()} ${y}`;
  return `Daftar Hadir ${kind === 'tamu' ? 'Tamu' : 'PA'} Bright Day - ${date}.pdf`;
}
