import { getSupabaseConfig } from './supabaseClient';

/**
 * Pemanggil edge function `minbur-ai` (Gemini). Kunci Gemini hanya ada di server
 * Supabase (secret GEMINI_API_KEY). Semua fungsi mengembalikan null bila AI
 * belum aktif / gagal, sehingga portal tetap jalan seperti biasa.
 */
async function callAi<T>(body: Record<string, unknown>, accessToken?: string | null): Promise<T | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/functions/v1/minbur-ai`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken || config.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Jawaban Epigram dari Gemini berdasarkan data portal (context). */
export async function askGemini(question: string, context: string, lang: 'id' | 'en'): Promise<string | null> {
  const r = await callAi<{ answer?: string }>({ mode: 'chat', question, context, lang });
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
export async function scanNotaImage(imageDataUrl: string, accessToken: string | null): Promise<Record<string, unknown> | null> {
  return callAi<Record<string, unknown>>({ mode: 'nota', image: imageDataUrl }, accessToken);
}
