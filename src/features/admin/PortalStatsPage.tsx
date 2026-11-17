import React, { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { getViewStats, whenVisitRecorded, type ViewStats } from '../../services/analytics';
import { MONTH_NAMES_ID } from '../floortime/engine';

const number = new Intl.NumberFormat('id-ID');

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES_ID[m - 1].slice(0, 3)}`;
}

/** Angka yang "naik" dari 0 saat pertama tampil (tanpa animasi bila pengguna memilih reduced motion). */
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState<number>(0);
  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduce = false;
    }
    if (reduce || target === 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const Counter: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <span className={`tabular-nums ${className ?? ''}`}>{number.format(useCountUp(value))}</span>
);

/** Menu admin "Statistik portal": kunjungan portal (khusus admin). */
export const PortalStatsPage: React.FC = () => {
  const { auth } = useAdmin();
  const [stats, setStats] = useState<ViewStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await whenVisitRecorded();
      setStats(await getViewStats(auth));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat statistik.');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="bg-stone-50 min-h-[60vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Statistik portal</h1>
            <p className="mt-1 text-sm text-slate-600">
              Jumlah kunjungan portal. Satu kunjungan dihitung sekali per sesi browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:text-slate-950 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {updatedAt
              ? `Diperbarui ${updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`
              : 'Muat ulang'}
          </button>
        </div>
        {error && <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {stats && (
          <div className="mt-6 overflow-hidden rounded-3xl">
            <StatsPanel stats={stats} />
          </div>
        )}
      </div>
    </section>
  );
};

const StatsPanel: React.FC<{ stats: ViewStats }> = ({ stats }) => {

  const max = Math.max(1, ...stats.daily.map((d) => d.views));
  const prev7 = stats.daily.slice(0, 7).reduce((s, d) => s + d.views, 0);
  const growth = prev7 > 0 ? Math.round(((stats.last7Views - prev7) / prev7) * 100) : null;

  const tiles = [
    { label: 'Pengunjung unik', value: stats.uniqueVisitors, Icon: Users },
    { label: 'Kunjungan hari ini', value: stats.todayViews, Icon: Eye },
    { label: '7 hari terakhir', value: stats.last7Views, Icon: TrendingUp }
  ];

  return (
    <div aria-labelledby="statistik-title" className="relative overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div className="relative px-5 sm:px-8 py-8 sm:py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              Kunjungan portal
            </p>
            <h2 id="statistik-title" className="mt-3 text-sm font-medium text-slate-400">
              Total kunjungan portal
            </h2>
            <p className="mt-1 text-6xl sm:text-7xl font-extrabold tracking-tight text-white">
              <Counter value={stats.totalViews} />
            </p>
            {growth !== null && (
              <p
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  growth >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
                }`}
              >
                <TrendingUp className={`w-3.5 h-3.5 ${growth < 0 ? 'rotate-180' : ''}`} aria-hidden="true" />
                {growth >= 0 ? '+' : ''}
                {growth}% dibanding 7 hari sebelumnya
              </p>
            )}

            <dl className="mt-8 grid grid-cols-3 gap-3">
              {tiles.map(({ label, value, Icon }) => (
                <div key={label} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 sm:p-4">
                  <Icon className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <dd className="mt-2 text-xl sm:text-2xl font-bold text-white">
                    <Counter value={value} />
                  </dd>
                  <dt className="mt-0.5 text-[11px] sm:text-xs text-slate-400 leading-tight">{label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-white">Kunjungan 14 hari terakhir</p>
              <p className="text-xs text-slate-400">
                Hari ini <span className="font-bold text-amber-400">{number.format(stats.todayViews)}</span>
              </p>
            </div>
            <div className="mt-6 flex items-end gap-1.5 sm:gap-2 h-40" role="img" aria-label="Grafik kunjungan 14 hari terakhir">
              {stats.daily.map((d, i) => {
                const isToday = i === stats.daily.length - 1;
                const pct = d.views ? Math.max(6, (d.views / max) * 100) : 2;
                return (
                  <div key={d.date} className="group relative flex-1 min-w-0 h-full flex items-end">
                    <div
                      title={`${shortDay(d.date)}: ${d.views} kunjungan · ${d.visitors} pengunjung`}
                      className={`w-full rounded-t-md transition-[height] duration-700 ease-out ${
                        isToday
                          ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                          : 'bg-gradient-to-t from-white/10 to-white/30 group-hover:from-amber-500/60 group-hover:to-amber-300/80'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                    {d.views > 0 && (
                      <span
                        className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums ${
                          isToday ? 'text-amber-300' : 'text-slate-400 opacity-0 group-hover:opacity-100'
                        }`}
                        style={{ bottom: `calc(${pct}% + 4px)` }}
                      >
                        {d.views}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5 sm:gap-2 border-t border-white/10 pt-2">
              {stats.daily.map((d, i) => (
                <span key={d.date} className="flex-1 min-w-0 text-center text-[10px] text-slate-500 whitespace-nowrap">
                  {i === stats.daily.length - 1 ? 'Hari ini' : i % 3 === 1 ? shortDay(d.date) : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
