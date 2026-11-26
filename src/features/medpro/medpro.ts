import { cellAt, colIndex, fillKind, type GridSheet } from '../../utils/xlsxGrid';

/** Akhiran nomor INVOICE BR kantor ini (pembeda dari kantor Brighton lain). */
export const OFFICE_SUFFIX = 'CIBUBUR';

/** Nota medpro (banner/plank & alat branding) kantor sendiri. */
export interface MedproNota {
  id: string;
  /** Tanggal barang datang / nota diinput (YYYY-MM-DD). */
  date: string;
  /** Nomor INVOICE asli, mis. "022589/ASP/FP/XI/2026". */
  invoice: string;
  banner: number;
  branding: number;
  /** Sudah dicek & nominal sesuai (hijau). */
  checked: boolean;
  /** Tanggal dibayar; null = periode berjalan. */
  paidOn: string | null;
  note?: string;
  /** Rincian barang dari Input nota (untuk cek silang); kosong untuk nota yang diinput manual/impor. */
  items?: NotaLine[];
}

/** Satu baris barang di dalam nota. */
export interface NotaLine {
  description: string;
  product: string;
  /** Nama pada nota, mis. "MONIKA JUAL". */
  label: string;
  size: string;
  price: number;
  qty: number;
  total: number;
  category: 'banner' | 'branding';
}

/** Jumlah rincian barang per kategori, untuk dibandingkan dengan kolom nota. */
export function lineTotals(items: NotaLine[]): { banner: number; branding: number } {
  return items.reduce(
    (acc, it) => ({ ...acc, [it.category]: acc[it.category] + (it.total || 0) }),
    { banner: 0, branding: 0 }
  );
}

/** Rincian tidak cocok dengan kolom Banner/Alat branding (mis. stiker tercatat di kolom yang salah). */
export function lineMismatch(n: Pick<MedproNota, 'banner' | 'branding' | 'items'>): string | null {
  if (!n.items?.length) return null;
  const t = lineTotals(n.items);
  const fmt = (v: number) => v.toLocaleString('id-ID');
  const out: string[] = [];
  if (t.banner !== n.banner) out.push(`barang Banner/plank ${fmt(t.banner)} ≠ kolom ${fmt(n.banner)}`);
  if (t.branding !== n.branding) out.push(`barang Alat branding ${fmt(t.branding)} ≠ kolom ${fmt(n.branding)}`);
  return out.length ? `Tidak cocok: ${out.join('; ')}.` : null;
}

