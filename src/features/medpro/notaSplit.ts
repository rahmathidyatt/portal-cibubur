/** Input nota medpro: hasil baca foto nota (Gemini) → potongan per baris dengan kotak merah. */

/** Kotak dalam koordinat ternormalisasi 0–1000: [ymin, xmin, ymax, xmax]. */
export type Box = [number, number, number, number];

export type NotaCategory = 'banner' | 'branding';

export interface NotaItem {
  description: string;
  /** Jenis produk, mis. "BANNER", "ID CARD". */
  product: string;
  /** Nama pada nota, mis. "MONIKA JUAL". */
  label: string;
  /** Ukuran seperti tertulis, mis. "0,8 x 0,5 m" (boleh kosong). */
  size: string;
  price: number;
  qty: number;
  total: number;
  box: Box;
  category: NotaCategory;
}

export interface NotaScan {
  /** Nomor lengkap, mis. "022642/ASP/FP/XI/2026". */
  invoice: string;
  /** YYYY-MM-DD */
  date: string;
  paper: Box;
  items: NotaItem[];
  totalQty: number;
  grandTotal: number;
}

/** Banner, stiker banner & plank → Banner/Plank; selain itu → Alat Branding. */
export function categoryOf(text: string): NotaCategory {
  return /banner|plank|spanduk/i.test(text) ? 'banner' : 'branding';
}

function num(raw: string): number {
  return Number(raw.replace(',', '.'));
}

/** "0,8 x 0,5 m" → "80X50"; "2 x 1" → "200X100" (meter → cm); angka besar dianggap sudah cm. */
export function sizeCm(size: string): string {
  const m = size.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return '';
  const toCm = (v: number) => (v <= 10 ? Math.round(v * 100) : Math.round(v));
  return `${toCm(num(m[1]))}X${toCm(num(m[2]))}`;
}

/** Nama file per baris: "MONIKA JUAL 80X50 1PCS" (alat branding menyertakan jenis produknya). */
export function itemFileName(item: Pick<NotaItem, 'label' | 'product' | 'size' | 'qty' | 'category'>): string {
  const parts = [item.label.trim().toUpperCase()];
  if (item.category === 'branding' && item.product.trim() && !parts[0].includes(item.product.trim().toUpperCase()))
    parts.push(item.product.trim().toUpperCase());
  const cm = sizeCm(item.size);
  if (cm) parts.push(cm);
  parts.push(`${item.qty}PCS`);
  return parts
    .join(' ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nama file unik dalam satu ZIP (duplikat diberi akhiran (2), (3), …). */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const c = (seen.get(n) ?? 0) + 1;
    seen.set(n, c);
    return c === 1 ? n : `${n} (${c})`;
  });
}

/** "022642/ASP/FP/XI/2026" → "022642". */
export function notaNumber(invoice: string): string {
  return invoice.trim().split('/')[0].replace(/\s+/g, '') || 'nota';
}

export interface NotaCheck {
  /** Indeks baris yang harga × qty ≠ jumlah harga. */
  badLines: number[];
  sumTotal: number;
  sumQty: number;
  totalOk: boolean;
  qtyOk: boolean;
  ok: boolean;
  banner: number;
  branding: number;
}

/** Cek keseluruhan nota: tiap baris & total di bawah nota. */
export function checkNota(scan: Pick<NotaScan, 'items' | 'totalQty' | 'grandTotal'>): NotaCheck {
  const badLines = scan.items.flatMap((it, i) => (it.price * it.qty !== it.total ? [i] : []));
  const sumTotal = scan.items.reduce((s, it) => s + it.total, 0);
  const sumQty = scan.items.reduce((s, it) => s + it.qty, 0);
  const totalOk = sumTotal === scan.grandTotal;
  const qtyOk = sumQty === scan.totalQty;
  const by = (c: NotaCategory) => scan.items.filter((it) => it.category === c).reduce((s, it) => s + it.total, 0);
  return {
    badLines,
    sumTotal,
    sumQty,
    totalOk,
    qtyOk,
    ok: badLines.length === 0 && totalOk && qtyOk && scan.items.length > 0,
    banner: by('banner'),
    branding: by('branding')
  };
}

const clamp = (v: number) => Math.max(0, Math.min(1000, Number.isFinite(v) ? v : 0));
const toBox = (b: unknown, fallback: Box): Box =>
  Array.isArray(b) && b.length === 4 ? (b.map((v) => clamp(Number(v))) as Box) : fallback;
const toInt = (v: unknown) => Math.round(Number(String(v ?? '0').replace(/[^\d-]/g, '')) || 0);

/** Rapikan jawaban mentah Gemini menjadi NotaScan. */
export function normalizeScan(raw: Record<string, unknown>): NotaScan {
  const items = (Array.isArray(raw.items) ? raw.items : []).map((r) => {
    const it = r as Record<string, unknown>;
    const description = String(it.description ?? '').trim();
    const product = String(it.product ?? '').trim();
    return {
      description,
      product,
      label: String(it.label ?? '').trim(),
      size: String(it.size ?? '').trim(),
      price: toInt(it.price),
      qty: toInt(it.qty) || 1,
      total: toInt(it.total),
      box: toBox(it.box_2d, [0, 0, 0, 0]),
      category: categoryOf(`${product} ${description}`)
    };
  });
  return {
    invoice: String(raw.invoice ?? '').trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : '',
    paper: toBox(raw.paper_box_2d, [0, 0, 1000, 1000]),
    items,
    totalQty: toInt(raw.total_qty),
    grandTotal: toInt(raw.grand_total)
  };
}
