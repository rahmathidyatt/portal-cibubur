import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface DashCardProps {
  id: string;
  title: string;
  Icon: LucideIcon;
  /** Tautan di kanan atas kartu, mis. ke halaman detail. */
  action?: { href: string; label: string };
  /** Tombol/elemen kustom di kanan atas (menggantikan action). */
  headerExtra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Kartu ringkasan beranda dengan judul, ikon, dan tautan detail yang seragam. */
export const DashCard: React.FC<DashCardProps> = ({ id, title, Icon, action, headerExtra, className, children }) => (
  <section
    aria-labelledby={id}
    className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className ?? ''}`}
  >
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-sm font-bold text-slate-950">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {headerExtra ??
        (action && (
          <a href={action.href} className="text-xs font-semibold text-slate-500 hover:text-amber-700 whitespace-nowrap">
            {action.label} →
          </a>
        ))}
    </div>
    <div className="mt-4 flex-1">{children}</div>
  </section>
);

/** Teks status kosong yang seragam di semua kartu. */
export const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-xl bg-stone-50 px-3 py-4 text-center text-sm text-slate-500">{children}</p>
);

/** Kerangka abu-abu saat data dimuat. */
export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2.5 animate-pulse" aria-hidden="true">
    {Array.from({ length: lines }, (_, i) => (
      <div key={i} className="h-4 rounded bg-slate-100" style={{ width: `${90 - i * 15}%` }} />
    ))}
  </div>
);
