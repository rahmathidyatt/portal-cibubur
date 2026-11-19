import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { ATTENDANCE_SHEETS, ATTENDANCE_TITLE, PAGE, attendanceDateLine, type AttendanceKind, type AttendanceSheet } from './attendance';

type Style = 'regular' | 'bold' | 'boldItalic';

/** Alat gambar sederhana agar pratinjau (kanvas) dan PDF memakai tata letak yang sama. */
interface Painter {
  fill(x: number, y: number, w: number, h: number, color: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  text(s: string, cx: number, baseline: number, size: number, style: Style): void;
}

function draw(p: Painter, sheet: AttendanceSheet, dateIso: string) {
  const left = sheet.cols[0];
  const right = sheet.cols[sheet.cols.length - 1];
  const bottom = sheet.headBottom + sheet.rows * sheet.rowHeight;
  const mid = (left + right) / 2;

  p.fill(left, sheet.titleTop, right - left, sheet.titleBottom - sheet.titleTop, sheet.color);
  p.fill(left, sheet.headTop, right - left, sheet.headBottom - sheet.headTop, sheet.color);

  p.text(ATTENDANCE_TITLE, mid, sheet.titleBaselines[0], sheet.titleSize, 'bold');
  p.text(attendanceDateLine(dateIso), mid, sheet.titleBaselines[1], sheet.titleSize, 'bold');

  // Garis horizontal
  const ys = [sheet.titleTop, sheet.titleBottom, sheet.headTop, sheet.headBottom];
  for (let i = 1; i <= sheet.rows; i++) ys.push(sheet.headBottom + i * sheet.rowHeight);
  for (const y of ys) p.line(left, y, right, y);
  // Garis vertikal: tepi luar penuh, pemisah kolom mulai dari kepala tabel
  p.line(left, sheet.titleTop, left, bottom);
  p.line(right, sheet.titleTop, right, bottom);
  for (const x of sheet.cols.slice(1, -1)) p.line(x, sheet.headTop, x, bottom);

  const headBase = (sheet.headTop + sheet.headBottom) / 2 + sheet.textSize * 0.35;
  sheet.headers.forEach((h, i) => p.text(h, (sheet.cols[i] + sheet.cols[i + 1]) / 2, headBase, sheet.textSize, 'boldItalic'));
  const noMid = (sheet.cols[0] + sheet.cols[1]) / 2;
  for (let i = 0; i < sheet.rows; i++) {
    const top = sheet.headBottom + i * sheet.rowHeight;
    p.text(String(i + 1), noMid, top + sheet.rowHeight / 2 + sheet.textSize * 0.35, sheet.textSize, 'regular');
  }
}

function hex(color: string) {
  const n = parseInt(color.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function pdfPainter(page: PDFPage, fonts: Record<Style, PDFFont>): Painter {
  const H = PAGE.h;
  return {
    fill: (x, y, w, h, color) => page.drawRectangle({ x, y: H - y - h, width: w, height: h, color: hex(color) }),
    line: (x1, y1, x2, y2) =>
      page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness: 0.75, color: rgb(0, 0, 0) }),
    text: (s, cx, baseline, size, style) => {
      const font = fonts[style];
      page.drawText(s, { x: cx - font.widthOfTextAtSize(s, size) / 2, y: H - baseline, size, font, color: rgb(0, 0, 0) });
    }
  };
}

const CANVAS_FONT = 'Arial, Helvetica, "Liberation Sans", sans-serif';

function canvasPainter(ctx: CanvasRenderingContext2D, scale: number): Painter {
  // Garis 1 piksel tepat di kisi piksel agar tebalnya seragam di pratinjau.
  const snap = (v: number) => (Math.round(v * scale) + 0.5) / scale;
  return {
    fill: (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
    line: (x1, y1, x2, y2) => {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(snap(x1), snap(y1));
      ctx.lineTo(snap(x2), snap(y2));
      ctx.stroke();
    },
    text: (s, cx, baseline, size, style) => {
      ctx.font = `${style === 'boldItalic' ? 'italic ' : ''}${style === 'regular' ? 400 : 700} ${size}px ${CANVAS_FONT}`;
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.fillText(s, cx, baseline);
    }
  };
}

/** Pratinjau lembar daftar hadir sebagai gambar (data URL). */
export function attendancePreview(kind: AttendanceKind, dateIso: string, scale = 2): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE.w * scale);
  canvas.height = Math.round(PAGE.h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PAGE.w, PAGE.h);
  draw(canvasPainter(ctx, scale), ATTENDANCE_SHEETS[kind], dateIso);
  return canvas.toDataURL('image/png');
}

/** PDF A4 satu halaman, teks & garis vektor (tajam saat dicetak). */
export async function buildAttendancePdf(kind: AttendanceKind, dateIso: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Daftar Hadir ${kind === 'tamu' ? 'Tamu' : 'PA'} Bright Day ${attendanceDateLine(dateIso)}`);
  const fonts: Record<Style, PDFFont> = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  };
  const page = pdf.addPage([PAGE.w, PAGE.h]);
  draw(pdfPainter(page, fonts), ATTENDANCE_SHEETS[kind], dateIso);
  return pdf.save();
}
