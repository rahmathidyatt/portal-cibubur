import { cellAt, fillKind, type GridSheet } from '../../utils/xlsxGrid';

/** Nilai minimal kelulusan setiap sesi. */
export const PASS_SCORE = 60;

export interface TrainingModule {
  id: string;
  title: string;
  /** Tahap 1–4 (kelompok warna di rekap Excel). */
  stage: 1 | 2 | 3 | 4;
}

/** Sesi Training Brighton (tetap, urut seperti rekap). */
export const TRAINING_MODULES: TrainingModule[] = [
  { id: 'bisnis-bersama', title: 'Bisnis Bersama Brighton', stage: 1 },
  { id: 'etika-pelayanan', title: 'Etika & Pelayanan Bisnis Properti', stage: 1 },
  { id: 'tentang-bisnis', title: 'Tentang Bisnis Properti', stage: 1 },
  { id: 'kebiasaan-sukses', title: 'Kebiasaan Sukses Agen Properti', stage: 2 },
  { id: 'listing-modal', title: 'Listing adalah Modal Bisnis Properti', stage: 2 },
  { id: 'primary-secondary', title: 'Bisnis Properti: Primary & Secondary Market', stage: 2 },
  { id: 'dokumen-kepemilikan', title: 'Dokumen Kepemilikan Properti', stage: 3 },
  { id: 'alur-transaksi', title: 'Alur Transaksi Bisnis Properti', stage: 3 },
  { id: 'branding-expose', title: 'Branding Brighton & Expose Bikin Closing', stage: 3 },
  { id: 'klien-percaya', title: 'Klien Percaya, Bisnis Berkembang', stage: 4 },
  { id: 'negosiasi', title: 'Negosiasi', stage: 4 }
];

export interface TrainingAgent {
  id: string;
  /** Nama tampilan, mis. "MARSEL (GFXY)". */
  name: string;
  /** Nilai terakhir per sesi (id sesi → nilai 0–100). */
  scores: Record<string, number>;
  /** Sesi yang sudah didaftarkan & menunggu nilai (id sesi → tanggal batch YYYY-MM-DD, atau ''). */
  pending: Record<string, string>;
  /** Ditetapkan lulus oleh admin (hijau di rekap) walau nilai sesi tidak lengkap. */
  graduated?: boolean;
  /** L = Bapak, P = Ibu (sapaan di BC). */
  gender?: 'L' | 'P' | null;
  note?: string;
}

export type ModuleStatus = 'lulus' | 'menunggu' | 'tidak-lulus' | 'belum';
export type AgentStatus = 'lulus' | 'menunggu' | 'belum';

export function moduleStatus(agent: TrainingAgent, moduleId: string): ModuleStatus {
  if (moduleId in agent.pending) return 'menunggu';
  const score = agent.scores[moduleId];
  if (score === undefined) return 'belum';
  return score >= PASS_SCORE ? 'lulus' : 'tidak-lulus';
}

/**
 * Hijau = lulus (semua sesi ≥ 60 atau ditetapkan lulus oleh admin),
 * merah = ada sesi yang didaftarkan & menunggu nilai, abu-abu = belum lulus.
 */
export function agentStatus(agent: TrainingAgent): AgentStatus {
  const statuses = TRAINING_MODULES.map((m) => moduleStatus(agent, m.id));
  if (statuses.includes('menunggu')) return 'menunggu';
  if (agent.graduated || statuses.every((s) => s === 'lulus')) return 'lulus';
  return 'belum';
}

export function passedCount(agent: TrainingAgent): number {
  return TRAINING_MODULES.filter((m) => moduleStatus(agent, m.id) === 'lulus').length;
}

/** Sesi yang masih harus diikuti (belum ikut / tidak lulus, dan belum didaftarkan). */
export function outstandingModules(agent: TrainingAgent): TrainingModule[] {
  return TRAINING_MODULES.filter((m) => {
    const s = moduleStatus(agent, m.id);
    return s === 'belum' || s === 'tidak-lulus';
  });
}

