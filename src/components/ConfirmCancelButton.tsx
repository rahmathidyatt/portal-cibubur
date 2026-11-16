import React, { useState } from 'react';

interface ConfirmCancelButtonProps {
  /** Dijalankan setelah pengguna menekan "Ya, batalkan". */
  onConfirm: () => Promise<void>;
  label?: string;
  confirmLabel?: string;
}

/** Tombol hapus/batal dua langkah (tanpa window.confirm yang bisa diblokir browser). */
export const ConfirmCancelButton: React.FC<ConfirmCancelButtonProps> = ({
  onConfirm,
  label = 'Batalkan',
  confirmLabel = 'Ya, batalkan'
}) => {
  const [asking, setAsking] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-[11px] font-bold text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer"
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-bold">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
        className="px-2 py-0.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Memproses…' : confirmLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setAsking(false)}
        className="text-slate-600 hover:text-slate-900 cursor-pointer"
      >
        Tidak
      </button>
    </span>
  );
};
