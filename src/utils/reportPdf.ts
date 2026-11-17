import { PDFDocument } from 'pdf-lib';
import { canvasToPng, loadPosterFonts } from '../features/floortime/posterRenderer';
import { moneyText, type ReportCell, type ReportDoc, type ReportTable } from './report';

/**
 * PDF laporan: tabel digambar di kanvas A4 landscape (font DejaVu yang sama
 * dengan poster) lalu digabung menjadi PDF.
 */
const W = 1754; // A4 landscape @150dpi
const H = 1240;
const M = 64;
const FONT = 'PosterDejaVu';
const ROW = 34;
const HEAD = 44;

function font(ctx: CanvasRenderingContext2D, size: number, bold = false) {
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1);
  return `${s}…`;
}

function cellText(cell: ReportCell): string {
  if (typeof cell.text === 'number') return cell.money ? moneyText(cell.text) : String(cell.text);
  return cell.text;
}

export async function renderReportPdf(doc: ReportDoc): Promise<Uint8Array> {
  await loadPosterFonts();
  const pages: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  const pageNo = () => pages.length;

  const newPage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    pages.push(canvas);
    // Kepala halaman
    font(ctx, 30, true);
    let x = M;
    for (const [t, col] of [['Bright', '#111'], ['o', '#f5a400'], ['n', '#111']] as const) {
      ctx.fillStyle = col;
      ctx.fillText(t, x, M + 18);
      x += ctx.measureText(t).width;
    }
    font(ctx, 13, true);
    ctx.fillStyle = '#555';
    ctx.fillText('HUB CIBUBUR', M, M + 40);
    font(ctx, 26, true);
    ctx.fillStyle = '#111';
    const tw = ctx.measureText(doc.title).width;
    ctx.fillText(doc.title, W - M - tw, M + 18);
    if (doc.subtitle) {
      font(ctx, 15);
      ctx.fillStyle = '#555';
      const sw = ctx.measureText(doc.subtitle).width;
      ctx.fillText(doc.subtitle, W - M - sw, M + 42);
    }
    ctx.fillStyle = '#f5a400';
    ctx.fillRect(M, M + 56, W - 2 * M, 4);
    y = M + 90;
  };

  const ensure = (h: number) => {
    if (y + h > H - M - 30) newPage();
  };

  const drawRow = (t: ReportTable, cells: ReportCell[], widths: number[], header = false, footer = false) => {
    const h = header ? HEAD : ROW;
    let x = M;
    cells.forEach((cell, i) => {
      const w = widths[i];
      const fill = cell.fill ?? (header ? (t.columns[i]?.fill ?? 'FFF7D6') : undefined);
      if (fill) {
        ctx.fillStyle = `#${fill}`;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = '#c8c8c8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      font(ctx, header ? 14 : 15, header || footer || !!cell.bold);
      ctx.fillStyle = cell.color ? `#${cell.color}` : '#111';
      const text = fitText(ctx, cellText(cell), w - 12);
      const align = cell.align ?? (header ? 'center' : t.columns[i]?.align ?? 'left');
      const tw = ctx.measureText(text).width;
      const tx = align === 'right' ? x + w - 6 - tw : align === 'center' ? x + (w - tw) / 2 : x + 6;
      ctx.fillText(text, tx, y + h / 2 + 5);
      x += w;
    });
    y += h;
  };

  newPage();
  for (const t of doc.tables) {
    const total = t.columns.reduce((s, col) => s + col.width, 0);
    const widths = t.columns.map((col) => (col.width / total) * (W - 2 * M));
    ensure((t.title ? 36 : 0) + HEAD + ROW * 2);
    if (t.title) {
      font(ctx, 20, true);
      ctx.fillStyle = '#111';
      ctx.fillText(t.title, M, y + 18);
      if (t.subtitle) {
        font(ctx, 14);
        ctx.fillStyle = '#555';
        ctx.fillText(t.subtitle, M + ctx.measureText(t.title).width + 220, y + 18);
      }
      y += 32;
    }
    const header = t.columns.map((col) => ({ text: col.label }));
    drawRow(t, header, widths, true);
    for (const row of t.rows) {
      if (y + ROW > H - M - 30) {
        newPage();
        drawRow(t, header, widths, true);
      }
      drawRow(t, row, widths);
    }
    if (t.footer) {
      ensure(ROW);
      drawRow(t, t.footer, widths, false, true);
    }
    y += 28;
  }
  for (const n of doc.notes ?? []) {
    ensure(24);
    font(ctx, 14);
    ctx.fillStyle = '#444';
    ctx.fillText(n, M, y + 14);
    y += 24;
  }
  // Nomor halaman
  const totalPages = pageNo();
  pages.forEach((p, i) => {
    const g = p.getContext('2d')!;
    font(g, 13);
    g.fillStyle = '#777';
    const label = `Halaman ${i + 1}/${totalPages}`;
    g.fillText(label, W - M - g.measureText(label).width, H - M + 20);
  });
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  for (const p of pages) {
    const image = await pdf.embedPng(await canvasToPng(p));
    const page = pdf.addPage([842, 595]); // A4 landscape
    page.drawImage(image, { x: 0, y: 0, width: 842, height: 595 });
  }
  return pdf.save();
}
