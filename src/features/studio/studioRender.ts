import { coverCrop } from './imageOps';

/** Gambar sumber yang bisa digambar ke canvas. */
export type Source = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

const sizeOf = (s: Source) =>
  s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };

export const DISPLAY = '"Plus Jakarta Sans", "Public Sans", sans-serif';
export const BODY = '"Public Sans", "Plus Jakarta Sans", sans-serif';

/** Pastikan font portal sudah termuat sebelum menggambar teks di canvas. */
export async function loadFonts(): Promise<void> {
  try {
    await Promise.all(
      ['800 40px "Plus Jakarta Sans"', '700 40px "Plus Jakarta Sans"', '400 20px "Public Sans"', '600 20px "Public Sans"'].map((f) =>
        document.fonts.load(f)
      )
    );
  } catch {
    /* font cadangan dipakai */
  }
}

export function newCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return [c, ctx];
}

/** Pecah teks menjadi baris yang muat di lebar tertentu (maks. maxLines, sisanya diberi "…"). */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Wordmark "Brighton HUB CIBUBUR" dengan huruf o kuning. */
function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dark: boolean) {
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${size}px ${DISPLAY}`;
  const parts: [string, string][] = [
    ['Bright', dark ? '#020617' : '#ffffff'],
    ['o', '#f59e0b'],
    ['n', dark ? '#020617' : '#ffffff']
  ];
  let cx = x;
  for (const [t, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillText(t, cx, y + size * 0.82);
    cx += ctx.measureText(t).width;
  }
  const word = cx - x;
  ctx.font = `700 ${Math.round(size * 0.36)}px ${DISPLAY}`;
  ctx.fillStyle = dark ? '#64748b' : 'rgba(255,255,255,0.8)';
  const sub = 'HUB CIBUBUR';
  const spacing = (word - ctx.measureText(sub).width) / (sub.length - 1);
  let sx = x;
  for (const ch of sub) {
    ctx.fillText(ch, sx, y + size * 1.32);
    sx += ctx.measureText(ch).width + Math.max(0, spacing);
  }
  return { width: word, height: size * 1.42 };
}

/* ------------------------------------------------------------------ flyer */

export type FlyerFormat = 'feed' | 'story';
export const FLYER_SIZE: Record<FlyerFormat, { w: number; h: number; label: string }> = {
  feed: { w: 1080, h: 1080, label: 'Feed IG (1:1)' },
  story: { w: 1080, h: 1920, label: 'Story (9:16)' }
};

export interface FlyerData {
  status: string;
  headline: string;
  location: string;
  price: string;
  lt: string;
  lb: string;
  kt: string;
  km: string;
  highlights: string[];
  cta: string;
  agentName: string;
  agentWa: string;
}

export function specChips(d: Pick<FlyerData, 'lt' | 'lb' | 'kt' | 'km'>): string[] {
  const out: string[] = [];
  if (d.lt.trim()) out.push(`LT ${d.lt.trim()} m²`);
  if (d.lb.trim()) out.push(`LB ${d.lb.trim()} m²`);
  if (d.kt.trim()) out.push(`${d.kt.trim()} KT`);
  if (d.km.trim()) out.push(`${d.km.trim()} KM`);
  return out;
}

/** Inisial nama untuk lingkaran agen bila tidak ada foto. */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'B'
  );
}

/**
 * Flyer listing: foto penuh dengan gradasi gelap di bawah, teks putih, harga kuning,
 * dan kartu agen di bagian paling bawah.
 */
export function renderFlyer(photo: Source, d: FlyerData, format: FlyerFormat, agentPhoto: Source | null, focusY = 0.5): HTMLCanvasElement {
  const { w: W, h: H } = FLYER_SIZE[format];
  const [canvas, ctx] = newCanvas(W, H);
  const story = format === 'story';
  const pad = 64;

  // Foto penuh
  const s = sizeOf(photo);
  const crop = coverCrop(s.w, s.h, W, H, story ? Math.min(focusY, 0.5) : focusY);
  ctx.drawImage(photo, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);

  // Gradasi atas (logo terbaca) & bawah (teks terbaca)
  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, 'rgba(2,6,23,0.55)');
  top.addColorStop(1, 'rgba(2,6,23,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 260);
  const gStart = story ? H * 0.38 : H * 0.28;
  const bottom = ctx.createLinearGradient(0, gStart, 0, H);
  bottom.addColorStop(0, 'rgba(2,6,23,0)');
  bottom.addColorStop(0.45, 'rgba(2,6,23,0.78)');
  bottom.addColorStop(1, 'rgba(2,6,23,0.96)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, gStart, W, H - gStart);

  // Logo kiri atas, label status kanan atas
  drawWordmark(ctx, pad, story ? 88 : 56, story ? 58 : 50, false);
  if (d.status.trim()) {
    ctx.font = `800 ${story ? 34 : 30}px ${DISPLAY}`;
    const label = d.status.trim().toUpperCase();
    const tw = ctx.measureText(label).width;
    const bh = story ? 68 : 60;
    const bx = W - pad - tw - 48;
    const by = story ? 90 : 58;
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, bx, by, tw + 48, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#020617';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 24, by + bh / 2 + 1);
  }

  // Blok teks disusun dari atas, lalu diletakkan tepat di atas kartu agen.
  const cardH = story ? 150 : 124;
  const cardY = H - pad - cardH + (story ? -40 : 8);
  const innerW = W - pad * 2;
  const blocks: { h: number; draw: (y: number) => void }[] = [];

  const headSize = story ? 72 : 58;
  ctx.font = `800 ${headSize}px ${DISPLAY}`;
  const headLines = wrapText(ctx, d.headline || 'Rumah siap huni', innerW, story ? 3 : 2);
  blocks.push({
    h: headLines.length * headSize * 1.12,
    draw: (y) => {
      ctx.font = `800 ${headSize}px ${DISPLAY}`;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      headLines.forEach((l, i) => ctx.fillText(l, pad, y + i * headSize * 1.12));
    }
  });

  if (d.location.trim()) {
    const ls = story ? 34 : 28;
    blocks.push({
      h: ls * 1.5,
      draw: (y) => {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pad + ls * 0.3, y + ls * 0.75, ls * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `600 ${ls}px ${BODY}`;
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        ctx.textBaseline = 'top';
        ctx.fillText(wrapText(ctx, d.location.trim(), innerW - ls, 1)[0], pad + ls * 0.85, y + ls * 0.2);
      }
    });
  }

  if (d.price.trim()) {
    const ps = story ? 80 : 64;
    blocks.push({
      h: ps * 1.25,
      draw: (y) => {
        ctx.font = `800 ${ps}px ${DISPLAY}`;
        ctx.fillStyle = '#fbbf24';
        ctx.textBaseline = 'top';
        ctx.fillText(wrapText(ctx, d.price.trim(), innerW, 1)[0], pad, y + ps * 0.12);
      }
    });
  }

  const chips = specChips(d);
  if (chips.length) {
    const cs = story ? 32 : 27;
    const chH = cs * 1.9;
    blocks.push({
      h: chH + 18,
      draw: (y) => {
        ctx.font = `700 ${cs}px ${DISPLAY}`;
        ctx.textBaseline = 'middle';
        let x = pad;
        for (const chip of chips) {
          const cw = ctx.measureText(chip).width + cs * 1.3;
          if (x + cw > W - pad) break;
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          roundRect(ctx, x, y + 6, cw, chH, 14);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(chip, x + cs * 0.65, y + 6 + chH / 2 + 1);
          x += cw + 14;
        }
      }
    });
  }

  const hs = story ? 34 : 28;
  ctx.font = `600 ${hs}px ${BODY}`;
  const highlights = d.highlights
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, story ? 4 : 2)
    .map((h) => wrapText(ctx, h, innerW - hs * 1.3, 1)[0]);
  if (highlights.length) {
    blocks.push({
      h: highlights.length * hs * 1.55 + 10,
      draw: (y) => {
        ctx.font = `600 ${hs}px ${BODY}`;
        ctx.textBaseline = 'top';
        highlights.forEach((h, i) => {
          const ly = y + 10 + i * hs * 1.55;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = Math.max(3, hs * 0.12);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(pad + hs * 0.05, ly + hs * 0.55);
          ctx.lineTo(pad + hs * 0.32, ly + hs * 0.82);
          ctx.lineTo(pad + hs * 0.8, ly + hs * 0.25);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.fillText(h, pad + hs * 1.3, ly);
        });
      }
    });
  }

  const gap = story ? 26 : 16;
  const total = blocks.reduce((sum, b) => sum + b.h, 0) + gap * (blocks.length - 1);
  let y = cardY - (story ? 48 : 32) - total;
  for (const b of blocks) {
    b.draw(y);
    y += b.h + gap;
  }

  // Kartu agen
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, pad, cardY, innerW, cardH, 28);
  ctx.fill();
  const av = cardH - 36;
  const ax = pad + 18;
  const ay = cardY + 18;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2);
  ctx.clip();
  if (agentPhoto) {
    const a = sizeOf(agentPhoto);
    const c = coverCrop(a.w, a.h, av, av, 0.3);
    ctx.drawImage(agentPhoto, c.sx, c.sy, c.sw, c.sh, ax, ay, av, av);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ax, ay, av, av);
    ctx.fillStyle = '#fbbf24';
    ctx.font = `800 ${av * 0.38}px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(d.agentName), ax + av / 2, ay + av / 2 + 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  const tx = ax + av + 24;
  const ctaW = d.cta.trim() ? Math.min(innerW * 0.42, 380) : 0;
  const textW = innerW - (tx - pad) - ctaW - 24;
  ctx.textBaseline = 'top';
  ctx.font = `800 ${story ? 38 : 32}px ${DISPLAY}`;
  ctx.fillStyle = '#020617';
  ctx.fillText(wrapText(ctx, d.agentName.trim() || 'Agen Brighton', textW, 1)[0], tx, ay + (story ? 8 : 4));
  ctx.font = `600 ${story ? 30 : 26}px ${BODY}`;
  ctx.fillStyle = '#475569';
  ctx.fillText(wrapText(ctx, d.agentWa.trim() ? `WA ${d.agentWa.trim()}` : 'Brighton HUB Cibubur', textW, 1)[0], tx, ay + (story ? 60 : 50));

  if (ctaW) {
    const bh = cardH - 44;
    const bx = pad + innerW - ctaW - 22;
    const by = cardY + 22;
    ctx.fillStyle = '#020617';
    roundRect(ctx, bx, by, ctaW, bh, bh / 2);
    ctx.fill();
    let size = story ? 30 : 26;
    ctx.font = `800 ${size}px ${DISPLAY}`;
    while (size > 16 && ctx.measureText(d.cta.trim()).width > ctaW - 40) {
      size -= 1;
      ctx.font = `800 ${size}px ${DISPLAY}`;
    }
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wrapText(ctx, d.cta.trim(), ctaW - 40, 1)[0], bx + ctaW / 2, by + bh / 2 + 1);
    ctx.textAlign = 'left';
  }
  return canvas;
}

/* ------------------------------------------------------------------ utils */

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar.'))), type, quality)
  );
}

export async function downloadCanvas(canvas: HTMLCanvasElement, fileName: string, type = 'image/jpeg'): Promise<void> {
  downloadBlob(await canvasToBlob(canvas, type), fileName);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Nama file aman dari teks bebas. */
export function slugName(text: string, fallback = 'brighton'): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40) || fallback
  );
}
