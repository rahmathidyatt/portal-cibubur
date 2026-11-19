import { PDFDocument } from 'pdf-lib';
import carlitoRegular from '../../assets/fonts/Carlito-Regular.ttf';
import carlitoBold from '../../assets/fonts/Carlito-Bold.ttf';
import {
  BRIGHT_DAY_LOCATION,
  CHECKLIST,
  formatCost,
  formatCount,
  formatEventDate,
  formatEventTime,
  type BrightDayReport,
  type Line
} from './brightDay';

/** Halaman A4 dalam point (1/72 inci), sama dengan contoh laporan. */
const PAGE_W = 595.92;
const PAGE_H = 842.88;

const SANS = 'BrightDayCarlito';
const FS = 8; // ukuran huruf isi tabel (pt)
const LH = 9.35; // tinggi baris teks (pt)
const PAD = 3;

const X0 = 81.8;
const COL = { no: 16.4, keg: 270.3, status: 26.8, ket: 117.1 };
const X_KEG = X0 + COL.no;
const X_STATUS = X_KEG + COL.keg;
const X_KET = X_STATUS + COL.status;
const X1 = X_KET + COL.ket;

const CREAM = '#FFF2CC';
const HEAD_BLUE = '#C9DAF8';
const RED = '#FF0000';

let fontsReady: Promise<void> | null = null;

export function loadBrightDayFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const faces = [
        new FontFace(SANS, `url(${carlitoRegular})`, { weight: '400' }),
        new FontFace(SANS, `url(${carlitoBold})`, { weight: '700' })
      ];
      for (const f of faces) document.fonts.add(await f.load());
    })().catch((err) => {
      fontsReady = null;
      throw err;
    });
  }
  return fontsReady;
}

function setFont(ctx: CanvasRenderingContext2D, bold = false, size = FS) {
  ctx.font = `${bold ? '700' : '400'} ${size}px ${SANS}`;
}

/** Pecah baris berisi beberapa potongan (tebal/merah) agar muat di lebar tertentu. */
function wrapRuns(ctx: CanvasRenderingContext2D, line: Line, width: number): Line[] {
  const out: Line[] = [];
  let cur: Line = [];
  let curW = 0;
  for (const run of line) {
    setFont(ctx, run.bold);
    const words = run.t.split(/(\s+)/).filter((w) => w !== '');
    for (const word of words) {
      const w = ctx.measureText(word).width;
      if (curW + w > width && curW > 0 && word.trim() !== '') {
        out.push(cur);
        cur = [];
        curW = 0;
      }
      if (curW === 0 && word.trim() === '') continue;
      const last = cur[cur.length - 1];
      if (last && last.bold === run.bold && last.red === run.red) last.t += word;
      else cur.push({ ...run, t: word });
      curW += w;
    }
  }
  if (cur.length) out.push(cur);
  return out.length ? out : [[{ t: '' }]];
}

function drawRuns(ctx: CanvasRenderingContext2D, line: Line, x: number, y: number) {
  let cx = x;
  for (const run of line) {
    setFont(ctx, run.bold);
    ctx.fillStyle = run.red ? RED : '#000000';
    ctx.fillText(run.t, cx, y);
    cx += ctx.measureText(run.t).width;
  }
}

function wrapPlain(ctx: CanvasRenderingContext2D, text: string, width: number, bold = false): string[] {
  return wrapRuns(ctx, [{ t: text, bold }], width).map((l) => l.map((r) => r.t).join(''));
}

function cell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill?: string) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, w, h);
}

function checkbox(ctx: CanvasRenderingContext2D, cx: number, cy: number, checked: boolean) {
  const s = 8.4;
  const x = cx - s / 2;
  const y = cy - s / 2;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, s, s);
  if (!checked) return;
  ctx.lineWidth = 0.95;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 1.6, y + 4.3);
  ctx.lineTo(x + 3.9, y + 7.4);
  ctx.lineTo(x + 9.6, y - 1.6);
  ctx.stroke();
}

