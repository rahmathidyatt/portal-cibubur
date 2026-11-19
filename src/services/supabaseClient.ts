/**
 * Klien REST Supabase minimal (tanpa SDK) yang dipakai bersama oleh
 * penyimpanan reservasi, konten, dan login admin.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const env: Partial<ImportMetaEnv> = import.meta.env ?? {};
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
}

export class SupabaseRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string
  ) {
    super(message);
  }
}

/**
 * Memanggil endpoint Supabase. `accessToken` diisi saat admin sudah login,
 * sehingga aturan RLS untuk peran `authenticated` berlaku.
 */
export async function supabaseFetch(
  config: SupabaseConfig,
  path: string,
  init: RequestInit & { accessToken?: string | null } = {}
): Promise<Response> {
  const { accessToken, headers, ...rest } = init;
  const res = await fetch(`${config.url}/${path}`, {
    ...rest,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken || config.anonKey}`,
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> | undefined)
    }
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let reason = '';
    try {
      reason = String((JSON.parse(detail) as { message?: string }).message ?? '').slice(0, 140);
    } catch {
      /* bukan JSON */
    }
    throw new SupabaseRequestError(
      `Permintaan ke server gagal (${res.status})${reason ? `: ${reason}` : '.'}`,
      res.status,
      detail
    );
  }
  return res;
}

/** Helper localStorage yang aman (mode privat / kuota penuh tidak membuat aplikasi error). */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Diabaikan: data tetap berlaku selama halaman terbuka.
  }
}

export function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
