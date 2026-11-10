import React, { useState } from 'react';
import { RefreshCw, Copy, Check, ArrowDown, Building2, Sun, Phone, MapPin } from 'lucide-react';
import { MorningQuote, HERO_OFFICE_IMAGE, OFFICE_IDENTITY } from '../data/cibuburData';
import { getNextMorningInspiration } from '../utils/hubLogic';

interface MorningInspirationHeroProps {
  quotes: MorningQuote[];
}

export const MorningInspirationHero: React.FC<MorningInspirationHeroProps> = ({
  quotes
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [copiedQuote, setCopiedQuote] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const currentQuote = quotes[activeIndex] || quotes[0];

  const handleNextInspiration = () => {
    const { nextIndex } = getNextMorningInspiration(quotes, activeIndex);
    setActiveIndex(nextIndex);
    setCopiedQuote(false);
  };

  const handleCopyInspiration = () => {
    const textToCopy = `"${currentQuote.quote}" — ${currentQuote.authorOrContext} (${currentQuote.dailyFocus})`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2200);
  };

  return (
    <section
      id="inspirasi"
      className="py-10 sm:py-14 bg-gradient-to-br from-[#FEF08A]/55 via-[#FEF9C3]/45 to-white border-b-2 border-amber-300/90 scroll-mt-20"
    >
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left 7 Columns: Morning Inspiration & Motivational Message */}
          <div className="lg:col-span-7 bg-white border-2 border-amber-300 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#FACC15] via-amber-400 to-[#EAB308]" />
            <div>
              {/* Unboxed Metadata Kicker */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-950 mb-4 pt-1">
                <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold">{currentQuote.title}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-amber-800">
                  Kutipan 0{activeIndex + 1} / 0{quotes.length}
                </span>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-slate-950 text-balance leading-[1.2]"
                style={{ fontSize: 'clamp(1.75rem, 3.2vw, 2.45rem)' }}
              >
                “{currentQuote.quote}”
              </h1>

              <p className="mt-4 text-sm font-bold text-amber-900">
                {currentQuote.authorOrContext}
              </p>

              <div className="mt-5 p-4 rounded-xl bg-[#FEF9C3]/80 border border-amber-300/80">
                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {currentQuote.dailyFocus}
                </p>
              </div>
            </div>

            {/* Interactive Controls for Morning Inspiration */}
            <div className="mt-7 pt-5 border-t border-amber-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleNextInspiration}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Ganti Inspirasi Pagi
                </button>

                <button
                  type="button"
                  onClick={handleCopyInspiration}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-800 bg-[#FEF9C3] hover:bg-[#FEF08A] border border-amber-300 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedQuote ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-emerald-800">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kutipan</span>
                    </>
                  )}
                </button>
              </div>

              <a
                href="#kontak-staf"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-amber-950 hover:text-slate-950 underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                Lihat Kontak Staf
                <ArrowDown className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right 5 Columns: Brighton HUB Cibubur Office Visual + Address & Phone 021 3873 9073 */}
          <div className="lg:col-span-5">
            <div className="relative h-full min-h-[290px] sm:min-h-[340px] rounded-2xl overflow-hidden border-2 border-amber-300 bg-slate-950 shadow-sm">
              {!imgFailed ? (
                <img
                  src={HERO_OFFICE_IMAGE}
                  alt="Ruang resepsionis dan area diskusi Brighton HUB Cibubur di Kota Wisata"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full lg:h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#FEF08A] via-[#FEF9C3] to-white text-slate-900">
                  <Building2 className="w-10 h-10 text-amber-700 mb-3" />
                  <p className="text-base font-bold">{OFFICE_IDENTITY.name}</p>
                  <p className="text-xs text-slate-700 mt-1">
                    {OFFICE_IDENTITY.address}
                  </p>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-1">
                    Telepon Kantor: {OFFICE_IDENTITY.phoneDisplay}
                  </p>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent p-5 text-white">
                <p className="text-xs font-mono font-bold text-[#FACC15]">
                  PUSAT INFORMASI OPERASIONAL · KOTA WISATA CIBUBUR
                </p>
                <p className="text-sm sm:text-base font-bold mt-1 text-white">
                  {OFFICE_IDENTITY.name}
                </p>
                <div className="mt-2 pt-2 border-t border-amber-400/30 space-y-1 text-xs text-amber-50">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FACC15] shrink-0 mt-0.5" />
                    <span>{OFFICE_IDENTITY.address}</span>
                  </p>
                  <p className="flex items-center gap-1.5 font-mono font-semibold text-[#FEF08A]">
                    <Phone className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                    <span>Telepon Kantor: {OFFICE_IDENTITY.phoneDisplay}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
