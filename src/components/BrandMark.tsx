import React from 'react';

/** Wordmark Brighton HUB Cibubur (huruf "o" kuning, seperti poster jadwal). */
export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <span translate="no" className={`notranslate inline-flex flex-col leading-none ${className ?? ''}`}>
    <span className="font-display text-[22px] font-extrabold tracking-tight text-slate-950">
      Bright<span className="text-amber-500">o</span>n
    </span>
    <span className="mt-0.5 text-[9px] font-bold tracking-[0.32em] text-slate-500">HUB CIBUBUR</span>
  </span>
);
