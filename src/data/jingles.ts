/** Jingle Brighton bawaan (file di public/jingles/). */
export interface Jingle {
  id: string;
  title: string;
  /** Relatif terhadap base portal (lagu bawaan) atau URL penuh / data URL (unggahan). */
  url: string;
  /** Lokasi file di Supabase Storage (bucket "jingles") untuk unggahan admin. */
  storagePath?: string | null;
}

export const DEFAULT_JINGLES: Jingle[] = [
  { id: 'rise-and-multiply', title: 'Rise and Multiply', url: 'jingles/rise-and-multiply.mp3' },
  { id: 'together-greater', title: 'Together Greater', url: 'jingles/together-greater.mp3' },
  { id: 'selalu-melangkah', title: 'Selalu Melangkah', url: 'jingles/selalu-melangkah.mp3' },
  { id: 'united-for-impact', title: 'United for Impact', url: 'jingles/united-for-impact.mp3' },
  { id: 'mimpi-jadi-nyata', title: 'Mimpi Jadi Nyata', url: 'jingles/mimpi-jadi-nyata.mp3' }
];

export const MAX_JINGLE_BYTES = 15 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|mpeg|m4a|aac|wav|ogg)$/i;

/** Judul bawaan dari nama file: "Jingle_Rise_And_Multiply_5.mp3" → "Jingle Rise And Multiply". */
export function titleFromFileName(name: string): string {
  return name
    .replace(/(\.(mp3|mpeg|m4a|aac|wav|ogg))+$/i, '')
    .replace(/^[0-9a-f]{8}-/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+\d+$/, '')
    .trim();
}

export function validateJingleFile(file: { name: string; size: number; type: string }, maxBytes = MAX_JINGLE_BYTES): string | null {
  if (!file.type.startsWith('audio/') && !AUDIO_EXT.test(file.name)) return 'File harus berupa audio (mp3, m4a, wav, ogg).';
  if (file.size > maxBytes) return `Ukuran file maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return null;
}

/** URL yang bisa diputar: url relatif diarahkan ke base portal. */
export function resolveJingleUrl(url: string, base = ''): string {
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${base}${url.replace(/^\/+/, '')}`;
}
