import type { GridSheet } from '../../utils/xlsxGrid';
import { cellAt } from '../../utils/xlsxGrid';
import { TRAINING_MODULES, moduleStatus, type TrainingAgent } from './training';

/**
 * Tracking nilai: membaca file "REKAP NILAI BRIGHT ON" (satu sheet per sesi, kolom
 * No/Tanggal/Skor/Nama/Unit/Kode/Lokasi/Keterangan) lalu mencocokkan baris dengan agen di rekap.
 */

export interface RecapRow {
  moduleId: string;
  score: number;
  name: string;
  unit: string;
  /** Isi kolom Kode apa adanya (sering tidak rapi: "Rohim (TOHB)", huruf kecil, dll.). */
  rawCode: string;
  location: string;
  date: string;
}

export interface RecapFile {
  /** Sesi yang terbaca: moduleId → jumlah baris. */
  sessions: { moduleId: string; sheet: string; rows: number }[];
  rows: RecapRow[];
}

/** Kata kunci judul sesi (urutan sama dengan TRAINING_MODULES). */
const SESSION_KEYWORDS: string[][] = [
  ['BISNIS BERSAMA'],
  ['ETIKA'],
  ['TENTANG BISNIS'],
  ['KEBIASAAN'],
  ['PRIMARY', 'SECONDARY'],
  ['LISTING'],
  ['DOKUMEN'],
  ['ALUR'],
  ['BRANDING', 'EXPOSE'],
  ['KLIEN'],
  ['NEGO']
];

/** Huruf besar, karakter "fancy" (𝙉𝙏𝘿𝙓) jadi huruf biasa. */
export function clean(text: string): string {
  return text.normalize('NFKC').toUpperCase().trim();
}

/** Semua kandidat kode PA (4 huruf) dalam teks. */
export function codeTokens(text: string): string[] {
  return clean(text).match(/(?<![A-Z])[A-Z]{4}(?![A-Z])/g) ?? [];
}

function moduleForTitle(title: string, index: number): string | null {
  const t = clean(title);
  const i = SESSION_KEYWORDS.findIndex((keys) => keys.some((k) => t.includes(k)));
  if (i >= 0) return TRAINING_MODULES[i].id;
  return TRAINING_MODULES[index]?.id ?? null;
}

export function parseRecapFile(sheets: GridSheet[]): RecapFile {
  const sessions: RecapFile['sessions'] = [];
  const rows: RecapRow[] = [];
  let index = 0;
  for (const sheet of sheets) {
    // Cari baris kepala tabel (berisi "Skor" dan "Nama").
    let headRow = 0;
    const col: Record<string, number> = {};
    for (let r = 1; r <= Math.min(6, sheet.maxRow) && !headRow; r++) {
      const found: Record<string, number> = {};
      for (let c = 1; c <= sheet.maxCol; c++) {
        const v = clean(cellAt(sheet, r, c)?.value ?? '');
        for (const key of ['SKOR', 'NAMA', 'UNIT', 'KODE', 'LOKASI', 'TANGGAL']) if (v === key && !found[key]) found[key] = c;
      }
      if (found.SKOR && found.NAMA) {
        headRow = r;
        Object.assign(col, found);
      }
    }
    if (!headRow) continue;
    const title = [cellAt(sheet, 1, 1)?.value ?? '', sheet.name].join(' ');
    const moduleId = moduleForTitle(title, index++);
    if (!moduleId) continue;
    let count = 0;
    for (let r = headRow + 1; r <= sheet.maxRow; r++) {
      const name = (cellAt(sheet, r, col.NAMA)?.value ?? '').trim();
      const scoreText = (cellAt(sheet, r, col.SKOR)?.value ?? '').trim();
      if (!name || !/^\d+(\.\d+)?$/.test(scoreText)) continue;
      const get = (k: string) => (col[k] ? (cellAt(sheet, r, col[k])?.value ?? '').trim() : '');
      rows.push({
        moduleId,
        score: Math.max(0, Math.min(100, Math.round(Number(scoreText)))),
        name,
        unit: get('UNIT'),
        rawCode: get('KODE'),
        location: get('LOKASI'),
        date: get('TANGGAL').slice(0, 10)
      });
      count++;
    }
    sessions.push({ moduleId, sheet: sheet.name, rows: count });
  }
  return { sessions, rows };
}