/** "BANNER" → "Banner", "ID CARD" → "ID Card". */
function productName(product: string): string {
  return product
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w === 'id' ? 'ID' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Pesan WhatsApp ke agen: barang pesanannya sudah tiba di kantor. */
export function arrivalMessage(item: NotaLine, greeting: string): string {
  const what = productName(item.product) || (item.category === 'banner' ? 'Banner' : 'Alat branding');
  const size = item.size.trim() ? ` ukuran ${item.size.trim()}` : '';
  const qty = item.qty > 1 ? ` (${item.qty} pcs)` : '';
  return [
    `${greeting}, Bapak/Ibu.`,
    '',
    `Kami informasikan ${what} *${item.label.trim() || item.description.trim()}*${size}${qty} sudah tersedia di kantor Brighton HUB Cibubur dan dapat diambil pada jam operasional.`,
    '',
    'Terima kasih.'
  ].join('\n');
}

/** Nota drop banner (banner yang dikirim/diantar ke kantor lain). */
export interface MedproDrop {
  id: string;
  date: string;
  /** Kantor tujuan, mis. "BALI". */
  office: string;
  notaNo: string;
  amount: number;
  checked: boolean;
  paidOn: string | null;
  note?: string;
}

/** Rapikan nomor invoice: huruf besar, tanpa spasi. */
export function normalizeInvoice(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** "022589/ASP/FP/XI/2026" → "022589-CIBUBUR". */
export function invoiceBr(invoice: string): string {
  const head = normalizeInvoice(invoice).split('/')[0];
  return `${head}-${OFFICE_SUFFIX}`;
}

const STANDARD_INVOICE = /^\d{5,7}\/ASP\/[A-Z]{2}\/[IVXLC]+\/\d{4}$/;

/** null = valid; string = pesan error. Peringatan format tidak menghalangi simpan. */
export function validateNotaInput(input: {
  date: string;
  invoice: string;
  banner: number;
  branding: number;
}): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Tanggal nota wajib diisi.';
  const inv = normalizeInvoice(input.invoice);
  if (!inv) return 'Nomor INVOICE wajib diisi.';
  if (!/^\d{5,7}\//.test(inv)) return 'Nomor INVOICE harus diawali angka nota, mis. 022589/ASP/FP/XI/2026.';
  if (!(input.banner > 0) && !(input.branding > 0)) return 'Isi nominal Banner/Plank atau Alat Branding.';
  if (input.banner < 0 || input.branding < 0) return 'Nominal tidak boleh negatif.';
  return null;
}

export function invoiceFormatWarning(invoice: string): string | null {
  return STANDARD_INVOICE.test(normalizeInvoice(invoice))
    ? null
    : 'Format berbeda dari biasanya (contoh: 022589/ASP/FP/XI/2026). Pastikan sudah sesuai nota.';
}

/* ------------------------------------------------------------------ */
/* Jadwal pembayaran: tanggal 14 & 28; Sabtu/Minggu dimajukan ke Jumat */
/* ------------------------------------------------------------------ */

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** Tanggal bayar sebenarnya untuk tanggal 14/28 pada bulan itu. */
export function adjustedPayday(year: number, month: number, day: 14 | 28): string {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 Minggu, 6 Sabtu
  const shift = dow === 6 ? 1 : dow === 0 ? 2 : 0;
  return iso(year, month, day - shift);
}

/** Jadwal bayar berikutnya pada atau setelah tanggal tersebut. */
export function nextPayday(fromIso: string): string {
  const [y, m] = fromIso.split('-').map(Number);
  for (let i = 0; i < 3; i++) {
    const yy = y + Math.floor((m - 1 + i) / 12);
    const mm = ((m - 1 + i) % 12) + 1;
    for (const d of [14, 28] as const) {
      const p = adjustedPayday(yy, mm, d);
      if (p >= fromIso) return p;
    }
  }
  return fromIso;
}

/* ------------------------------------------------------------------ */
/* Ringkasan & BC                                                       */
/* ------------------------------------------------------------------ */

export function notaTotal(n: Pick<MedproNota, 'banner' | 'branding'>): number {
  return (n.banner || 0) + (n.branding || 0);
}

export function summarize(notas: MedproNota[]) {
  return {
    count: notas.length,
    checked: notas.filter((n) => n.checked).length,
    banner: notas.reduce((s, n) => s + (n.banner || 0), 0),
    branding: notas.reduce((s, n) => s + (n.branding || 0), 0),
    total: notas.reduce((s, n) => s + notaTotal(n), 0)
  };
}

export function sortNotas<T extends { date: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}

/** Format BC pembayaran (nomor INVOICE asli, dipisah banner & alat branding). */
export function buildPaymentBc(notas: MedproNota[]): string {
  const sorted = sortNotas(notas);
  const banner = sorted.filter((n) => n.banner > 0).map((n) => n.invoice);
  const branding = sorted.filter((n) => n.branding > 0).map((n) => n.invoice);
  const parts: string[] = [];
  if (banner.length) parts.push(`INVOICE PEMBAYARAN BANNER BRIGHTON ${OFFICE_SUFFIX}\n\n${banner.join('\n')}`);
  if (branding.length) parts.push(`INVOICE PEMBAYARAN ALAT BRANDING BRIGHTON ${OFFICE_SUFFIX}\n\n${branding.join('\n')}`);
  return parts.join('\n\n');
}

/** Format BC nota drop banner (ringkas, per kantor tujuan). */
export function buildDropBc(drops: MedproDrop[]): string {
  if (drops.length === 0) return '';
  const lines = sortNotas(drops).map((d) => `${d.notaNo} (${d.office})`);
  return `INVOICE PEMBAYARAN DROP BANNER BRIGHTON ${OFFICE_SUFFIX}\n\n${lines.join('\n')}`;
}

/** Kelompokkan nota yang sudah dibayar per tanggal bayar (terbaru dulu). */
export function groupByPaidOn<T extends { paidOn: string | null }>(list: T[]): { paidOn: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const n of list) {
    if (!n.paidOn) continue;
    map.set(n.paidOn, [...(map.get(n.paidOn) ?? []), n]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([paidOn, items]) => ({ paidOn, items }));
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatLongId(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${DAYS_ID[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS_ID[m - 1]} ${y}`;
}

export function formatShortId(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_ID[m - 1].slice(0, 3)}`;
}

export function formatRupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

/** "Rp 1.250.000", "1250000", "1.250.000" → 1250000. */
export function parseRupiah(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/* ------------------------------------------------------------------ */
/* Impor rekap Excel (sheet "NEW MEDPRO")                               */
/* ------------------------------------------------------------------ */

const MONTH_PREFIX: [string, number][] = [
  ['JAN', 1], ['FEB', 2], ['PEB', 2], ['MAR', 3], ['APR', 4], ['MEI', 5], ['MAY', 5], ['JUN', 6], ['JUL', 7],
  ['AGU', 8], ['AGT', 8], ['AUG', 8], ['SEP', 9], ['OKT', 10], ['OCT', 10], ['NOV', 11], ['NOP', 11], ['DES', 12], ['DEC', 12]
];

/** "11 AGUSTUS" / "26 agutus" / "18 DROP HI" (bulan dari baris sebelumnya). */
export function parseLooseDate(
  raw: string,
  fallback: { year: number; month: number } | null
): { date: string; rest: string } | null {
  const s = raw.trim().toUpperCase();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, rest: '' };
  const m = s.match(/^(\d{1,2})\s*([A-Z]+)?\s*(.*)$/);
  if (!m) return null;
  const day = Number(m[1]);
  let month: number | undefined;
  let rest = m[3] ?? '';
  if (m[2]) {
    month = MONTH_PREFIX.find(([p]) => m[2].startsWith(p))?.[1];
    if (month === undefined) rest = `${m[2]} ${rest}`.trim();
  }
  month ??= fallback?.month;
  const year = fallback?.year ?? new Date().getFullYear();
  if (!month || day < 1 || day > 31) return null;
  return { date: iso_(year, month, day), rest: rest.trim() };
}

function iso_(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function yearOfInvoice(inv: string): number | null {
  const y = inv.match(/(20\d{2})\s*$/)?.[1];
  return y ? Number(y) : null;
}

export interface MedproImportResult {
  notas: Omit<MedproNota, 'id'>[];
  drops: Omit<MedproDrop, 'id'>[];
  /** Jumlah tabel (periode) yang terbaca. */
  periods: number;
}

/** Cari sheet medpro: ada judul kolom "INVOICE BR". */
export function findMedproSheet(sheets: GridSheet[]): GridSheet | null {
  return (
    sheets.find((s) => [...s.cells.values()].some((c) => c.value.toUpperCase().replace(/\s+/g, ' ') === 'INVOICE BR')) ??
    null
  );
}

/**
 * Setiap tabel "TANGGAL | INVOICE BR | INVOICE | BANNER/PLANK | ALAT BRANDING | TOTAL"
 * = satu periode pembayaran. Tabel terakhir (tanggal terbaru) = periode berjalan;
 * tabel sebelumnya dianggap sudah dibayar pada jadwal bayar setelah nota terakhirnya.
 * Sel INVOICE BR hijau = sudah dicek & sesuai. Sel berisi "DROP" di luar tabel = drop banner.
 */
export function importMedproSheet(sheet: GridSheet): MedproImportResult {
  type Block = { headerRow: number; col: number; notas: Omit<MedproNota, 'id'>[] };
  const blocks: Block[] = [];
  for (const [ref, c] of sheet.cells) {
    if (c.value.trim().toUpperCase() !== 'TANGGAL') continue;
    const m = ref.match(/^([A-Z]+)(\d+)$/)!;
    const col = colIndex(m[1]);
    const row = Number(m[2]);
    if ((cellAt(sheet, row, col + 1)?.value ?? '').toUpperCase().replace(/\s+/g, ' ') === 'INVOICE BR') {
      blocks.push({ headerRow: row, col, notas: [] });
    }
  }
  const blockDateCells = new Set<string>();
  for (const b of blocks) {
    let current: { year: number; month: number; date: string } | null = null;
    for (let row = b.headerRow + 1; row <= sheet.maxRow; row++) {
      const first = (cellAt(sheet, row, b.col)?.value ?? '').toUpperCase();
      if (first.startsWith('TOTAL') || first === 'TANGGAL' || first.includes('NOTA MEDPRO')) break;
      const invCell = cellAt(sheet, row, b.col + 2);
      const invoice = normalizeInvoice(invCell?.value ?? '');
      const dateRaw = cellAt(sheet, row, b.col)?.value ?? '';
      if (dateRaw) {
        blockDateCells.add(`${b.col}:${row}`);
        const year = yearOfInvoice(invoice) ?? current?.year ?? new Date().getFullYear();
        const parsed = parseLooseDate(dateRaw, current ? { year, month: current.month } : { year, month: 0 });
        if (parsed) current = { year: Number(parsed.date.slice(0, 4)), month: Number(parsed.date.slice(5, 7)), date: parsed.date };
      }
      if (!invoice || !current) continue;
      const banner = Number((cellAt(sheet, row, b.col + 3)?.value ?? '').replace(/[^\d.]/g, '')) || 0;
      const branding = Number((cellAt(sheet, row, b.col + 4)?.value ?? '').replace(/[^\d.]/g, '')) || 0;
      const brCell = cellAt(sheet, row, b.col + 1);
      const note = dateRaw && /DROP/i.test(dateRaw) ? dateRaw.replace(/^\d+\s*/, '').trim() : undefined;
      b.notas.push({
        date: current.date,
        invoice,
        banner,
        branding,
        checked: fillKind(brCell?.fill ?? null) === 'green',
        paidOn: null,
        ...(note ? { note } : {})
      });
    }
  }

  const nonEmpty = blocks.filter((b) => b.notas.length > 0);
  const lastDate = (b: Block) => b.notas.reduce((max, n) => (n.date > max ? n.date : max), '');
  nonEmpty.sort((a, b) => lastDate(a).localeCompare(lastDate(b)));
  const active = nonEmpty[nonEmpty.length - 1];
  const activeStart = active ? active.notas.reduce((min, n) => (n.date < min ? n.date : min), '9999') : '9999';
  for (const b of nonEmpty) {
    if (b === active) continue;
    // Dibayar pada jadwal bayar pertama setelah nota terakhir periode tersebut.
    const after = new Date(Date.UTC(+lastDate(b).slice(0, 4), +lastDate(b).slice(5, 7) - 1, +lastDate(b).slice(8, 10) + 1))
      .toISOString()
      .slice(0, 10);
    const paid = nextPayday(after);
    for (const n of b.notas) n.paidOn = paid;
  }

  // Drop banner di luar tabel: "10 JUNI DROP BALI | nomor nota | nominal".
  const drops: Omit<MedproDrop, 'id'>[] = [];
  const refYear = active ? Number(lastDate(active).slice(0, 4)) : new Date().getFullYear();
  for (const [ref, c] of sheet.cells) {
    if (!/DROP/i.test(c.value)) continue;
    const m = ref.match(/^([A-Z]+)(\d+)$/)!;
    const col = colIndex(m[1]);
    const row = Number(m[2]);
    if (blockDateCells.has(`${col}:${row}`)) continue;
    const parsed = parseLooseDate(c.value, { year: refYear, month: 0 });
    if (!parsed) continue;
    const office = parsed.rest.replace(/^DROP\s*/i, '').trim() || '-';
    const notaCell = cellAt(sheet, row, col + 1);
    let amount = 0;
    for (let k = 2; k <= 4 && !amount; k++) amount = Number((cellAt(sheet, row, col + k)?.value ?? '').replace(/[^\d]/g, '')) || 0;
    if (!notaCell?.value) continue;
    const date = parsed.date;
    drops.push({
      date,
      office,
      notaNo: normalizeInvoice(notaCell.value),
      amount,
      checked: fillKind(notaCell.fill) === 'green',
      paidOn: date < activeStart ? nextPayday(date) : null
    });
  }

  return { notas: nonEmpty.flatMap((b) => b.notas), drops, periods: nonEmpty.length };
}
