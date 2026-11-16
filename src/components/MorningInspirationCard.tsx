import React, { useState } from 'react';
import { RefreshCw, Copy, Check, Sun } from 'lucide-react';
import type { MorningQuote } from '../data/cibuburData';
import { getNextMorningInspiration } from '../utils/hubLogic';

interface MorningInspirationCardProps {
  quotes: MorningQuote[];
}

export const MorningInspirationCard: React.FC<MorningInspirationCardProps> = ({ quotes }) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const current = quotes[activeIndex] || quotes[0];
  if (!current) return null;

  const handleNext = () => {
    setActiveIndex(getNextMorningInspiration(quotes, activeIndex).nextIndex);
    setCopied(false);
  };

  const handleCopy = () => {
    const text = `"${current.quote}" — ${current.authorOrContext}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <figure className="w-full lg:flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-semibold text-amber-700">
        <Sun className="w-4 h-4" />
        Inspirasi hari ini
      </p>
      <blockquote className="mt-3 max-w-3xl text-lg font-semibold leading-snug text-slate-900 text-pretty">
        “{current.quote}”
      </blockquote>
      <figcaption className="mt-2 text-sm text-slate-500">{current.authorOrContext}</figcaption>
      <p className="mt-4 text-sm text-slate-700 border-l-2 border-amber-400 pl-3">
        {current.dailyFocus}
      </p>
      <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-600">
        {quotes.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 hover:text-slate-950 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Inspirasi lain
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 hover:text-slate-950 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Salin
            </>
          )}
        </button>
      </div>
    </figure>
  );
};
