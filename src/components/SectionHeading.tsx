import React from 'react';

/** Judul bagian beranda yang seragam: label kecil, judul rata tengah, garis hitam pendek. */
export const SectionHeading: React.FC<{
  id?: string;
  overline: string;
  title: React.ReactNode;
  /** Tombol admin di kanan (mis. Tambah BM). */
  action?: React.ReactNode;
}> = ({ id, overline, title, action }) => (
  <div className="relative text-center">
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">{overline}</p>
    <h2 id={id} className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
      {title}
    </h2>
    <span aria-hidden="true" className="mx-auto mt-3 block h-0.5 w-12 bg-slate-950" />
    {action && <div className="mt-4 sm:absolute sm:right-0 sm:top-0 sm:mt-0">{action}</div>}
  </div>
);
