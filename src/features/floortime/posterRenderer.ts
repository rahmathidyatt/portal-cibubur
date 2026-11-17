import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import dejaVuRegular from '../../assets/fonts/DejaVuSans.ttf';
import dejaVuBold from '../../assets/fonts/DejaVuSans-Bold.ttf';
import {
  agentUnit,
  DAY_NAMES_ID,
  displayName,
  formatDateId,
  monthLabel,
  sortAgentsForRoster,
  weekdayOf,
  weekRangeLabel,
  type Agent,
  type RosterSort,
  type ScheduleData,
  type ScheduleWeek
} from './engine';

/**
 * Renderer poster Floor Time di browser (Canvas 2D), mengikuti desain versi Python:
 * logo Brighton dengan "o" emas, kartu per hari, Sabtu berlatar kuning lembut, hari libur
 * beraksen merah, nama agen 24px tebal satu baris, tinggi poster mengikuti isi.
 * Font DejaVu Sans dibundel agar hasil sama di semua perangkat.
 */

const FONT = 'PosterDejaVu';
const SCALE = 2;
const YELLOW = '#FFD10A';
const GOLD = '#F6A900';
const GOLD_SOFT = '#FFF8E5';
const SATURDAY_BG = '#FFF7D6';
const HOLIDAY_BG = '#FFF7F6';
const HOLIDAY_BORDER = '#EF9A94';
const BORDER = '#E4E8EE';
const DIVIDER = '#DCE2EA';
const BLACK = '#111111';

let fontsReady: Promise<void> | null = null;

export function loadPosterFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const faces = [
        new FontFace(FONT, `url(${dejaVuRegular})`, { weight: '400' }),
        new FontFace(FONT, `url(${dejaVuBold})`, { weight: '700' })
      ];
      for (const face of faces) {
        await face.load();
        document.fonts.add(face);
      }
    })().catch((err) => {
      fontsReady = null;
      throw new Error(`Font poster gagal dimuat: ${err instanceof Error ? err.message : err}`);
    });
  }
  return fontsReady;
}

function font(size: number, bold = false): string {
  return `${bold ? '700' : '400'} ${size}px ${FONT}`;
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * SCALE);
  canvas.height = Math.ceil(height * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung Canvas.');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

/** Lebar teks dengan jarak antar huruf manual (letterSpacing belum didukung semua browser). */
function measureSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  return ctx.measureText(text).width + Math.max(0, text.length - 1) * spacing;
}

function drawSpacedCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  let x = cx - measureSpaced(ctx, text, spacing) / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

function drawCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  ctx.fillText(text, cx - ctx.measureText(text).width / 2, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
  shadow = false
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (shadow) {
    ctx.shadowColor = 'rgba(17,17,17,0.08)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  if (stroke) {
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Logo "Brighton" dengan huruf o emas, lalu nama hub. Mengembalikan posisi y berikutnya. */
function drawBrandHeader(ctx: CanvasRenderingContext2D, width: number, hubName: string, top: number): number {
  ctx.font = font(58, true);
  const parts: [string, string][] = [['Bright', BLACK], ['o', GOLD], ['n', BLACK]];
  const total = parts.reduce((w, [t]) => w + ctx.measureText(t).width, 0);
  let x = width / 2 - total / 2;
  const baseline = top + 58;
  for (const [t, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillText(t, x, baseline);
    x += ctx.measureText(t).width;
  }
  ctx.fillStyle = BLACK;
  ctx.font = font(16, true);
  drawSpacedCentered(ctx, hubName.toUpperCase(), width / 2, baseline + 36, 2);
  return baseline + 36;
}

function drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.55);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + r * 0.45, cy + r * 0.2);
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Poster mingguan                                                     */
/* ------------------------------------------------------------------ */

const PAD_X = 38;
const META_W = 245;
const AGENT_FONT = 24;
const AGENT_STEP = 34;
const CARD_GAP = 12;

export function renderWeekPoster(data: ScheduleData, week: ScheduleWeek): HTMLCanvasElement {
  // Ukur dulu: lebar kolom shift mengikuti nama terpanjang agar tetap satu baris.
  const probe = makeCanvas(10, 10).ctx;
  probe.font = font(AGENT_FONT, true);
  const weekSlots = data.slots.filter((s) => s.weekNo === week.weekNo);
  let longest = 0;
  for (const s of weekSlots) {
    for (const e of data.assignments[s.key] ?? []) {
      longest = Math.max(longest, probe.measureText(e.displayName).width);
    }
  }
  const colW = Math.max(360, Math.ceil(longest) + 28 * 2 + 25);
  const width = PAD_X * 2 + META_W + colW * 2;

  const notes = data.notes;
  probe.font = font(16);
  const noteLines = notes.length;
  const notesH = noteLines > 0 ? 40 + noteLines * 26 : 0;

  const days = week.dates.filter((d) => weekdayOf(d) <= 5);
  const cardHeights = days.map((d) => {
    if (data.holidays[d] !== undefined) return 120;
    const counts = weekSlots.filter((s) => s.date === d).map((s) => Math.max(1, (data.assignments[s.key] ?? []).length));
    const rows = Math.max(1, ...counts);
    return Math.max(156, 21 * 2 + 44 + rows * AGENT_STEP);
  });

  const headerH = 230;
  const height =
    headerH + cardHeights.reduce((a, b) => a + b + CARD_GAP, 0) + (notesH ? notesH + 16 : 0) + 30;

  const { canvas, ctx } = makeCanvas(width, height);
  let y = drawBrandHeader(ctx, width, data.hubName, 20);
  ctx.fillStyle = BLACK;
  ctx.font = font(40, true);
  drawCentered(ctx, 'FLOOR TIME SCHEDULE', width / 2, y + 62);
  ctx.font = font(20, true);
  drawCentered(ctx, weekRangeLabel(week.dates), width / 2, y + 92);
  y = headerH;

  days.forEach((date, i) => {
    const h = cardHeights[i];
    const x = PAD_X;
    const w = width - PAD_X * 2;
    const weekday = weekdayOf(date);
    const holiday = data.holidays[date];

    if (holiday !== undefined) {
      roundRect(ctx, x, y, w, h, 14, HOLIDAY_BG, HOLIDAY_BORDER, true);
      const metaW = Math.round(w * 0.25);
      ctx.strokeStyle = HOLIDAY_BORDER;
      ctx.beginPath();
      ctx.moveTo(x + metaW, y + 1);
      ctx.lineTo(x + metaW, y + h - 1);
      ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.font = font(32, true);
      ctx.fillText(DAY_NAMES_ID[weekday], x + 30, y + h / 2 - 2);
      ctx.font = font(20);
      ctx.fillText(formatDateId(date), x + 30, y + h / 2 + 28);
      ctx.font = font(20, true);
      ctx.fillText(holiday, x + metaW + 38, y + h / 2 + 8);
      y += h + CARD_GAP;
      return;
    }

    const saturday = weekday === 5;
    roundRect(ctx, x, y, w, h, 14, saturday ? SATURDAY_BG : '#FFFFFF', saturday ? '#F0D77A' : BORDER, true);
    ctx.strokeStyle = DIVIDER;
    ctx.lineWidth = 1;
    for (const lineX of [x + META_W, x + META_W + colW]) {
      ctx.beginPath();
      ctx.moveTo(lineX, y + 16);
      ctx.lineTo(lineX, y + h - 16);
      ctx.stroke();
    }
    ctx.fillStyle = BLACK;
    ctx.font = font(32, true);
    ctx.fillText(DAY_NAMES_ID[weekday], x + 30, y + 27 + 32);
    ctx.font = font(20);
    ctx.fillText(formatDateId(date), x + 30, y + 27 + 32 + 34);

    const daySlots = weekSlots.filter((s) => s.date === date).sort((a, b) => a.shiftIndex - b.shiftIndex);
    daySlots.forEach((slot, col) => {
      const sx = x + META_W + col * colW + 28;
      const bandY = y + 21;
      const grad = ctx.createLinearGradient(sx, 0, sx + colW - 56, 0);
      grad.addColorStop(0, GOLD_SOFT);
      grad.addColorStop(1, 'rgba(255,248,229,0)');
      roundRect(ctx, sx, bandY, colW - 56, 36, 7, grad);
      drawClock(ctx, sx + 20, bandY + 18, 11);
      ctx.fillStyle = BLACK;
      ctx.font = font(24, true);
      ctx.fillText(slot.timeLabel, sx + 42, bandY + 27);

      const entries = data.assignments[slot.key] ?? [];
      let ly = bandY + 36 + 10 + AGENT_FONT;
      ctx.font = font(AGENT_FONT, true);
      if (entries.length === 0) {
        ctx.fillStyle = '#515151';
        ctx.fillText('Slot Belum Terisi', sx + 25, ly);
      }
      for (const e of entries) {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(sx + 9, ly - 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BLACK;
        ctx.fillText(e.displayName, sx + 25, ly);
        ly += AGENT_STEP;
      }
    });
    y += h + CARD_GAP;
  });

  if (notesH) {
    y += 4;
    const w = width - PAD_X * 2;
    roundRect(ctx, PAD_X, y, w, notesH, 14, '#FFFFFF', BORDER, true);
    ctx.fillStyle = BLACK;
    ctx.font = font(21, true);
    ctx.fillText('CATATAN', PAD_X + 26, y + 34);
    ctx.fillStyle = GOLD;
    ctx.fillRect(PAD_X + 26 + 150, y + 14, 3, notesH - 28);
    ctx.font = font(16);
    notes.forEach((note, i) => {
      const ny = y + 32 + i * 26;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(PAD_X + 200, ny - 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BLACK;
      ctx.fillText(note, PAD_X + 212, ny);
    });
  }
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Daftar agen bulanan                                                 */
/* ------------------------------------------------------------------ */

export const ROSTER_COLUMNS = ['Nama', 'Jabatan', 'Unit', 'Total Kehadiran'] as const;
export type RosterColumn = (typeof ROSTER_COLUMNS)[number];
export const ROSTER_PAGE_SIZE = 20;

function rosterValue(agent: Agent, column: RosterColumn): string {
  if (column === 'Nama') return displayName(agent);
  if (column === 'Jabatan') return agent.jobTitle || '-';
  if (column === 'Unit') return agentUnit(agent) || '-';
  return String(agent.attendance);
}

const COLUMN_WEIGHT: Record<RosterColumn, number> = { Nama: 2.3, Jabatan: 1.6, Unit: 1.1, 'Total Kehadiran': 1.2 };

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function renderRosterPages(
  agents: Agent[],
  year: number,
  month: number,
  columns: RosterColumn[],
  sort: RosterSort,
  hubName: string
): HTMLCanvasElement[] {
  const cols = ROSTER_COLUMNS.filter((c) => columns.includes(c));
  if (cols.length === 0) return [];
  const sorted = sortAgentsForRoster(agents, sort);
  const pages: Agent[][] = [];
  for (let i = 0; i < sorted.length; i += ROSTER_PAGE_SIZE) pages.push(sorted.slice(i, i + ROSTER_PAGE_SIZE));
  if (pages.length === 0) pages.push([]);

  const width = 1080;
  const tableX = 50;
  const tableW = width - tableX * 2;
  const totalWeight = cols.reduce((s, c) => s + COLUMN_WEIGHT[c], 0);
  const colWidths = cols.map((c) => (COLUMN_WEIGHT[c] / totalWeight) * tableW);
  const probe = makeCanvas(10, 10).ctx;
  probe.font = font(23);

  return pages.map((pageAgents, pageIndex) => {
    const rowHeights = pageAgents.map((a) =>
      Math.max(
        68,
        ...cols.map((c, i) => wrapText(probe, rosterValue(a, c), colWidths[i] - 36).length * 32 + 36)
      )
    );
    const headerTop = 245;
    const height = headerTop + 56 + rowHeights.reduce((a, b) => a + b, 0) + 90;
    const { canvas, ctx } = makeCanvas(width, height);

    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(90, 0);
    ctx.lineTo(28, 92);
    ctx.lineTo(0, 92);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width - 90, 0);
    ctx.lineTo(width - 28, 92);
    ctx.lineTo(width, 92);
    ctx.fill();

    const y0 = drawBrandHeader(ctx, width, hubName, 14);
    ctx.fillStyle = BLACK;
    ctx.font = font(36, true);
    drawCentered(ctx, 'DAFTAR AGEN FLOOR TIME', width / 2, y0 + 54);
    ctx.font = font(20, true);
    drawCentered(ctx, monthLabel(year, month).toUpperCase(), width / 2, y0 + 84);

    // Header tabel
    let y = headerTop;
    ctx.fillStyle = GOLD;
    ctx.fillRect(tableX, y - 4, tableW, 4);
    ctx.fillStyle = GOLD_SOFT;
    ctx.fillRect(tableX, y, tableW, 56);
    ctx.fillStyle = BLACK;
    ctx.font = font(20, true);
    let x = tableX;
    cols.forEach((c, i) => {
      if (c === 'Total Kehadiran') ctx.fillText(c, x + colWidths[i] - 18 - ctx.measureText(c).width, y + 36);
      else ctx.fillText(c, x + 18, y + 36);
      x += colWidths[i];
    });
    y += 56;

    ctx.font = font(23);
    pageAgents.forEach((agent, r) => {
      const h = rowHeights[r];
      ctx.fillStyle = r % 2 ? '#F3F3F3' : '#FFFFFF';
      ctx.fillRect(tableX, y, tableW, h);
      ctx.strokeStyle = '#E6E6E6';
      ctx.strokeRect(tableX + 0.5, y + 0.5, tableW - 1, h);
      let cx = tableX;
      cols.forEach((c, i) => {
        const lines = wrapText(ctx, rosterValue(agent, c), colWidths[i] - 36);
        ctx.fillStyle = BLACK;
        lines.forEach((line, li) => {
          const ty = y + 42 + li * 32;
          if (c === 'Total Kehadiran') ctx.fillText(line, cx + colWidths[i] - 18 - ctx.measureText(line).width, ty);
          else ctx.fillText(line, cx + 18, ty);
        });
        cx += colWidths[i];
      });
      y += h;
    });

    ctx.strokeStyle = '#E6E6E6';
    ctx.beginPath();
    ctx.moveTo(tableX, y + 22);
    ctx.lineTo(tableX + tableW, y + 22);
    ctx.stroke();
    ctx.fillStyle = BLACK;
    ctx.font = font(18, true);
    drawCentered(ctx, `${sorted.length} AGEN • HALAMAN ${pageIndex + 1}/${pages.length}`, width / 2, y + 58);
    return canvas;
  });
}

/* ------------------------------------------------------------------ */
/* Ekspor                                                              */
/* ------------------------------------------------------------------ */

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Gagal membuat gambar.'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

/** PDF multi-halaman: tiap gambar satu halaman selebar A4 (595 pt), tinggi mengikuti gambar. */
export async function buildPdfFromPngs(pngs: Uint8Array[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const png of pngs) {
    const image = await pdf.embedPng(png);
    const pageW = 595;
    const pageH = (image.height / image.width) * pageW;
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
  }
  return pdf.save();
}

export async function buildZip(files: { name: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return zip.generateAsync({ type: 'uint8array' });
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