/** Gambar halaman 1 (checklist + format laporan) ke kanvas. scale = piksel per point. */
export function drawChecklistPage(report: BrightDayReport, scale = 3): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = 'alphabetic';

  const textY = (top: number, h: number, lines = 1) => top + (h - lines * LH) / 2 + LH * 0.74;
  const W = X1 - X0;
  let y = 65;

  // Judul
  const titleH = 14.4;
  cell(ctx, X0, y, W, titleH, CREAM);
  setFont(ctx, true, 9.2);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.fillText('CHECKLIST BRIGHT DAY ONSITE', X0 + W / 2, textY(y, titleH));
  ctx.textAlign = 'left';
  y += titleH;

  // Identitas acara
  const info = [
    `Lokasi: ${BRIGHT_DAY_LOCATION}`,
    `Host: ${report.host.trim()}`,
    `Narasumber: ${report.speaker.trim()}`,
    `Tanggal Acara: ${formatEventDate(report.eventDate)}`,
    `Waktu Acara: ${formatEventTime(report.eventTime)}`,
    `Admin In Charge: ${report.adminInCharge.trim()}`
  ];
  const infoH = 15.2;
  for (const t of info) {
    cell(ctx, X0, y, W, infoH);
    setFont(ctx, true, 8);
    ctx.fillStyle = '#000';
    ctx.fillText(t, X0 + 2.5, textY(y, infoH));
    y += infoH;
  }

  // Kepala tabel
  const headH = 11;
  const heads: [string, number, number][] = [
    ['No', X0, COL.no],
    ['Kegiatan', X_KEG, COL.keg],
    ['Status', X_STATUS, COL.status],
    ['Keterangan', X_KET, COL.ket]
  ];
  ctx.textAlign = 'center';
  for (const [label, x, w] of heads) {
    cell(ctx, x, y, w, headH, HEAD_BLUE);
    setFont(ctx, true);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + w / 2, textY(y, headH));
  }
  ctx.textAlign = 'left';
  y += headH;

  // Baris checklist
  for (const row of CHECKLIST) {
    if (row.kind === 'section') {
      const h = 10.8;
      cell(ctx, X0, y, COL.no, h);
      cell(ctx, X_KEG, y, COL.keg, h, row.color);
      cell(ctx, X_STATUS, y, COL.status, h);
      cell(ctx, X_KET, y, COL.ket, h);
      drawRuns(ctx, [{ t: row.label, bold: true }], X_KEG + 2, textY(y, h));
      y += h;
      continue;
    }
    const lines = row.lines.flatMap((l) => wrapRuns(ctx, l, COL.keg - 5));
    const note = row.kind === 'item' ? (report.notes[row.id] ?? '').trim() : '';
    setFont(ctx, false, 7);
    const noteLines = note ? wrapPlain(ctx, note, COL.ket - 5) : [];
    const h = Math.max(lines.length, noteLines.length) * LH + PAD;
    cell(ctx, X0, y, COL.no, h);
    cell(ctx, X_KEG, y, COL.keg, h);
    cell(ctx, X_STATUS, y, COL.status, h);
    cell(ctx, X_KET, y, COL.ket, h);
    if (row.no) {
      setFont(ctx, false);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.fillText(row.no, X0 + COL.no / 2, textY(y, h));
      ctx.textAlign = 'left';
    }
    lines.forEach((l, i) => drawRuns(ctx, l, X_KEG + 2, y + PAD / 2 + LH * 0.76 + i * LH));
    if (row.kind === 'item') {
      checkbox(ctx, X_STATUS + COL.status / 2, y + h / 2, !!report.checks[row.id]);
      setFont(ctx, false, 7);
      ctx.fillStyle = '#000';
      noteLines.forEach((t, i) => ctx.fillText(t, X_KET + 2.5, y + PAD / 2 + LH * 0.76 + i * LH));
    }
    y += h;
  }

  // Format laporan after event
  y += 10;
  const RX_LABEL = X0 + COL.no;
  const RX_VALUE = X_STATUS;
  const RW_VALUE = X1 - RX_VALUE;
  cell(ctx, X0, y, W, 15.5, CREAM);
  setFont(ctx, true, 9.2);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.fillText('FORMAT LAPORAN AFTER EVENT', X0 + W / 2, textY(y, 15.5));
  y += 15.5;

  const rows: [string, string][] = [
    ['Peserta Daftar Acara', formatCount(report.registered)],
    ['Peserta Hadir', formatCount(report.attended)],
    ['PA Yang Membawa Tamu', formatCount(report.paWithGuests)],
    ['Peserta Closing di Tempat', formatCount(report.closing)],
    ['Biaya Acara', formatCost(report.cost)]
  ];
  const rowH = 21.2;
  rows.forEach(([label, value], i) => {
    cell(ctx, X0, y, COL.no, rowH);
    cell(ctx, RX_LABEL, y, RX_VALUE - RX_LABEL, rowH);
    cell(ctx, RX_VALUE, y, RW_VALUE, rowH);
    setFont(ctx, false);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), X0 + COL.no / 2, textY(y, rowH));
    ctx.fillText(value, RX_VALUE + RW_VALUE / 2, textY(y, rowH));
    ctx.textAlign = 'left';
    ctx.fillText(label, RX_LABEL + 2.5, textY(y, rowH));
    y += rowH;
  });

  // Evaluasi
  const prefix = 'Evaluasi & Catatan Lainnya: ';
  setFont(ctx, false);
  const prefixW = ctx.measureText(prefix).width;
  const evalText = report.evaluation.trim() || '-';
  const evalLines = evalText
    .split(/\r?\n/)
    .flatMap((l) => wrapPlain(ctx, l.trim(), X1 - RX_LABEL - prefixW - 6))
    .filter((l, i, arr) => l !== '' || i < arr.length - 1);
  const evalH = Math.max(36, evalLines.length * LH + 9);
  cell(ctx, X0, y, COL.no, evalH);
  cell(ctx, RX_LABEL, y, X1 - RX_LABEL, evalH);
  const ey = y + 4 + LH * 0.74;
  ctx.textAlign = 'center';
  ctx.fillText('6', X0 + COL.no / 2, ey);
  ctx.textAlign = 'left';
  ctx.fillText(prefix, RX_LABEL + 2.5, ey);
  evalLines.forEach((t, i) => ctx.fillText(t, RX_LABEL + 2.5 + prefixW, ey + i * LH));
  y += evalH;

  // Bingkai luar
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(70.7, 53.7, 454.2, y + 9 - 53.7);

  return canvas;
}

function canvasBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject) : reject(new Error('Gagal membuat gambar.'))),
      'image/png'
    )
  );
}

export function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** PDF lengkap: halaman checklist, lalu satu foto per halaman (urutan sesuai daftar). */
export async function buildBrightDayPdf(report: BrightDayReport, photoDataUrls: string[]): Promise<Uint8Array> {
  await loadBrightDayFonts();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Checklist Bright Day Onsite - ${formatEventDate(report.eventDate)}`);
  pdf.setAuthor(BRIGHT_DAY_LOCATION);

  const first = await pdf.embedPng(await canvasBytes(drawChecklistPage(report, 3)));
  pdf.addPage([PAGE_W, PAGE_H]).drawImage(first, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const M = 28;
  for (const url of photoDataUrls) {
    const bytes = dataUrlBytes(url);
    const img = url.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const scale = Math.min((PAGE_W - 2 * M) / img.width, (PAGE_H - 2 * M) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    pdf.addPage([PAGE_W, PAGE_H]).drawImage(img, { x: (PAGE_W - w) / 2, y: PAGE_H - M - h, width: w, height: h });
  }
  return pdf.save();
}

/** Kompres foto (orientasi dari kamera ikut dibetulkan) menjadi JPEG maks. 1600 px. */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Foto "${file.name}" tidak dapat dibaca. Gunakan format JPG atau PNG.`);
  }
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * s);
  canvas.height = Math.round(bitmap.height * s);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
