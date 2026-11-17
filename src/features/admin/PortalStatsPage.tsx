import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Eye, Monitor, RefreshCw, Smartphone, Tablet, TrendingUp, Users } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { getViewStats, whenVisitRecorded, type ViewStats } from '../../services/analytics';
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
          <div className="mt-6 h-40 rounded-2xl bg-slate-200/60 animate-pulse" aria-label="Memuat statistik" />
        )}

        {stats && (
          <>
            <div className="mt-6">
              <StatsHero stats={stats} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
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
    { label: `Kunjungan · ${stats.rangeDays} hari`, value: stats.rangeViews, Icon: Eye },
    { label: 'Pengunjung unik', value: stats.rangeVisitors, Icon: Users },
    { label: 'Kunjungan hari ini', value: stats.todayViews, Icon: Clock },
    { label: 'Total sepanjang waktu', value: stats.totalViews, Icon: TrendingUp }
  ];

  return (
    <div aria-labelledby="statistik-title" className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200 backdrop-blur sm:p-5">
      <h2 id="statistik-title" className="sr-only">
        Kunjungan portal
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        {tiles.map(({ label, value, Icon }, i) => (
          <div key={label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-950">
                <Counter value={value} />
              </span>
              {i === 0 && growth !== null && (
                <span className={`text-xs font-semibold ${growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}%
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div
          className={`flex h-20 items-end ${dense ? 'gap-px' : 'gap-1'}`}
          role="img"
          aria-label={`Grafik kunjungan ${stats.rangeDays} hari terakhir`}
        >
          {stats.daily.map((d, i) => {
            const isToday = i === stats.daily.length - 1;
            const pct = d.views ? Math.max(6, (d.views / max) * 100) : 3;
            return (
              <div
                key={d.date}
                title={`${shortDay(d.date)}: ${d.views} kunjungan · ${d.visitors} pengunjung`}
                className={`flex-1 min-w-0 rounded-t-sm ${isToday ? 'bg-slate-700' : 'bg-slate-300 hover:bg-slate-400'}`}
                style={{ height: `${pct}%` }}
              />
            );
          })}
        </div>
        <div className={`mt-1 flex ${dense ? 'gap-px' : 'gap-1'}`}>
          {stats.daily.map((d, i) => {
            const last = i === stats.daily.length - 1;
            return (
              <span key={d.date} className="relative h-3 flex-1 min-w-0 text-[10px] text-slate-500">
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
  );
};

const panel = 'rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200';

const PanelTitle: React.FC<{ Icon: typeof Eye; title: string; note?: string }> = ({ Icon, title, note }) => (
  <div className="flex items-baseline justify-between gap-2">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
      <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
      {title}
    </h3>
    {note && <span className="text-[11px] text-slate-500">{note}</span>}
  </div>
);

const Empty: React.FC = () => <p className="mt-4 text-sm text-slate-500">Belum ada data di rentang ini.</p>;

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
          <p className="mt-2 text-xl font-bold text-slate-950 tabular-nums">
            {pad(peak)}.00–{pad((peak + 1) % 24)}.00
          </p>
          <p className="text-xs text-slate-500">{number.format(max)} kunjungan dimulai di jam ini</p>
          <div className="mt-3 flex h-14 items-end gap-px" role="img" aria-label="Kunjungan per jam">
            {stats.hours.map((n, h) => (
              <div
                key={h}
                title={`${pad(h)}.00: ${n} kunjungan`}
                className={`flex-1 rounded-t-sm ${h === peak ? 'bg-slate-700' : 'bg-slate-200'}`}
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
    { key: 'mobile' as const, label: 'HP', Icon: Smartphone, color: 'bg-slate-700' },
    { key: 'desktop' as const, label: 'Komputer', Icon: Monitor, color: 'bg-slate-400' },
    { key: 'tablet' as const, label: 'Tablet', Icon: Tablet, color: 'bg-slate-300' },
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
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
            {rows.map((r) =>
              stats.devices[r.key] ? (
                <div key={r.key} className={r.color} style={{ width: `${(stats.devices[r.key] / total) * 100}%` }} />
              ) : null
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
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
