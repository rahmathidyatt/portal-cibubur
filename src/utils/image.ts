/** Utilitas gambar kecil yang dipakai beberapa menu (tanpa ketergantungan berat). */

export function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
