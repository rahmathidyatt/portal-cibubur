import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { todayInJakarta } from '../../utils/schedule';
import { formatMonth, mainAgents, type Closing } from './closing';
import { CLOSINGS_CHANGED, getClosingStore } from './closingStore';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Beranda: flyer semua closing bulan berjalan. Tersembunyi jika belum ada closing. */
export const ClosingShowcase: React.FC = () => {
  const store = getClosingStore();
  const month = todayInJakarta().slice(0, 7);
  const [items, setItems] = useState<Closing[]>([]);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const load = () =>
      void store
        .list(month)
        .then(setItems)
        .catch(() => setItems([]));
    load();
    window.addEventListener(CLOSINGS_CHANGED, load);
    return () => window.removeEventListener(CLOSINGS_CHANGED, load);
  }, [store, month]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const cards = items.flatMap((c) =>
    c.flyers.map((f) => ({
      key: `${c.id}-${f.id}`,
      src: store.flyerSrc(f),
      thumb: store.flyerSrc(f, true),
      closing: c,
      names: mainAgents(c)
        .map((a) => a.name.trim())
        .join(', ')
    }))
  );
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="closing-title" className="mt-6">
      <div className="text-center">
        <h2 id="closing-title" className="text-lg font-bold tracking-tight text-slate-950">
          Closing {formatMonth(month)}
        </h2>
        <p className="text-xs text-slate-500">{items.length} closing</p>
      </div>
      <ul className="mt-3 flex flex-wrap justify-center gap-3">
        {cards.map((card) => (
          <li key={card.key} className="w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] lg:w-[calc(20%-9.6px)]">
            <button
              type="button"
              onClick={() => setZoom({ src: card.src, alt: `Flyer closing ${card.names}` })}
              className="group block w-full overflow-hidden rounded-xl bg-white text-left ring-1 ring-slate-200 hover:ring-amber-400 cursor-zoom-in"
              aria-label={`Perbesar flyer closing ${card.names}`}
            >
              <span className="block aspect-[4/5] bg-stone-100">
                <img src={card.thumb} alt={`Flyer closing ${card.names}`} loading="lazy" className="h-full w-full object-contain" />
              </span>
              <span className="block px-2.5 py-2">
                <span translate="no" className="notranslate block truncate text-xs font-bold text-slate-900">{card.names}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {shortDate(card.closing.date)} · {card.closing.type} · {titleCase(card.closing.location)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {zoom && (
        <div
          role="dialog"
          aria-label="Flyer closing"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Tutup"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-900 hover:bg-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={zoom.src}
            alt={zoom.alt}
            className="max-h-[90vh] max-w-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};
