import type { AdminAuth } from './bookingStore';
import { getSupabaseConfig, readLocal, supabaseFetch, writeLocal } from './supabaseClient';

/** Ucapan ulang tahun agen di beranda (Bahasa Indonesia & Inggris). */
export interface BirthdayWish {
  id: string;
  en: string;
}

export const DEFAULT_BIRTHDAY_WISH: BirthdayWish = {
  id: 'Semoga setiap tahun yang berlalu membawa kebijaksanaan yang lebih besar, pencapaian yang lebih tinggi, dan kebahagiaan yang lebih bermakna.',
  en: 'May each passing year bring greater wisdom, higher achievements, and more meaningful happiness.'
};

export const BIRTHDAY_WISH_CHANGED = 'birthday-wish-changed';
const LOCAL_KEY = 'portal-cibubur:birthday-wish';

function sanitize(w: Partial<BirthdayWish> | null | undefined): BirthdayWish {
  const id = (w?.id ?? '').trim();
  const en = (w?.en ?? '').trim();
  return { id: id || DEFAULT_BIRTHDAY_WISH.id, en: en || DEFAULT_BIRTHDAY_WISH.en };
}

export function validateWish(w: BirthdayWish): string | null {
  if (w.id.trim().length < 5 || w.en.trim().length < 5) return 'Isi ucapan Bahasa Indonesia dan Inggris.';
  if (w.id.length > 300 || w.en.length > 300) return 'Ucapan maksimal 300 karakter.';
  return null;
}

export async function getBirthdayWish(): Promise<BirthdayWish> {
  const config = getSupabaseConfig();
  if (!config) return sanitize(readLocal<BirthdayWish | null>(LOCAL_KEY, null));
  try {
    const res = await supabaseFetch(config, 'rest/v1/portal_settings?key=eq.birthday_wish&select=value');
    const rows = (await res.json()) as { value: Partial<BirthdayWish> }[];
    return sanitize(rows[0]?.value);
  } catch {
    return DEFAULT_BIRTHDAY_WISH;
  }
}

export async function saveBirthdayWish(wish: BirthdayWish, auth: AdminAuth): Promise<void> {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah ucapan.');
  const problem = validateWish(wish);
  if (problem) throw new Error(problem);
  const value = { id: wish.id.trim(), en: wish.en.trim() };
  const config = getSupabaseConfig();
  if (!config) {
    writeLocal(LOCAL_KEY, value);
  } else {
    await supabaseFetch(config, 'rest/v1/portal_settings?on_conflict=key', {
      method: 'POST',
      accessToken: auth.accessToken,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'birthday_wish', value, updated_at: new Date().toISOString() })
    });
  }
  window.dispatchEvent(new Event(BIRTHDAY_WISH_CHANGED));
}
