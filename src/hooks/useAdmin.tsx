import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getAuthService, type AdminSession } from '../services/auth';
import type { AdminAuth } from '../services/bookingStore';

interface AdminContextValue {
  session: AdminSession | null;
  isAdmin: boolean;
  /** Dipakai saat memanggil penyimpanan data. */
  auth: AdminAuth;
  authMode: 'supabase' | 'local';
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const service = getAuthService();
  const [session, setSession] = useState<AdminSession | null>(() => service.getSession());

  const signIn = useCallback(
    async (email: string, password: string) => {
      setSession(await service.signIn(email, password));
    },
    [service]
  );

  const signOut = useCallback(async () => {
    await service.signOut();
    setSession(null);
  }, [service]);

  const value = useMemo<AdminContextValue>(() => {
    // Sesi yang kedaluwarsa dianggap keluar.
    const active = session && session.expiresAt > Date.now() ? session : null;
    return {
      session: active,
      isAdmin: Boolean(active),
      auth: { isAdmin: Boolean(active), accessToken: active?.accessToken ?? null },
      authMode: service.mode,
      signIn,
      signOut
    };
  }, [session, service.mode, signIn, signOut]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin harus dipakai di dalam <AdminProvider>.');
  return ctx;
}
