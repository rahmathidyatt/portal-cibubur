import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { DEMO_ADMIN } from '../services/auth';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ open, onClose }) => {
  const { signIn, authMode } = useAdmin();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="login-title" className="text-lg font-bold text-slate-950">
              Masuk sebagai admin
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Untuk staf kantor: kelola pengumuman dan reservasi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1 text-slate-500 hover:text-slate-950 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {authMode === 'local' && (
          <p className="rounded-lg bg-stone-50 border border-slate-200 p-3 text-[11px] text-slate-600">
            Mode demo (Supabase belum tersambung): gunakan{' '}
            <span className="font-mono text-slate-900">{DEMO_ADMIN.email}</span> /{' '}
            <span className="font-mono text-slate-900">{DEMO_ADMIN.password}</span>. Perubahan hanya
            tersimpan di browser ini.
          </p>
        )}

        <div>
          <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-700 mb-1">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-700 mb-1">
            Kata sandi
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full px-4 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
};
