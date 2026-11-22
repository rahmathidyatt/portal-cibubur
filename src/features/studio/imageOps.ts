/**
 * Olah foto langsung di browser (gratis, tanpa server): pertajam/cerahkan, tambal objek,
 * samarkan area, dan hitung potongan ukuran. Semua bekerja pada data RGBA mentah agar bisa diuji.
 */

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Kotak 0–1000 (urutan Gemini): [ymin, xmin, ymax, xmax]. */
export type Box = [number, number, number, number];

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Blur kotak sederhana (radius r) untuk satu kanal penuh RGBA; dipakai unsharp mask & samarkan. */
export function boxBlur(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const tmp = new Float32Array(w * h * 4);
  const out = new Uint8ClampedArray(src.length);
  const size = r * 2 + 1;
  // horizontal
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(y * w + Math.min(w - 1, Math.max(0, k))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = acc / size;
        const add = Math.min(w - 1, x + r + 1);
        const sub = Math.max(0, x - r);
        acc += src[(y * w + add) * 4 + c] - src[(y * w + sub) * 4 + c];
      }
    }
  }
  // vertikal
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = acc / size;
        const add = Math.min(h - 1, y + r + 1);
        const sub = Math.max(0, y - r);
        acc += tmp[(add * w + x) * 4 + c] - tmp[(sub * w + x) * 4 + c];
      }
    }
  }
  return out;
}

export interface EnhanceOptions {
  /** 0–1: kekuatan penajaman. */
  sharpen: number;
  /** 0–1: seberapa kuat kontras/kecerahan diratakan otomatis. */
  autoLevel: number;
  /** 0–1: tambahan kepekatan warna. */
  vibrance: number;
}

export const DEFAULT_ENHANCE: EnhanceOptions = { sharpen: 0.6, autoLevel: 0.8, vibrance: 0.25 };

/** Batas bawah/atas kecerahan (persentil) untuk perataan level otomatis. */
export function levelBounds(data: Uint8ClampedArray, lowPct = 0.005, highPct = 0.995): [number, number] {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
    n++;
  }
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * lowPct) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= n * (1 - highPct)) {
      hi = v;
      break;
    }
  }
  return hi - lo < 32 ? [0, 255] : [lo, hi];
}

/** "HD": ratakan level, perkuat warna, lalu pertajam (unsharp mask). Mengubah data di tempat. */
export function enhance(img: Rgba, opt: EnhanceOptions = DEFAULT_ENHANCE): Rgba {
  const { data, width: w, height: h } = img;
  const [lo, hi] = levelBounds(data);
  const scale = 255 / (hi - lo);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      data[i + c] = clamp255(v + ((v - lo) * scale - v) * opt.autoLevel);
    }
    if (opt.vibrance > 0) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      const max = Math.max(r, g, b);
      // Warna yang masih pucat diperkuat lebih banyak (vibrance, bukan saturasi rata).
      const amt = opt.vibrance * (1 - (max - avg) / 128);
      data[i] = clamp255(r + (r - avg) * amt);
      data[i + 1] = clamp255(g + (g - avg) * amt);
      data[i + 2] = clamp255(b + (b - avg) * amt);
    }
  }
  if (opt.sharpen > 0) {
    const radius = Math.max(1, Math.round(Math.max(w, h) / 1200));
    const blur = boxBlur(data, w, h, radius);
    const k = opt.sharpen * 1.2;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const d = data[i + c] - blur[i + c];
        // Abaikan perbedaan sangat kecil agar noise tidak ikut dipertajam.
        if (Math.abs(d) > 3) data[i + c] = clamp255(data[i + c] + d * k);
      }
    }
  }
  return img;
}

/**
 * Tambal area bertanda (mask = 1) dari tepi ke dalam memakai rata-rata piksel di sekitarnya
 * yang sudah diketahui, lalu haluskan sedikit dan beri tekstur halus agar tidak terlihat datar.
 */
