import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Brush, Trash2, Undo2, Upload } from 'lucide-react';
import { boxToPx, type Box } from './imageOps';

export const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400';
export const label = 'block text-xs font-semibold text-slate-600 mb-1';
export const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';
export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
export const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-800 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

/** Buka file foto menjadi canvas (orientasi kamera dibetulkan, sisi terpanjang maks. maxSide). */
export async function fileToCanvas(file: File, maxSide = 2048): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Foto "${file.name}" tidak dapat dibuka. Gunakan JPG atau PNG.`);
  }
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** Perkecil canvas dengan faktor skala (0–1). */
export function scaleCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * scale));
  c.height = Math.max(1, Math.round(src.height * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** JPEG kecil untuk dikirim ke Gemini (hemat kuota & cepat). */
export function canvasForAi(src: HTMLCanvasElement, maxSide = 1600): string {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Beri jeda agar spinner sempat tampil sebelum proses berat berjalan. */
export const nextFrame = () => new Promise<void>((r) => window.setTimeout(r, 40));

/** Tombol unggah foto. */
export const PhotoButton: React.FC<{
  onFiles: (files: File[]) => void;
  text: string;
  multiple?: boolean;
  primary?: boolean;
}> = ({ onFiles, text, multiple, primary }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={primary ? primaryBtn : ghostBtn}>
        <Upload className="h-4 w-4" /> {text}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        aria-label={text}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
};

/** Tampilkan canvas apa adanya (diperkecil mengikuti lebar kolom). */
export const CanvasView: React.FC<{ canvas: HTMLCanvasElement; alt: string; className?: string }> = ({ canvas, alt, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = canvas.width;
    el.height = canvas.height;
    el.getContext('2d')!.drawImage(canvas, 0, 0);
  }, [canvas]);
  return <canvas ref={ref} role="img" aria-label={alt} className={`block h-auto max-w-full rounded-lg ring-1 ring-slate-200 ${className ?? ''}`} />;
};

export interface MaskHandle {
  /** Mask 1 = area yang ditandai, seukuran gambar. */
  getMask: () => Uint8Array;
  hasMask: () => boolean;
  addBoxes: (boxes: Box[], pad?: number) => void;
  clear: () => void;
}

/**
 * Foto + lapisan kuas merah untuk menandai area (hapus objek / samarkan).
 * Bisa digambar dengan mouse maupun jari di HP.
 */
export const MaskEditor: React.FC<{ base: HTMLCanvasElement; handle: React.Ref<MaskHandle>; onChange?: (has: boolean) => void }> = ({
  base,
  handle,
  onChange
}) => {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState(4);
  const [, setTick] = useState(0);

  const notify = useCallback(() => {
    setTick((t) => t + 1);
    const m = maskRef.current;
    if (!m || !onChange) return;
    const d = m.getContext('2d')!.getImageData(0, 0, m.width, m.height).data;
    let has = false;
    for (let i = 3; i < d.length; i += 16)
      if (d[i]) {
        has = true;
        break;
      }
    onChange(has);
  }, [onChange]);

  useEffect(() => {
    const b = baseRef.current;
    const m = maskRef.current;
    if (!b || !m) return;
    b.width = m.width = base.width;
    b.height = m.height = base.height;
    b.getContext('2d')!.drawImage(base, 0, 0);
    m.getContext('2d')!.clearRect(0, 0, m.width, m.height);
    history.current = [];
    onChange?.(false);
  }, [base, onChange]);

  const snapshot = () => {
    const m = maskRef.current!;
    history.current.push(m.getContext('2d')!.getImageData(0, 0, m.width, m.height));
    if (history.current.length > 15) history.current.shift();
  };

  useImperativeHandle(
    handle,
    () => ({
      getMask: () => {
        const m = maskRef.current!;
        const d = m.getContext('2d')!.getImageData(0, 0, m.width, m.height).data;
        const out = new Uint8Array(m.width * m.height);
        for (let p = 0; p < out.length; p++) out[p] = d[p * 4 + 3] > 0 ? 1 : 0;
        return out;
      },
      hasMask: () => {
        const m = maskRef.current!;
        const d = m.getContext('2d')!.getImageData(0, 0, m.width, m.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
        return false;
      },
      addBoxes: (boxes, pad = 0.12) => {
        const m = maskRef.current!;
        snapshot();
        const ctx = m.getContext('2d')!;
        ctx.fillStyle = 'rgb(239,68,68)';
        for (const b of boxes) {
          const r = boxToPx(b, m.width, m.height, pad);
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        notify();
      },
      clear: () => {
        const m = maskRef.current!;
        snapshot();
        m.getContext('2d')!.clearRect(0, 0, m.width, m.height);
        notify();
      }
    }),
    [notify]
  );

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = maskRef.current!;
    const r = m.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * m.width, y: ((e.clientY - r.top) / r.height) * m.height };
  };
  const radius = () => {
    const m = maskRef.current!;
    return (Math.max(m.width, m.height) / 100) * brush;
  };
  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = maskRef.current!.getContext('2d')!;
    // Gambar penuh lalu beri transparansi lewat CSS agar goresan bertumpuk tidak makin gelap.
    ctx.strokeStyle = 'rgb(239,68,68)';
    ctx.fillStyle = 'rgb(239,68,68)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius() * 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(to.x, to.y, radius(), 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <div>
      <div className="relative inline-block max-w-full">
        <canvas ref={baseRef} className="block h-auto max-w-full max-h-[70vh] w-auto rounded-lg ring-1 ring-slate-200" aria-hidden="true" />
        <canvas
          ref={maskRef}
          role="img"
          aria-label="Area yang ditandai"
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none rounded-lg opacity-55"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            snapshot();
            drawing.current = true;
            const p = pos(e);
            last.current = p;
            stroke(p, p);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = pos(e);
            stroke(last.current, p);
            last.current = p;
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
            notify();
          }}
          onPointerCancel={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
          <Brush className="h-4 w-4 text-amber-600" /> Ukuran kuas
          <input type="range" min={1} max={12} value={brush} onChange={(e) => setBrush(Number(e.target.value))} aria-label="Ukuran kuas" />
        </label>
        <button
          type="button"
          className={ghostBtn}
          disabled={history.current.length === 0}
          onClick={() => {
            const prev = history.current.pop();
            if (prev) maskRef.current!.getContext('2d')!.putImageData(prev, 0, 0);
            notify();
          }}
        >
          <Undo2 className="h-4 w-4" /> Urungkan tanda
        </button>
        <button
          type="button"
          className={ghostBtn}
          onClick={() => {
            const m = maskRef.current!;
            snapshot();
            m.getContext('2d')!.clearRect(0, 0, m.width, m.height);
            notify();
          }}
        >
          <Trash2 className="h-4 w-4" /> Hapus semua tanda
        </button>
      </div>
    </div>
  );
};
