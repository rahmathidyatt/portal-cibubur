import { PDFDocument } from 'pdf-lib';
import { loadPosterFonts } from '../floortime/posterRenderer';
import {
  formatDateDisplay,
  formatNumberId,
  formatRupiah,
  MAX_TEMPLATE_ROWS,
  type NotaConfig,
  type NotaJob,
  type NotaMeta,
  type NotaResult
} from './notaCalc';

/**
 * Gambar Nota Smart Messenger (Canvas 2D) dengan koordinat template yang sama
 * dengan versi Python (kanvas dasar 1400×990, dirender 2× agar tajam).
 */

const FONT = 'PosterDejaVu';
const BASE_W = 1400;
const BASE_H = 990;
const SCALE = 2;
const YELLOW = '#ffc000';
const TABLE_X = [0, 40, 440, 610, 732, 764, 872, 1004, 1209, 1400];
const Y_TOP = 264;
const HEADER_1_H = 38;
const HEADER_2_H = 78;
const HEADER_BOTTOM = Y_TOP + HEADER_1_H + HEADER_2_H;
const ROW_H = 29;
const TOTAL_H = 60;
const TOTAL_Y = HEADER_BOTTOM + MAX_TEMPLATE_ROWS * ROW_H;
const TABLE_BOTTOM = TOTAL_Y + TOTAL_H;

type Box = [number, number, number, number];
type Align = 'left' | 'center' | 'right';

function setFont(ctx: CanvasRenderingContext2D, size: number, bold = false) {
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const original of String(text ?? '').split('\n')) {
    const words = original.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
      else {
        if (current) out.push(current);
        current = word;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

function textBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  [x1, y1, x2, y2]: Box,
  size: number,
  { bold = false, align = 'center' as Align, padding = 4, lineSpacing = 1.15 } = {}
) {
  setFont(ctx, size, bold);
  const lines = wrapLines(ctx, text, Math.max(1, x2 - x1 - padding * 2));
  const lineH = size * 1.05 * lineSpacing;
  const totalH = lineH * lines.length;
  let y = y1 + (y2 - y1 - totalH) / 2 + size * 0.85;
  ctx.fillStyle = '#000';
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    const x = align === 'left' ? x1 + padding : align === 'right' ? x2 - padding - w : x1 + (x2 - x1 - w) / 2;
    ctx.fillText(line, x, y);
    y += lineH;
  }
}

function cell(
  ctx: CanvasRenderingContext2D,
  box: Box,
  text = '',
  size = 19,
  { fill = '#fff', align = 'center' as Align, padding = 4, bold = false } = {}
) {
  const [x1, y1, x2, y2] = box;
  ctx.fillStyle = fill;
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1);
  if (text) textBox(ctx, text, box, size, { align, padding, bold });
}

function splitRupiahCell(ctx: CanvasRenderingContext2D, box: Box, text: string, size = 19) {
  cell(ctx, box);
  const [x1, y1, x2, y2] = box;
  const raw = String(text || '').trim();
  const amount = raw.startsWith('Rp') ? raw.replace('Rp', '').trim() || '-' : raw || '-';
  textBox(ctx, 'Rp', [x1 + 8, y1, x1 + 42, y2], size, { align: 'left' });
  textBox(ctx, amount, [x1 + 42, y1, x2 - 8, y2], size, { align: 'right' });
}

function meta(ctx: CanvasRenderingContext2D, label: string, value: string, y: number) {
  setFont(ctx, 20);
  ctx.fillStyle = '#000';
  ctx.fillText(label, 42, y + 18);
  ctx.fillText(':', 178, y + 18);
  ctx.fillText(value, 193, y + 18);
}

