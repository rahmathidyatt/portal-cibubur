import { getSupabaseConfig } from './supabaseClient';

/**
 * Pemanggil edge function `minbur-ai` (Gemini). Kunci Gemini hanya ada di server
 * Supabase (secret GEMINI_API_KEY). Semua fungsi mengembalikan null bila AI
 * belum aktif / gagal, sehingga portal tetap jalan seperti biasa.
 */
/** Hasil panggilan AI: data, atau kode error ('not_configured' | 'busy' | 'failed' | 'forbidden' | 'offline'). */
interface AiResult<T> {
  data: T | null;
  error: string | null;
}

async function callAiResult<T>(body: Record<string, unknown>, accessToken?: string | null, timeoutMs = 60_000): Promise<AiResult<T>> {
  const config = getSupabaseConfig();
  if (!config) return { data: null, error: 'not_configured' };
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.url}/functions/v1/minbur-ai`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken || config.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { data: null, error: err.error ?? (res.status === 546 || res.status === 504 ? 'busy' : 'failed') };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).name === 'AbortError' ? 'busy' : 'offline' };
  } finally {
    window.clearTimeout(timer);
  }
}

async function callAi<T>(body: Record<string, unknown>, accessToken?: string | null, timeoutMs?: number): Promise<T | null> {
  return (await callAiResult<T>(body, accessToken, timeoutMs)).data;
}

/** Pesan yang bisa dibaca admin untuk kode error AI. */
export function aiErrorMessage(code: string | null): string {
  switch (code) {
    case 'not_configured':
      return 'Gemini belum aktif. Simpan API key Gemini di Supabase (Edge Functions → Secrets → GEMINI_API_KEY).';
    case 'busy':
      return 'Gemini sedang sibuk atau terlalu lama merespons. Coba lagi beberapa saat lagi.';
    case 'forbidden':
      return 'Sesi admin berakhir. Silakan masuk ulang.';
    case 'offline':
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
    default:
      return 'Gemini gagal membaca. Coba lagi, atau foto ulang nota dengan lebih jelas.';
  }
}

/** Jawaban Epigram dari Gemini berdasarkan data portal (context). */
export async function askGemini(question: string, context: string, lang: 'id' | 'en'): Promise<string | null> {
  const r = await callAi<{ answer?: string }>({ mode: 'chat', question, context, lang }, null, 55_000);
  return r?.answer?.trim() || null;
}

/** Terjemahan ID → EN (hasil disimpan di cache server agar hemat kuota). */
export async function translateTexts(texts: string[]): Promise<(string | null)[] | null> {
  const r = await callAi<{ texts?: (string | null)[] }>({ mode: 'translate', texts, target: 'en' });
  return Array.isArray(r?.texts) && r.texts.length === texts.length ? r.texts : null;
}

/** Ucapan ulang tahun baru (ID & EN) — khusus admin. */
export async function generateBirthdayWish(accessToken: string | null): Promise<{ id: string; en: string } | null> {
  const r = await callAi<{ id?: string; en?: string }>({ mode: 'wish' }, accessToken);
  return r?.id && r?.en ? { id: r.id.trim(), en: r.en.trim() } : null;
}

/** Baca foto nota medpro (khusus admin): isi nota + posisi tiap baris. */
export async function scanNotaImage(imageDataUrl: string, accessToken: string | null): Promise<AiResult<Record<string, unknown>>> {
  return callAiResult<Record<string, unknown>>({ mode: 'nota', image: imageDataUrl }, accessToken, 140_000);
}
