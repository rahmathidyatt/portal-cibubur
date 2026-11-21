import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, supabaseFetch } from '../../services/supabaseClient';
import { DEFAULT_LIMITS, type GeminiLimits, type UsageRow } from './aiUsage';

/** Catatan pemakaian Gemini 30 hari terakhir (kosong di mode demo). */
export async function listUsage(auth: AdminAuth): Promise<UsageRow[]> {
  const config = getSupabaseConfig();
  if (!config || !auth.isAdmin) return [];
  const since = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const res = await supabaseFetch(
    config,
    `rest/v1/ai_usage_log?select=created_at,mode,model,status,fallback,duration_ms,question&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=20000`,
    { accessToken: auth.accessToken }
  );
  const rows = (await res.json()) as {
    created_at: string;
    mode: string;
    model: string;
    status: UsageRow['status'];
    fallback: boolean;
    duration_ms: number | null;
    question: string | null;
  }[];
  return rows.map((r) => ({
    createdAt: r.created_at,
    mode: r.mode,
    model: r.model,
    status: r.status,
    fallback: r.fallback,
    durationMs: r.duration_ms,
    question: r.question
  }));
}

export async function getLimits(): Promise<GeminiLimits> {
  const config = getSupabaseConfig();
  if (!config) return DEFAULT_LIMITS;
  try {
    const res = await supabaseFetch(config, 'rest/v1/portal_settings?key=eq.gemini_limits&select=value');
    const v = ((await res.json()) as { value: Partial<GeminiLimits> }[])[0]?.value;
    return { flash: Number(v?.flash) || DEFAULT_LIMITS.flash, lite: Number(v?.lite) || DEFAULT_LIMITS.lite };
  } catch {
    return DEFAULT_LIMITS;
  }
}

export async function saveLimits(limits: GeminiLimits, auth: AdminAuth): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Batas hanya bisa disimpan di portal online.');
  if (!(limits.flash > 0) || !(limits.lite > 0)) throw new Error('Isi batas harian dengan angka lebih dari 0.');
  await supabaseFetch(config, 'rest/v1/portal_settings?on_conflict=key', {
    method: 'POST',
    accessToken: auth.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'gemini_limits', value: limits, updated_at: new Date().toISOString() })
  });
}