function brand(ctx: CanvasRenderingContext2D) {
  let x = 825;
  const y = 58;
  setFont(ctx, 56, true);
  for (const [t, color] of [['Bright', '#000'], ['o', YELLOW], ['n', '#000']] as const) {
    ctx.fillStyle = color;
    ctx.fillText(t, x, y + 50);
    x += ctx.measureText(t).width;
  }
  const sep = x + 16;
  ctx.fillStyle = '#000';
  ctx.fillRect(sep - 2, y - 4, 4, 90);
  setFont(ctx, 30, true);
  ctx.fillText('Bringing', sep + 18, y + 30);
  ctx.fillText('Dreams Beyond', sep + 18, y + 70);
}

export async function renderNotaCanvas(
  info: NotaMeta,
  jobs: NotaJob[],
  result: NotaResult,
  config: NotaConfig
): Promise<HTMLCanvasElement> {
  await loadPosterFonts();
  const canvas = document.createElement('canvas');
  canvas.width = BASE_W * SCALE;
  canvas.height = BASE_H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung Canvas.');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  textBox(ctx, 'NOTA SMART MESSENGER', [0, 20, BASE_W, 55], 22, { bold: true });
  meta(ctx, 'Tgl Request', formatDateDisplay(info.tglRequest), 83);
  meta(ctx, 'Nama Agent', info.namaAgent, 113);
  meta(ctx, 'Kantor', info.kantor, 143);
  meta(ctx, 'Pembayaran', info.pembayaran, 173);
  setFont(ctx, 13);
  ctx.fillText('Estimasi Tanggal', 42, 203 + 12);
  ctx.fillText('Pengerjaan', 42, 225 + 12);
  setFont(ctx, 20);
  ctx.fillText(':', 178, 218 + 18);
  ctx.fillText(formatDateDisplay(info.estimasiTanggal), 193, 218 + 18);

  if (info.pembayaran.toLowerCase().includes('transfer')) {
    setFont(ctx, 17);
    ctx.fillText(`No Rekening (Jika Transfer) : ${info.rekening}`, 540, 160 + 22);
  }
  brand(ctx);

  // Tabel utama
  const x = TABLE_X;
  const hdr = { fill: YELLOW };
  cell(ctx, [x[0], Y_TOP, x[1], HEADER_BOTTOM], 'No', 20, hdr);
  cell(ctx, [x[1], Y_TOP, x[2], HEADER_BOTTOM], 'Alamat', 20, hdr);
  cell(ctx, [x[2], Y_TOP, x[3], HEADER_BOTTOM], 'Tugas', 20, hdr);
  cell(ctx, [x[3], Y_TOP, x[6], Y_TOP + HEADER_1_H], 'Rumus BBM', 20, hdr);
  cell(ctx, [x[6], Y_TOP, x[7], Y_TOP + HEADER_1_H], 'Biaya Jasa\n(Khusus Pasang)', 15, { ...hdr, padding: 2 });
  cell(
    ctx,
    [x[7], Y_TOP, x[8], HEADER_BOTTOM],
    `TOTAL\n(Tarif minimum ${formatRupiah(config.minimumBbm)}\nberlaku jika jarak akumulasi\nkurang dari ${formatNumberId(config.minimumDistanceKm)} KM)`,
    15,
    { ...hdr, padding: 3 }
  );
  cell(ctx, [x[8], Y_TOP, x[9], HEADER_BOTTOM], 'Keterangan', 20, hdr);
  cell(ctx, [x[3], Y_TOP + HEADER_1_H, x[4], HEADER_BOTTOM], `Jarak\nAkumulasi\n(Min ${formatNumberId(config.minimumDistanceKm)} KM)`, 15, { ...hdr, padding: 2 });
  cell(ctx, [x[4], Y_TOP + HEADER_1_H, x[5], HEADER_BOTTOM], 'X', 20, hdr);
  cell(ctx, [x[5], Y_TOP + HEADER_1_H, x[6], HEADER_BOTTOM], formatRupiah(config.tariffPerKm), 20, hdr);
  cell(ctx, [x[6], Y_TOP + HEADER_1_H, x[7], HEADER_BOTTOM], formatRupiah(config.serviceFeePerPoint), 20, hdr);

  for (let i = 0; i < MAX_TEMPLATE_ROWS; i++) {
    const y1 = HEADER_BOTTOM + i * ROW_H;
    const y2 = y1 + ROW_H;
    const job = jobs[i] ?? { alamat: '', tugas: '', keterangan: '' };
    cell(ctx, [x[0], y1, x[1], y2], String(i + 1));
    cell(ctx, [x[1], y1, x[2], y2], job.alamat, 19, { align: 'left', padding: 5 });
    cell(ctx, [x[2], y1, x[3], y2], job.tugas, 19, { align: 'left', padding: 5 });
    cell(ctx, [x[8], y1, x[9], y2], job.keterangan, 19, { align: 'left', padding: 5 });
  }

  const merge = result.jobCount ? Math.min(Math.max(1, result.jobCount), MAX_TEMPLATE_ROWS) : 1;
  const my2 = HEADER_BOTTOM + merge * ROW_H;
  cell(ctx, [x[3], HEADER_BOTTOM, x[4], my2], result.jobCount ? formatNumberId(result.distanceKm) : '');
  cell(ctx, [x[4], HEADER_BOTTOM, x[5], my2], 'X');
  cell(ctx, [x[5], HEADER_BOTTOM, x[6], my2], formatRupiah(config.tariffPerKm));
  cell(ctx, [x[6], HEADER_BOTTOM, x[7], my2], result.jobCount ? formatRupiah(result.serviceFee) : '');
  splitRupiahCell(ctx, [x[7], HEADER_BOTTOM, x[8], my2], result.jobCount ? formatRupiah(result.total) : 'Rp -');
  for (let i = merge; i < MAX_TEMPLATE_ROWS; i++) {
    const y1 = HEADER_BOTTOM + i * ROW_H;
    const y2 = y1 + ROW_H;
    cell(ctx, [x[3], y1, x[4], y2]);
    cell(ctx, [x[4], y1, x[5], y2], 'X');
    cell(ctx, [x[5], y1, x[6], y2], formatRupiah(config.tariffPerKm));
    cell(ctx, [x[6], y1, x[7], y2]);
    splitRupiahCell(ctx, [x[7], y1, x[8], y2], 'Rp -');
  }

  cell(ctx, [x[0], TOTAL_Y, x[7], TABLE_BOTTOM], 'TOTAL', 38, { fill: YELLOW });
  cell(ctx, [x[7], TOTAL_Y, x[8], TABLE_BOTTOM], formatRupiah(result.total), 33, { fill: YELLOW, bold: true });
  cell(ctx, [x[8], TOTAL_Y, x[9], TABLE_BOTTOM], '', 19, { fill: YELLOW });

  // Footer
  ctx.strokeStyle = '#000';
  ctx.strokeRect(0.5, TABLE_BOTTOM + 0.5, BASE_W - 1, BASE_H - TABLE_BOTTOM - 1);
  ctx.fillStyle = '#000';
  const fy = TABLE_BOTTOM + 8 + 18;
  setFont(ctx, 20);
  ctx.fillText(
    'Tarif Smart Messenger berlaku Nasional seluruh Cabang Brighton, jika mendapatkan tarif diluar ketentuan diatas silahkan hubungi',
    42,
    fy
  );
  ctx.fillText('HRD Pusat: 0812-3051-3989', 42, fy + 30);
  setFont(ctx, 20, true);
  ctx.fillText('Biaya jasa disesuaikan dengan jumlah titik pekerjaan.', 42, fy + 60);
  setFont(ctx, 20);
  ctx.fillText('Salam #MimpiJadiNyata', 42, fy + 90);
  return canvas;
}

/** PDF A4 landscape berisi gambar nota (rasio 1400:990 ≈ A4). */
export async function notaPdfFromPng(png: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([842, 595]);
  const scale = Math.min(842 / image.width, 595 / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, { x: (842 - w) / 2, y: (595 - h) / 2, width: w, height: h });
  return pdf.save();
}
