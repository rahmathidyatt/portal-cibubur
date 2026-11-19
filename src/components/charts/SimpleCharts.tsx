import React, { useState } from 'react';

/** Grafik sederhana satu warna (satu seri) untuk halaman analisis admin. */

export interface Ranked {
  label: string;
  count: number;
}

const BAR = '#F59E0B';
const BAR_HOVER = '#D97706';

/** Grafik batang tegak (tren per bulan / per tahun) dengan tooltip saat diarahkan. */
export const ColumnChart: React.FC<{
  data: Ranked[];
  /** Teks setelah label pada tooltip, mis. tahun. */
  suffix?: string;
  /** Format nilai di tooltip. */
  format?: (n: number) => string;
  /** Format singkat angka di atas batang & sumbu. */
  short?: (n: number) => string;
}> = ({ data, suffix = '', format = (n) => String(n), short = (n) => String(n) }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div className="relative">
      <div className="relative flex h-48 items-end gap-1.5 border-b border-slate-300 pl-11">
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute left-0 right-0 border-t border-slate-100" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-2 left-0 w-9 whitespace-nowrap text-right text-[10px] tabular-nums text-slate-400">{short(t)}</span>
          </div>
        ))}
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.label}: ${format(d.count)}`}
            className="relative flex h-full min-w-0 flex-1 cursor-default flex-col justify-end"
          >
            {d.count > 0 && (
              <span className="mb-0.5 text-center text-[10px] font-semibold tabular-nums text-slate-600">{short(d.count)}</span>
            )}
            <span
              className="mx-auto block w-full max-w-10 rounded-t"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 3 : 0, background: hover === i ? BAR_HOVER : BAR }}
            />
            {hover === i && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-[11px] font-semibold text-white shadow">
                {d.label}
                {suffix ? ` ${suffix}` : ''}: {format(d.count)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 pl-11">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Daftar peringkat dengan batang mendatar. */
export const RankBars: React.FC<{ data: Ranked[]; empty: string; format?: (n: number) => string; labelWidth?: string }> = ({
  data,
  empty,
  format = (n) => String(n),
  labelWidth = '9rem'
}) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ol className="space-y-1.5">
      {data.map((d, i) => (
        <li
          key={d.label}
          className="grid items-center gap-2 text-xs"
          style={{ gridTemplateColumns: `18px minmax(0,${labelWidth}) minmax(0,1fr) auto` }}
          title={`${d.label}: ${format(d.count)}`}
        >
          <span className="text-right tabular-nums text-slate-400">{i + 1}</span>
          <span className="truncate font-semibold text-slate-800">{d.label}</span>
          <span className="h-3 rounded-r bg-stone-100">
            <span className="block h-3 rounded-r" style={{ width: `${(d.count / max) * 100}%`, background: BAR }} />
          </span>
          <span className="text-right font-bold tabular-nums text-slate-700">{format(d.count)}</span>
        </li>
      ))}
    </ol>
  );
};

