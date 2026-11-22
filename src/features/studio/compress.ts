/** Kompres foto ke ukuran file target (mis. 5 MB → 300 KB) dengan menjaga resolusi selama mungkin. */

export interface Encoded {
  blob: { size: number };
}

/**
 * Cari kualitas JPEG tertinggi yang hasilnya tidak melebihi target. Resolusi asli dipertahankan;
 * baru bila kualitas terendah yang masih layak (50%) tetap terlalu besar, resolusi diturunkan bertahap.
 */
export async function compressToTarget<T extends Encoded>(
  targetBytes: number,
  encode: (scale: number, quality: number) => Promise<T>
): Promise<T> {
  const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
  const MIN_Q = 0.5;
  const MAX_Q = 0.92;
  let last: T | null = null;
  for (const scale of scales) {
    const top = await encode(scale, MAX_Q);
    if (top.blob.size <= targetBytes) return top;
    const low = await encode(scale, MIN_Q);
    last = low;
    if (low.blob.size > targetBytes) continue;
    let lo = MIN_Q;
    let hi = MAX_Q;
    let best = low;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const r = await encode(scale, mid);
      if (r.blob.size <= targetBytes) {
        best = r;
        lo = mid;
      } else hi = mid;
    }
    return best;
  }
  return last!;
}

/** 1536000 → "1,5 MB"; 307200 → "300 KB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}
