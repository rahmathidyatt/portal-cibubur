import React, { useEffect, useMemo, useState } from 'react';
import { ExportButtons } from '../../components/ExportButtons';
import { todayInJakarta } from '../../utils/schedule';
import { CLOSING_TYPES, type Closing } from './closing';
import { getClosingStore } from './closingStore';
import { closingRecapSheets, closingYears, computeStats } from './closingStats';
import { ColumnChart, RankBars } from '../../components/charts/SimpleCharts';

const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';

/** Menu admin Closing › Rekap Closing: analisis closing per bulan/tahun, jenis, unit, agen & lokasi. */
export const ClosingRecapPage: React.FC = () => {
  const [all, setAll] = useState<Closing[] | null>(null);
  const [year, setYear] = useState<string>(todayInJakarta().slice(0, 4));

  useEffect(() => {
    getClosingStore()
      .list()
      .then(setAll)
      .catch(() => setAll([]));
  }, []);

  const years = useMemo(() => {
    const ys = closingYears(all ?? []);
    const now = todayInJakarta().slice(0, 4);
    return ys.includes(now) ? ys : [now, ...ys];
  }, [all]);
  const stats = computeStats(all ?? [], year);
  const printedAt = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Analisis</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Rekap Closing</h1>
            <p className="mt-1 text-sm text-slate-600">Analisis closing Brighton HUB Cibubur. Data closing disimpan permanen untuk rekap tahunan.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-label="Tahun"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
              <option value="">Semua tahun</option>
            </select>
            <ExportButtons
              pdf={false}
              fileBase={`rekap_closing_cibubur_${year || 'semua'}`}
              disabled={!all || stats.total === 0}
              build={() => closingRecapSheets(all ?? [], year, printedAt)}
            />
          </div>
        </div>

        {all === null ? (
          <p className="mt-6 text-sm text-slate-500">Memuat…</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs text-slate-400">Total closing</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{stats.total}</p>
                <p className="text-[11px] text-slate-400">{year ? `Tahun ${year}` : 'Semua tahun'}</p>
              </div>
              {CLOSING_TYPES.map((t) => (
                <div key={t} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">{t}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">{stats.byType[t]}</p>
                  <p className="text-[11px] text-slate-500">
                    {stats.total ? Math.round((stats.byType[t] / stats.total) * 100) : 0}% dari total
                  </p>
                </div>
              ))}
            </div>

            <div className={`${card} mt-4`}>
              <h2 className="text-sm font-bold text-slate-950">{year ? `Closing per bulan · ${year}` : 'Closing per tahun'}</h2>
              <div className="mt-4">
                {stats.timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada data closing.</p>
                ) : (
                  <ColumnChart data={stats.timeline} suffix={year} format={(n) => `${n} closing`} />
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className={card}>
                <h2 className="text-sm font-bold text-slate-950">Per unit</h2>
                <p className="mb-3 text-[11px] text-slate-500">Jumlah transaksi yang melibatkan unit</p>
                <RankBars data={stats.byUnit} empty="Belum ada data." />
              </div>
              <div className={card}>
                <h2 className="text-sm font-bold text-slate-950">Agen terbanyak closing</h2>
                <p className="mb-3 text-[11px] text-slate-500">10 teratas · tanpa Project Leader</p>
                <RankBars data={stats.byAgent} empty="Belum ada data." />
              </div>
              <div className={card}>
                <h2 className="text-sm font-bold text-slate-950">Lokasi / properti</h2>
                <p className="mb-3 text-[11px] text-slate-500">10 teratas</p>
                <RankBars data={stats.byLocation} empty="Belum ada data." />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