/** Daftarkan agen ke batch: sesi terpilih (bawaan: semua yang belum lulus) jadi "menunggu nilai". */
export function registerToBatch(agent: TrainingAgent, batchDate: string, moduleIds?: string[]): TrainingAgent {
  const ids = moduleIds ?? outstandingModules(agent).map((m) => m.id);
  const pending = { ...agent.pending };
  for (const id of ids) pending[id] = batchDate;
  return { ...agent, pending };
}

/** Isi / hapus nilai; mengisi nilai menutup status "menunggu" sesi tersebut. */
export function setScore(agent: TrainingAgent, moduleId: string, score: number | null): TrainingAgent {
  const scores = { ...agent.scores };
  const pending = { ...agent.pending };
  if (score === null) delete scores[moduleId];
  else scores[moduleId] = Math.max(0, Math.min(100, Math.round(score)));
  delete pending[moduleId];
  return { ...agent, scores, pending };
}

export function cancelPending(agent: TrainingAgent, moduleId: string): TrainingAgent {
  const pending = { ...agent.pending };
  delete pending[moduleId];
  return { ...agent, pending };
}

/** "100 & 80", "80/100" (ulang) → nilai tertinggi; teks kosong → undefined. */
export function parseScore(raw: string): number | undefined {
  const nums = (raw.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.'))).filter((n) => n <= 100);
  return nums.length ? Math.max(...nums) : undefined;
}

export function validateAgentName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Nama agen wajib diisi.';
  if (n.length > 80) return 'Nama agen terlalu panjang.';
  return null;
}

