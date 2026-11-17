/**
 * Perhitungan Nota Smart Messenger — port dari github.com/rahmathidyatt/nota-smart-messenger.
 * BBM = jarak akumulasi × tarif per KM; bila jarak < batas minimum (dan ada titik pekerjaan),
 * BBM memakai tarif minimum. Biaya jasa = jumlah titik terisi × biaya jasa per titik.
 */

export const MAX_TEMPLATE_ROWS = 14;

export interface NotaConfig {
  tariffPerKm: number;
  minimumDistanceKm: number;
  minimumBbm: number;
  serviceFeePerPoint: number;
  enableMinimumBbm: boolean;
}

export const DEFAULT_NOTA_CONFIG: NotaConfig = {
  tariffPerKm: 900,
  minimumDistanceKm: 10,
  minimumBbm: 10_000,
  serviceFeePerPoint: 5_000,
  enableMinimumBbm: true
};

export interface NotaJob {
  alamat: string;
  tugas: string;
  keterangan: string;
}

export interface NotaMeta {
  tglRequest: string; // ISO
  namaAgent: string;
  kantor: string;
  pembayaran: string;
  rekening: string;
  estimasiTanggal: string; // ISO
}

export interface NotaResult {
  jobCount: number;
  distanceKm: number;
  rawBbmFee: number;
  bbmFee: number;
  serviceFee: number;
  total: number;
  minimumApplied: boolean;
  minimumNote: string;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Rp 16.920" */
export function formatRupiah(value: number): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  return `Rp ${n.toLocaleString('en-US').replace(/,/g, '.')}`;
}

/** 18.8 → "18,8"; 50 → "50" */
export function formatNumberId(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

/** "2026-11-17" → "17-Nov-26" */
export function formatDateDisplay(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '-';
  return `${String(d).padStart(2, '0')}-${MONTHS_EN[m - 1]}-${String(y).slice(-2)}`;
}

export function sanitizeFilename(text: string): string {
  return text.trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'nota';
}

export function calculateTotal(distanceKm: number, jobs: NotaJob[], config: NotaConfig): NotaResult {
  const jobCount = jobs.filter((j) => j.alamat.trim() || j.tugas.trim()).length;
  const distance = Math.max(distanceKm || 0, 0);
  const rawBbmFee = Math.round(distance * config.tariffPerKm);
  const minimumApplied = config.enableMinimumBbm && jobCount > 0 && distance < config.minimumDistanceKm;
  const bbmFee = minimumApplied ? Math.max(rawBbmFee, config.minimumBbm) : rawBbmFee;
  const serviceFee = jobCount * config.serviceFeePerPoint;
  return {
    jobCount,
    distanceKm: distanceKm || 0,
    rawBbmFee,
    bbmFee,
    serviceFee,
    total: bbmFee + serviceFee,
    minimumApplied,
    minimumNote: minimumApplied
      ? `Tarif minimum BBM ${formatRupiah(config.minimumBbm)} digunakan karena jarak kurang dari ${formatNumberId(config.minimumDistanceKm)} KM.`
      : 'Tarif minimum BBM tidak digunakan.'
  };
}

export const DEFAULT_REKENING = '7115343696 a/n APRIANSYAH ILYAS (BCA)';

export function emptyJob(): NotaJob {
  return { alamat: '', tugas: 'Pasang Banner', keterangan: '' };
}

/** Data contoh dari aplikasi asli. */
export function exampleOnePoint(): { distanceKm: number; jobs: NotaJob[]; namaAgent: string } {
  return { distanceKm: 18.8, namaAgent: 'RUDY', jobs: [{ alamat: 'Workshop Multiteknik', tugas: 'Pasang Banner', keterangan: '' }] };
}

export function exampleTwoPoints(): { distanceKm: number; jobs: NotaJob[]; namaAgent: string } {
  return {
    distanceKm: 50,
    namaAgent: 'RUDY',
    jobs: [
      { alamat: 'Workshop Multiteknik', tugas: 'Pasang Banner', keterangan: '' },
      { alamat: 'alamat 2', tugas: 'Pasang Banner', keterangan: '' }
    ]
  };
}
