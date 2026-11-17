import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Eye, FileText, Monitor, RefreshCw, Smartphone, Tablet, TrendingUp, Users } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { getViewStats, pageLabel, whenVisitRecorded, type ViewStats } from '../../services/analytics';
import { MONTH_NAMES_ID } from '../floortime/engine';

const number = new Intl.NumberFormat('id-ID');
const RANGES = [7, 30, 90] as const;

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES_ID[m - 1].slice(0, 3)}`;
}

/** Angka yang "naik" dari 0 saat tampil (tanpa animasi bila pengguna memilih reduced motion). */
function useCountUp(target: number, duration = 900): number {
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

const Counter: React.FC<{ value: number }> = ({ value }) => (
  <span className="tabular-nums">{number.format(useCountUp(value))}</span>
);

/** Menu admin "Statistik portal": kunjungan portal (khusus admin). */
export const PortalStatsPage: React.FC = () => {
  const { auth } = useAdmin();
  const [days, setDays] = useState<number>(7);
  const [stats, setStats] = useState<ViewStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await whenVisitRecorded();
      setStats(await getViewStats(auth, days));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat statistik.');
    } finally {
      setLoading(false);
    }
  }, [auth, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Ringkasan</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Statistik portal</h1>
            <p className="mt-1 text-sm text-slate-600">
              Satu kunjungan = satu sesi browser. Halaman yang dibuka dihitung sekali per sesi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Rentang waktu" className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={days === r}
                  onClick={() => setDays(r)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    days === r ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {r} hari
                </button>
              ))}
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
        </div>

        {error && <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {!stats && !error && (
          <div className="mt-6 h-80 rounded-3xl bg-slate-200/70 animate-pulse" aria-label="Memuat statistik" />
        )}

        {stats && (
          <>
            <div className="mt-6 overflow-hidden rounded-3xl">
              <StatsHero stats={stats} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <TopPages stats={stats} />
              <PeakHours stats={stats} />
              <Devices stats={stats} />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const StatsHero: React.FC<{ stats: ViewStats }> = ({ stats }) => {
  const max = Math.max(1, ...stats.daily.map((d) => d.views));
  const growth =
    stats.prevRangeViews > 0 ? Math.round(((stats.rangeViews - stats.prevRangeViews) / stats.prevRangeViews) * 100) : null;
  const dense = stats.daily.length > 31;
  const labelEvery = stats.daily.length <= 7 ? 1 : stats.daily.length <= 14 ? 3 : stats.daily.length <= 31 ? 5 : 15;

  const tiles = [
    { label: `Pengunjung unik · ${stats.rangeDays} hari`, value: stats.rangeVisitors, Icon: Users },
    { label: 'Kunjungan hari ini', value: stats.todayViews, Icon: Eye },
    { label: `Halaman dibuka · ${stats.rangeDays} hari`, value: stats.pageViews, Icon: FileText }
  ];

  return (
    <div aria-labelledby="statistik-title" className="relative overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
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
              Kunjungan {stats.rangeDays} hari terakhir
            </h2>
            <p className="mt-1 text-6xl sm:text-7xl font-extrabold tracking-tight text-white">
              <Counter value={stats.rangeViews} />
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {growth !== null && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    growth >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
                  }`}
                >
                  <TrendingUp className={`w-3.5 h-3.5 ${growth < 0 ? 'rotate-180' : ''}`} aria-hidden="true" />
                  {growth >= 0 ? '+' : ''}
                  {growth}% dibanding {stats.rangeDays} hari sebelumnya
                </span>
              )}
              <span className="text-xs text-slate-400">
                Total sepanjang waktu: <b className="text-slate-200">{number.format(stats.totalViews)}</b> kunjungan ·{' '}
                {number.format(stats.uniqueVisitors)} pengunjung
              </span>
            </div>

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
              <p className="text-sm font-semibold text-white">Kunjungan per hari</p>
              <p className="text-xs text-slate-400">
                Hari ini <span className="font-bold text-amber-400">{number.format(stats.todayViews)}</span>
              </p>
            </div>
            <div
              className={`mt-6 flex items-end h-40 ${dense ? 'gap-px' : 'gap-1 sm:gap-1.5'}`}
              role="img"
              aria-label={`Grafik kunjungan ${stats.rangeDays} hari terakhir`}
            >
              {stats.daily.map((d, i) => {
                const isToday = i === stats.daily.length - 1;
                const pct = d.views ? Math.max(6, (d.views / max) * 100) : 2;
                return (
                  <div key={d.date} className="group relative flex-1 min-w-0 h-full flex items-end">
                    <div
                      title={`${shortDay(d.date)}: ${d.views} kunjungan · ${d.visitors} pengunjung`}
                      className={`w-full rounded-t-sm transition-[height] duration-700 ease-out ${
                        isToday
                          ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                          : 'bg-gradient-to-t from-white/10 to-white/30 group-hover:from-amber-500/60 group-hover:to-amber-300/80'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                    {!dense && d.views > 0 && (
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
            <div className={`mt-2 flex border-t border-white/10 pt-2 ${dense ? 'gap-px' : 'gap-1 sm:gap-1.5'}`}>
              {stats.daily.map((d, i) => {
                const last = i === stats.daily.length - 1;
                return (
                  <span key={d.date} className="relative flex-1 min-w-0 h-3 text-[10px] text-slate-500">
                    {(last || (stats.daily.length - 1 - i) % labelEvery === 0) && (
                      <span className={`absolute top-0 whitespace-nowrap ${last ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                        {last ? 'Hari ini' : shortDay(d.date)}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const panel = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';

const PanelTitle: React.FC<{ Icon: typeof Eye; title: string; note?: string }> = ({ Icon, title, note }) => (
  <div className="flex items-baseline justify-between gap-2">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {title}
    </h3>
    {note && <span className="text-[11px] text-slate-500">{note}</span>}
  </div>
);

const Empty: React.FC = () => <p className="mt-4 text-sm text-slate-500">Belum ada data di rentang ini.</p>;

const TopPages: React.FC<{ stats: ViewStats }> = ({ stats }) => {
  const max = Math.max(1, ...stats.topPages.map((p) => p.views));
  return (
    <section className={panel}>
      <PanelTitle Icon={FileText} title="Halaman terpopuler" note={`${stats.rangeDays} hari`} />
      {stats.topPages.length === 0 ? (
        <Empty />
      ) : (
        <ol className="mt-4 space-y-2.5">
          {stats.topPages.map((p) => (
            <li key={p.path}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-slate-800">{pageLabel(p.path)}</span>
                <span className="tabular-nums font-semibold text-slate-950">{number.format(p.views)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(p.views / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const PeakHours: React.FC<{ stats: ViewStats }> = ({ stats }) => {
  const max = Math.max(0, ...stats.hours);
  const peak = max > 0 ? stats.hours.indexOf(max) : -1;
  const pad = (h: number) => String(h).padStart(2, '0');
  return (
    <section className={panel}>
      <PanelTitle Icon={Clock} title="Jam paling ramai" note="WIB" />
      {max === 0 ? (
        <Empty />
      ) : (
        <>
          <p className="mt-3 text-2xl font-bold text-slate-950 tabular-nums">
            {pad(peak)}.00–{pad((peak + 1) % 24)}.00
          </p>
          <p className="text-xs text-slate-500">{number.format(max)} kunjungan dimulai di jam ini</p>
          <div className="mt-4 flex h-20 items-end gap-px" role="img" aria-label="Kunjungan per jam">
            {stats.hours.map((n, h) => (
              <div
                key={h}
                title={`${pad(h)}.00: ${n} kunjungan`}
                className={`flex-1 rounded-t-sm ${h === peak ? 'bg-amber-400' : 'bg-slate-200'}`}
                style={{ height: `${n ? Math.max(6, (n / max) * 100) : 3}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400 tabular-nums">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </>
      )}
    </section>
  );
};

const Devices: React.FC<{ stats: ViewStats }> = ({ stats }) => {
  const rows = [
    { key: 'mobile' as const, label: 'HP', Icon: Smartphone, color: 'bg-amber-400' },
    { key: 'desktop' as const, label: 'Komputer', Icon: Monitor, color: 'bg-slate-900' },
    { key: 'tablet' as const, label: 'Tablet', Icon: Tablet, color: 'bg-amber-200' },
    { key: 'unknown' as const, label: 'Belum tercatat', Icon: Eye, color: 'bg-slate-200' }
  ].filter((r) => r.key !== 'unknown' || stats.devices.unknown > 0);
  const total = rows.reduce((s, r) => s + stats.devices[r.key], 0);
  return (
    <section className={panel}>
      <PanelTitle Icon={Smartphone} title="Perangkat pengunjung" note={`${stats.rangeDays} hari`} />
      {total === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {rows.map((r) =>
              stats.devices[r.key] ? (
                <div key={r.key} className={r.color} style={{ width: `${(stats.devices[r.key] / total) * 100}%` }} />
              ) : null
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {rows.map(({ key, label, Icon, color }) => (
              <li key={key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  {label}
                </span>
                <span className="tabular-nums text-slate-950">
                  <b>{Math.round((stats.devices[key] / total) * 100)}%</b>
                  <span className="ml-1.5 text-xs text-slate-500">({number.format(stats.devices[key])})</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