export function inpaint(img: Rgba, mask: Uint8Array): Rgba {
  const { data, width: w, height: h } = img;
  const known = new Uint8Array(w * h);
  let remaining = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let p = 0; p < w * h; p++) {
    known[p] = mask[p] ? 0 : 1;
    if (mask[p]) {
      remaining++;
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const R = 3;
  let guard = 0;
  while (remaining > 0 && guard++ < 4000) {
    const fill: [number, number, number, number][] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = y * w + x;
        if (known[p]) continue;
        // Hanya piksel di tepi area (punya tetangga yang diketahui) yang diisi pada putaran ini.
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && known[ny * w + nx]) {
              edge = true;
              break;
            }
          }
        if (!edge) continue;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let sw = 0;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (!known[q]) continue;
            const wt = 1 / (dx * dx + dy * dy);
            sr += data[q * 4] * wt;
            sg += data[q * 4 + 1] * wt;
            sb += data[q * 4 + 2] * wt;
            sw += wt;
          }
        if (sw > 0) fill.push([p, sr / sw, sg / sw, sb / sw]);
      }
    }
    if (fill.length === 0) break;
    for (const [p, r, g, b] of fill) {
      data[p * 4] = r;
      data[p * 4 + 1] = g;
      data[p * 4 + 2] = b;
      known[p] = 1;
      remaining--;
    }
  }
  // Haluskan hanya di dalam area tambalan agar sambungan tidak bergaris.
  const blurred = boxBlur(data, w, h, 2);
  let seed = 7;
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const grain = ((seed % 7) - 3) * 0.8;
    for (let c = 0; c < 3; c++) data[p * 4 + c] = clamp255(blurred[p * 4 + c] + grain);
  }
  return img;
}

/** Perlebar mask beberapa piksel supaya pinggiran objek ikut tertambal. */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
        }
    }
  return out;
}

/** Ubah kotak 0–1000 menjadi piksel, dengan sedikit kelonggaran (pad, dalam proporsi ukuran kotak). */
export function boxToPx(box: Box, w: number, h: number, pad = 0.12): { x: number; y: number; w: number; h: number } {
  const [ymin, xmin, ymax, xmax] = box;
  const bw = ((xmax - xmin) / 1000) * w;
  const bh = ((ymax - ymin) / 1000) * h;
  const x0 = Math.max(0, (xmin / 1000) * w - bw * pad);
  const y0 = Math.max(0, (ymin / 1000) * h - bh * pad);
  const x1 = Math.min(w, (xmax / 1000) * w + bw * pad);
  const y1 = Math.min(h, (ymax / 1000) * h + bh * pad);
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}

/** Samarkan area bertanda (mask = 1) dengan blur kuat. */
export function blurMasked(img: Rgba, mask: Uint8Array, strength: number): Rgba {
  const { data, width: w, height: h } = img;
  const r = Math.max(4, Math.round((Math.max(w, h) / 100) * strength));
  // Dua kali blur kotak ≈ blur gaussian, cukup untuk membuat wajah/plat tidak terbaca.
  const once = boxBlur(data, w, h, r);
  const twice = boxBlur(once, w, h, r);
  for (let p = 0; p < w * h; p++) {
    if (!mask[p]) continue;
    for (let c = 0; c < 3; c++) data[p * 4 + c] = twice[p * 4 + c];
  }
  return img;
}

/** Potongan tengah agar gambar memenuhi rasio tujuan (object-fit: cover). focusY 0–1 menggeser potongan. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number, focusY = 0.5, focusX = 0.5) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return {
    sx: Math.round((srcW - sw) * Math.min(1, Math.max(0, focusX))),
    sy: Math.round((srcH - sh) * Math.min(1, Math.max(0, focusY))),
    sw: Math.round(sw),
    sh: Math.round(sh)
  };
}

/** Ukuran gambar utuh di dalam bingkai (object-fit: contain). */
export function containSize(srcW: number, srcH: number, dstW: number, dstH: number) {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { x: Math.round((dstW - w) / 2), y: Math.round((dstH - h) / 2), w, h };
}
