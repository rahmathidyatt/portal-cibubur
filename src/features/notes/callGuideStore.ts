import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, supabaseFetch } from '../../services/supabaseClient';
import { DEFAULT_GUIDES, normalizeGuides, type CallGuide } from './callGuide';

const KEY = 'call_guides';

/** Panduan tersimpan; bila belum pernah diedit (atau mode demo), pakai isi bawaan. */
export async function getGuides(): Promise<CallGuide[]> {
  const config = getSupabaseConfig();
  if (!config) return DEFAULT_GUIDES;
  try {
    const res = await supabaseFetch(config, `rest/v1/portal_settings?key=eq.${KEY}&select=value`);
    const v = ((await res.json()) as { value: unknown }[])[0]?.value;
    return v ? normalizeGuides(v) : DEFAULT_GUIDES;
  } catch {
    return DEFAULT_GUIDES;
  }
}

export async function saveGuides(guides: CallGuide[], auth: AdminAuth): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Panduan hanya bisa disimpan di portal online.');
  await supabaseFetch(config, 'rest/v1/portal_settings?on_conflict=key', {
    method: 'POST',
    accessToken: auth.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: KEY, value: normalizeGuides(guides), updated_at: new Date().toISOString() })
  });
}
