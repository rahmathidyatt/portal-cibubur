import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Kotak teks BC siap salin. */
export const CopyTextBlock: React.FC<{ text: string; label: string; emptyText?: string; rows?: number }> = ({
  text,
  label,
  emptyText = 'Belum ada isi.',
  rows = 10
}) => {
  const toast = useToast();
  const [copied, setCopied] = useState<boolean>(false);
  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-bold text-slate-700">{label}</p>
        <button
          type="button"
          disabled={!text}
          onClick={async () => {
            const ok = await copyToClipboard(text);
            if (ok) {
              setCopied(true);
              toast('Teks BC disalin. Tempel di WhatsApp.');
              window.setTimeout(() => setCopied(false), 2000);
            } else toast('Gagal menyalin. Blok teks lalu salin manual.', 'error');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Tersalin' : 'Salin BC'}
        </button>
      </div>
      {text ? (
        <textarea
          readOnly
          value={text}
          rows={rows}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full resize-y rounded-b-xl bg-stone-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none"
        />
      ) : (
        <p className="px-3 py-4 text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
};