/** "AYU (HAYP)" → { name: "AYU", code: "HAYP" }. */
export function splitAgentName(full: string): { name: string; code: string } {
  const m = full.trim().match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m ? { name: m[1].trim(), code: clean(m[2]) } : { name: full.trim(), code: '' };
}

/** Unit-unit di Brighton HUB Cibubur (untuk pencocokan lewat nama). */
const CIBUBUR_UNITS = ['WARRIOR', 'CHAMPION', 'VISION', 'PRIORITY', 'WINNER', 'HARMONY', 'MAX'];

/** Kode salah ketik ringan: huruf sama tapi tertukar, atau beda satu huruf ("NBPB" ~ "NPBP"). */
export function similarCode(a: string, b: string): boolean {
  if (a.length !== 4 || b.length !== 4 || a === b) return false;
  if ([...a].sort().join('') === [...b].sort().join('')) return true;
  let diff = 0;
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

const letters = (s: string) => clean(s).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

export type MatchLevel = 'kode' | 'nama';

export interface Finding {
  moduleId: string;
  row: RecapRow;
  level: MatchLevel;
}

export interface AgentFindings {
  agent: TrainingAgent;
  findings: Finding[];
  /** 'kode' jika semua temuan cocok lewat kode PA. */
  level: MatchLevel;
}

/**
 * Cocokkan baris rekap dengan agen untuk sesi yang belum lulus / masih menunggu nilai.
 * - kode: kode PA agen ada di kolom Kode atau Nama.
 * - nama: nama depan sama / kode salah ketik ringan, dan (lokasi Cibubur atau unit HUB Cibubur) — perlu dicek admin.
 * Per sesi diambil satu baris terbaik (cocok kode dulu, lalu skor tertinggi).
 */
export function matchRecap(agents: TrainingAgent[], recap: RecapFile): AgentFindings[] {
  const out: AgentFindings[] = [];
  for (const agent of agents) {
    const { name, code } = splitAgentName(agent.name);
    const first = letters(name).split(' ')[0] ?? '';
    const best = new Map<string, Finding>();
    for (const row of recap.rows) {
      const st = moduleStatus(agent, row.moduleId);
      if (st === 'lulus') continue;
      let level: MatchLevel | null = null;
      if (code && [...codeTokens(row.rawCode), ...codeTokens(row.name)].includes(code)) level = 'kode';
      else {
        const rowName = letters(row.name);
        const nameOk = first.length >= 3 && (rowName === letters(name) || rowName.split(' ').includes(first));
        const codeOk = !!code && [...codeTokens(row.rawCode), ...codeTokens(row.name)].some((t) => similarCode(t, code));
        const place = clean(row.location).includes('CIBUBUR') || CIBUBUR_UNITS.some((u) => clean(row.unit).endsWith(u));
        if ((nameOk || codeOk) && place) level = 'nama';
      }
      if (!level) continue;
      const prev = best.get(row.moduleId);
      const better =
        !prev ||
        (level === 'kode' && prev.level === 'nama') ||
        (level === prev.level && row.score > prev.row.score);
      if (better) best.set(row.moduleId, { moduleId: row.moduleId, row, level });
    }
    if (best.size === 0) continue;
    const findings = TRAINING_MODULES.map((m) => best.get(m.id)).filter((f): f is Finding => !!f);
    out.push({ agent, findings, level: findings.every((f) => f.level === 'kode') ? 'kode' : 'nama' });
  }
  return out.sort((a, b) => (a.level === b.level ? a.agent.name.localeCompare(b.agent.name) : a.level === 'kode' ? -1 : 1));
}