/** Nama seragam: huruf besar, spasi tunggal. "marsel (gfxy)" → "MARSEL (GFXY)". */
export function normalizeAgentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatBatchDate(iso: string): string {
  if (!iso) return 'tanggal menyusul';
  const [y, m, d] = iso.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${day}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Jumat, 06 November 2026" (tanggal dua digit, gaya pengumuman resmi). */
export function formatDeadlineDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${day}, ${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** Salam sesuai jam WIB: pagi (<11), siang (<15), sore (<18), malam. */
export function greetingForHour(hour: number): string {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Batas pendaftaran bawaan: Jumat terakhir sebelum tanggal batch (atau Jumat terdekat dari hari ini). */
export function defaultDeadline(batchDate: string | undefined, todayIso: string): string {
  const base = batchDate || todayIso;
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (batchDate) {
    do t.setUTCDate(t.getUTCDate() - 1);
    while (t.getUTCDay() !== 5);
  } else {
    while (t.getUTCDay() !== 5) t.setUTCDate(t.getUTCDate() + 1);
  }
  return t.toISOString().slice(0, 10);
}

/** Agen yang punya sesi menunggu nilai (opsional: hanya batch tertentu), urut nama. */
export function registeredAgents(agents: TrainingAgent[], batchDate?: string): { agent: TrainingAgent; modules: TrainingModule[] }[] {
  return agents
    .map((a) => ({
      agent: a,
      modules: TRAINING_MODULES.filter((m) => m.id in a.pending && (batchDate === undefined || a.pending[m.id] === batchDate))
    }))
    .filter((r) => r.modules.length > 0)
    .sort((a, b) => a.agent.name.localeCompare(b.agent.name));
}

/** Batch training berikutnya (biasanya Senin–Kamis), diatur admin. */
export interface TrainingBatch {
  start: string;
  end: string;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Tanggal selesai batch: dari pengaturan bila tanggal mulainya sama, selain itu 4 hari (Senin–Kamis). */
export function batchEnd(start: string, batch?: TrainingBatch | null): string {
  return batch && batch.start === start ? batch.end : addDays(start, 3);
}

/** "Senin–Kamis, 23–26 November 2026" (lintas bulan: "Senin, 30 November – Kamis, 3 Desember 2026"). */
export function formatBatchRange(start: string, end: string): string {
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const day = (y: number, m: number, d: number) => DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  if (start === end) return `${day(y1, m1, d1)}, ${d1} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${day(y1, m1, d1)}–${day(y2, m2, d2)}, ${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
  const left = `${day(y1, m1, d1)}, ${d1} ${MONTHS[m1 - 1]}${y1 === y2 ? '' : ` ${y1}`}`;
  return `${left} – ${day(y2, m2, d2)}, ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

/** Sapaan sesuai jenis kelamin agen. */
export function salutation(agent: Pick<TrainingAgent, 'gender'>): string {
  return agent.gender === 'L' ? 'Bapak' : agent.gender === 'P' ? 'Ibu' : 'Bapak/Ibu';
}

export interface TrainingBcOptions {
  batchDate?: string;
  /** Batch berikutnya yang diatur admin (untuk BC pengingat & konfirmasi). */
  nextBatch?: TrainingBatch | null;
  /** Batas pendaftaran (YYYY-MM-DD) & jamnya, mis. "17.00". */
  deadline: string;
  deadlineTime: string;
  greeting: string;
}

/** BC grup: daftar PA yang sudah terdaftar sebagai peserta Training Bright On. */
export function buildTrainingBc(agents: TrainingAgent[], opts: TrainingBcOptions): string {
  const rows = registeredAgents(agents, opts.batchDate);
  if (rows.length === 0) return '';
  return [
    `${opts.greeting}, Bapak/Ibu.`,
    '',
    'Berikut kami informasikan daftar Property Advisor (PA) yang telah terdaftar sebagai peserta Training Bright On:',
    '',
    ...rows.map((r) => `- ${r.agent.name}`),
    '',
    '📌 PENTING UNTUK DIPERHATIKAN',
    `- Batas akhir pendaftaran dan penambahan peserta ke grup adalah ${formatDeadlineDate(opts.deadline)}, pukul ${opts.deadlineTime} WIB.`,
    '- Setelah batas waktu tersebut, akses admin untuk penambahan peserta akan ditutup.',
    '- PA yang belum terdaftar diharapkan segera melakukan pendaftaran atau menghubungi Admin untuk mendapatkan bantuan.',
    '- Seluruh peserta wajib dipastikan telah berhasil login ke aplikasi Brighton sebelum mengikuti pelatihan.',
    '',
    'Terima kasih atas perhatian dan kerja samanya.'
  ].join('\n');
}

/** BC pribadi untuk satu agen (dikirim ke WhatsApp/PC masing-masing agen). */
export function buildAgentTrainingBc(agent: TrainingAgent, opts: TrainingBcOptions): string {
  const modules = TRAINING_MODULES.filter((m) => m.id in agent.pending && (opts.batchDate === undefined || agent.pending[m.id] === opts.batchDate));
  if (modules.length === 0) return '';
  const dates = [...new Set(modules.map((m) => agent.pending[m.id]).filter(Boolean))].sort();
  const sapa = salutation(agent);
  const batch =
    dates.length === 1 ? ` batch ${formatBatchRange(dates[0], batchEnd(dates[0], opts.nextBatch))}` : '';
  return [
    `${opts.greeting}, ${sapa} ${agent.name}.`,
    '',
    `Kami informasikan bahwa ${sapa} telah terdaftar sebagai peserta Training Bright On${batch} untuk ${modules.length} sesi berikut:`,
    '',
    ...modules.map((m, i) => `${i + 1}. ${m.title}`),
    '',
    '📌 PENGINGAT',
    '- Pastikan sudah berhasil login ke aplikasi Brighton sebelum pelatihan dimulai.',
    '- Hadir tepat waktu dan ikuti setiap sesi hingga selesai.',
    '- Saat mengisi absensi & kuis, WAJIB menuliskan Nama dan Kode Agen yang sesuai.',
    '- Kesalahan penulisan nama dan kode agen bukan menjadi tanggung jawab Admin apabila nilai tidak terekam.',
    `- Nilai minimal kelulusan adalah ${PASS_SCORE}. Sesi yang belum lulus akan didaftarkan ulang pada batch berikutnya.`,
    '',
    'Terima kasih dan semangat mengikuti training.'
  ].join('\n');
}

/** Tanggal-tanggal batch yang masih punya pendaftaran menunggu nilai (terbaru dulu, '' terakhir). */
export function pendingBatches(agents: TrainingAgent[]): string[] {
  const set = new Set<string>();
  for (const a of agents) for (const d of Object.values(a.pending)) set.add(d);
  return [...set].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a)));
}

/* ------------------------------------------------------------------ */
/* Impor rekap Excel (sheet "BRIGHT ON")                               */
/* ------------------------------------------------------------------ */

export interface TrainingImportResult {
  agents: Omit<TrainingAgent, 'id'>[];
  sheetName: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

/** Cari sheet rekap training: ada sel "PROPERTY ADVISOR" dan judul sesi. */
export function findTrainingSheet(sheets: GridSheet[]): GridSheet | null {
  return (
    sheets.find((s) => [...s.cells.values()].some((c) => norm(c.value) === 'propertyadvisor')) ??
    sheets.find((s) => /bright\s*on|training/i.test(s.name)) ??
    null
  );
}

/**
 * Warna mengikuti rekap: sel/nama merah = sudah didaftarkan & menunggu nilai
 * (kecuali selnya sudah berisi nilai lulus). Nama merah tanpa sel merah: semua
 * sesi kosong dianggap menunggu nilai.
 */
export function importTrainingSheet(sheet: GridSheet): TrainingImportResult {
  let headerRow = 0;
  let nameCol = 0;
  for (const [ref, c] of sheet.cells) {
    if (norm(c.value) === 'propertyadvisor') {
      const m = ref.match(/^([A-Z]+)(\d+)$/)!;
      headerRow = Number(m[2]);
      nameCol = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      break;
    }
  }
  if (!headerRow) throw new Error('Kolom "PROPERTY ADVISOR" tidak ditemukan pada sheet training.');

  // Petakan kolom → sesi berdasarkan judul (cocok sebagian), sisanya menurut urutan.
  const colToModule = new Map<number, string>();
  const used = new Set<string>();
  for (let col = nameCol + 1; col <= sheet.maxCol; col++) {
    const title = norm(cellAt(sheet, headerRow, col)?.value ?? '');
    if (!title) continue;
    const match = TRAINING_MODULES.find(
      (m) => !used.has(m.id) && (norm(m.title) === title || norm(m.title).startsWith(title.slice(0, 12)) || title.startsWith(norm(m.title).slice(0, 12)))
    );
    if (match) {
      colToModule.set(col, match.id);
      used.add(match.id);
    }
  }
  if (colToModule.size < 5) {
    TRAINING_MODULES.forEach((m, i) => colToModule.set(nameCol + 1 + i, m.id));
  }

  const agents: Omit<TrainingAgent, 'id'>[] = [];
  const seen = new Set<string>();
  for (let row = headerRow + 1; row <= sheet.maxRow; row++) {
    const nameCell = cellAt(sheet, row, nameCol);
    const name = normalizeAgentName(nameCell?.value ?? '');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const scores: Record<string, number> = {};
    const pending: Record<string, string> = {};
    let anyRedCell = false;
    for (const [col, id] of colToModule) {
      const cell = cellAt(sheet, row, col);
      // "80 → daftar 20/11": angka setelah kata daftar adalah tanggal batch, bukan nilai.
      const score = parseScore((cell?.value ?? '').replace(/(→\s*)?daftar.*$/i, ''));
      if (score !== undefined) scores[id] = score;
      // Merah = didaftarkan & menunggu nilai. Bila nilainya sudah lulus, nilai yang dipakai.
      if (fillKind(cell?.fill ?? null) === 'red') {
        anyRedCell = true;
        if (score === undefined || score < PASS_SCORE) pending[id] = '';
      }
    }
    const nameKind = fillKind(nameCell?.fill ?? null);
    if (nameKind === 'red' && !anyRedCell) {
      for (const id of colToModule.values()) if (scores[id] === undefined) pending[id] = '';
    }
    agents.push({ name, scores, pending, graduated: nameKind === 'green' });
  }
  return { agents, sheetName: sheet.name };
}

/** Agen yang masih punya sesi belum diikuti / belum lulus (tidak termasuk yang menunggu nilai). */
export function reminderAgents(agents: TrainingAgent[]): { agent: TrainingAgent; modules: { module: TrainingModule; status: 'belum' | 'tidak-lulus' }[] }[] {
  return agents
    .filter((a) => !a.graduated)
    .map((agent) => ({
      agent,
      modules: TRAINING_MODULES.map((module) => ({ module, status: moduleStatus(agent, module.id) }))
        .filter((x): x is { module: TrainingModule; status: 'belum' | 'tidak-lulus' } => x.status === 'belum' || x.status === 'tidak-lulus')
    }))
    .filter((r) => r.modules.length > 0)
    .sort((a, b) => a.agent.name.localeCompare(b.agent.name));
}

/** Kalimat jadwal batch berikutnya untuk BC pengingat. */
function nextBatchSentence(batch?: TrainingBatch | null): string {
  return batch?.start
    ? `Batch berikutnya akan dilaksanakan pada ${formatBatchRange(batch.start, batch.end)}.`
    : 'Jadwal batch berikutnya akan kami informasikan kemudian.';
}

/** BC pengingat sesi yang belum diikuti / belum lulus (semua agen, atau satu agen). */
export function buildReminderBc(
  agents: TrainingAgent[],
  opts: Pick<TrainingBcOptions, 'greeting' | 'nextBatch'>,
  agentId?: string
): string {
  const rows = reminderAgents(agents).filter((r) => !agentId || r.agent.id === agentId);
  if (rows.length === 0) return '';
  const label = (s: 'belum' | 'tidak-lulus') => (s === 'belum' ? 'belum mengikuti' : 'belum lulus');
  const list = (r: (typeof rows)[number]) => r.modules.map((m) => `- ${m.module.title} (${label(m.status)})`);
  const body = agentId
    ? [
        `${opts.greeting}, ${salutation(rows[0].agent)} ${rows[0].agent.name}.`,
        '',
        `Kami ingatkan bahwa masih terdapat sesi Training Bright On yang belum ${salutation(rows[0].agent)} ikuti atau belum lulus. ${nextBatchSentence(opts.nextBatch)}`,
        '',
        ...list(rows[0])
      ]
    : [
        `${opts.greeting}, Bapak/Ibu.`,
        '',
        `Berikut kami informasikan Property Advisor (PA) yang masih memiliki sesi Training Bright On yang belum diikuti atau belum lulus. ${nextBatchSentence(opts.nextBatch)}`,
        '',
        ...rows.flatMap((r, i) => [...(i ? [''] : []), `*${r.agent.name}*`, ...list(r)])
      ];
  return [
    ...body,
    '',
    '📌 PENTING UNTUK DIPERHATIKAN',
    '- Saat mengisi absensi & kuis, WAJIB menuliskan Nama dan Kode Agen yang sesuai.',
    '- Kesalahan penulisan nama dan kode agen bukan menjadi tanggung jawab Admin apabila nilai tidak terekam.',
    `- Nilai minimal kelulusan adalah ${PASS_SCORE}.`,
    '',
    'Terima kasih atas perhatian dan kerja samanya.'
  ].join('\n');
}

/** "Tidak mengikuti": batalkan seluruh pendaftaran sesi yang masih menunggu nilai. */
export function cancelAllPending(agent: TrainingAgent): TrainingAgent {
  return { ...agent, pending: {} };
}
