import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => undefined);

/** Notifikasi kecil yang muncul sebentar setelah menyimpan / menghapus. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef<number>(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (text: string, kind: ToastKind = 'success') => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, text, kind }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4 sm:top-20"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ring-1 motion-safe:animate-[toast-in_0.2s_ease-out] ${
              t.kind === 'error' ? 'bg-red-600 text-white ring-red-700' : 'bg-slate-950 text-white ring-white/10'
            }`}
          >
            {t.kind === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />}
            <span>{t.text}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Tutup notifikasi"
              className="ml-1 rounded p-0.5 text-white/60 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): (text: string, kind?: ToastKind) => void {
  return useContext(ToastContext);
}
