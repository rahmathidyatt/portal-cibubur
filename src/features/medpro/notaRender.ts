import JSZip from 'jszip';
import { itemFileName, notaNumber, uniqueNames, type Box, type NotaItem, type NotaScan } from './notaSplit';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Foto nota gagal dibuka.'));
    img.src = src;
  });
}

/** Kotak 0–1000 → piksel pada gambar. */
function px(box: Box, img: HTMLImageElement) {
  const [ymin, xmin, ymax, xmax] = box;
  return {
    x: (xmin / 1000) * img.naturalWidth,
    y: (ymin / 1000) * img.naturalHeight,
    w: ((xmax - xmin) / 1000) * img.naturalWidth,
    h: ((ymax - ymin) / 1000) * img.naturalHeight
  };
}

/** Nota dipotong rapi (sebatas kertas) lalu baris item diberi kotak merah. */
export function renderItemCanvas(img: HTMLImageElement, paper: Box, item: Pick<NotaItem, 'box'>, maxWidth = 1600): HTMLCanvasElement {
  const p = px(paper, img);
  const margin = Math.round(Math.min(p.w, p.h) * 0.01);
  const sx = Math.max(0, p.x - margin);
  const sy = Math.max(0, p.y - margin);
  const sw = Math.min(img.naturalWidth - sx, p.w + margin * 2);
  const sh = Math.min(img.naturalHeight - sy, p.h + margin * 2);
  const scale = Math.min(1, maxWidth / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const b = px(item.box, img);
  if (b.w > 0 && b.h > 0) {
    const pad = Math.max(3, canvas.width * 0.004);
    ctx.strokeStyle = '#e11d1d';
    ctx.lineWidth = Math.max(3, canvas.width * 0.0035);
    ctx.strokeRect((b.x - sx) * scale - pad, (b.y - sy) * scale - pad, b.w * scale + pad * 2, b.h * scale + pad * 2);
  }
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar.'))), 'image/jpeg', 0.9)
  );
}

/** ZIP "022642.zip" berisi satu gambar per baris nota, mis. "MONIKA JUAL 80X50 1PCS.jpg". */
export async function buildNotaZip(img: HTMLImageElement, scan: NotaScan): Promise<{ blob: Blob; fileName: string }> {
  const zip = new JSZip();
  const names = uniqueNames(scan.items.map((it) => itemFileName(it)));
  for (let i = 0; i < scan.items.length; i++) {
    zip.file(`${names[i]}.jpg`, await toBlob(renderItemCanvas(img, scan.paper, scan.items[i])));
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), fileName: `${notaNumber(scan.invoice)}.zip` };
}
