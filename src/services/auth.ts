import {
  getSupabaseConfig,
  readLocal,
  supabaseFetch,
  SupabaseRequestError,
  writeLocal,
  type SupabaseConfig
} from './supabaseClient';

export interface AdminSession {
  email: string;
  /** Token Supabase; kosong pada mode demo lokal. */
  accessToken: string | null;
  expiresAt: number; // epoch ms
}

export interface AuthService {
  readonly mode: 'supabase' | 'local';
  getSession(): AdminSession | null;
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
}

const SESSION_KEY = 'portal-cibubur:admin-session';

/** Akun demo, hanya berlaku saat Supabase belum disambungkan (data hanya di browser ini). */
export const DEMO_ADMIN = { email: 'admin@demo.local', password: 'admin123' } as const;

function loadSession(): AdminSession | null {
  const session = readLocal<AdminSession | null>(SESSION_KEY, null);
  if (!session || typeof session.expiresAt !== 'number' || session.expiresAt < Date.now()) {
    return null;
  }
  return session;
}

function createLocalAuth(): AuthService {
  return {
    mode: 'local',
    getSession: loadSession,
    async signIn(email, password) {
      if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
        throw new Error('Email atau kata sandi salah.');
      }
      const session: AdminSession = {
        email: DEMO_ADMIN.email,
        accessToken: null,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000
      };
      writeLocal(SESSION_KEY, session);
      return session;
    },
    async signOut() {
      writeLocal(SESSION_KEY, null);
    }
  };
}

function createSupabaseAuth(config: SupabaseConfig): AuthService {
  return {
    mode: 'supabase',
    getSession: loadSession,
    async signIn(email, password) {
      try {
        const res = await supabaseFetch(config, 'auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password })
        });
        const data = (await res.json()) as {
          access_token: string;
          expires_in: number;
          user?: { email?: string };
        };

        // Akun harus terdaftar di tabel portal_admins agar boleh mengelola data.
        const check = await supabaseFetch(config, 'rest/v1/rpc/is_portal_admin', {
          method: 'POST',
          accessToken: data.access_token,
          body: '{}'
        });
        if (!((await check.json()) as boolean)) {
          await supabaseFetch(config, 'auth/v1/logout', {
            method: 'POST',
            accessToken: data.access_token
          }).catch(() => {});
          throw new Error('Akun ini belum terdaftar sebagai admin portal.');
        }
        const session: AdminSession = {
          email: data.user?.email ?? email.trim(),
          accessToken: data.access_token,
          // Dikurangi 1 menit agar token tidak kedaluwarsa di tengah permintaan.
          expiresAt: Date.now() + (data.expires_in - 60) * 1000
        };
        writeLocal(SESSION_KEY, session);
        return session;
      } catch (err) {
        if (err instanceof SupabaseRequestError && err.status === 400) {
          throw new Error('Email atau kata sandi salah.');
        }
        throw err;
      }
    },
    async signOut() {
      const session = loadSession();
      writeLocal(SESSION_KEY, null);
      if (session?.accessToken) {
        await supabaseFetch(config, 'auth/v1/logout', {
          method: 'POST',
          accessToken: session.accessToken
        }).catch(() => {});
      }
    }
  };
}

let cached: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseAuth(config) : createLocalAuth();
  }
  return cached;
}
