/**
 * Mengecilkan foto unggahan admin menjadi persegi (default 400x400, dipotong di tengah,
 * sedikit ke atas agar wajah tidak terpotong) lalu mengembalikan data URL WebP/JPEG.
 * Hasilnya ±10–40 KB sehingga aman disimpan di localStorage atau kolom teks database.
 */
export async function resizeImageToDataUrl(file: File, size: number = 400): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG, PNG, atau WebP).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ukuran foto maksimal 10 MB.');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
      el.src = url;
    });

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) * 0.2);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung pengolahan foto.');
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

    const webp = canvas.toDataURL('image/webp', 0.82);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
