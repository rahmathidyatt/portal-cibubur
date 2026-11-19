import React, { useEffect, useMemo, useState } from 'react';
import { ExportButtons } from '../../components/ExportButtons';
import { ColumnChart, RankBars } from '../../components/charts/SimpleCharts';
import { useAdmin } from '../../hooks/useAdmin';
import { todayInJakarta } from '../../utils/schedule';
import { formatLongId, formatRupiah, type MedproDrop, type MedproNota } from './medpro';
import { getMedproStore } from './medproStore';
import { computeMedproStats, medproRecapSheets, medproYears, shortRupiah } from './medproStats';

const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';

/** Menu admin Analisis › Rekap Medpro: biaya banner, alat branding & drop per bulan/tahun. */
export const MedproRecapPage: React.FC = () => {
  const { auth } = useAdmin();
  const [data, setData] = useState<{ notas: MedproNota[]; drops: MedproDrop[] } | null>(null);
  const [year, setYear] = useState<string>(todayInJakarta().slice(0, 4));

  useEffect(() => {
    const store = getMedproStore();
    Promise.all([store.listNotas(auth), store.listDrops(auth)])
      .then(([notas, drops]) => setData({ notas, drops }))
      .catch(() => setData({ notas: [], drops: [] }));
  }, [auth]);

  const years = useMemo(() => {
    const ys = medproYears(data?.notas ?? [], data?.drops ?? []);
    const now = todayInJakarta().slice(0, 4);
    return ys.includes(now) ? ys : [now, ...ys];
  }, [data]);
  const st = computeMedproStats(data?.notas ?? [], data?.drops ?? [], year);
  const printedAt = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });
  const tiles: [string, number, string][] = [
    ['Banner / plank', st.banner, `${st.notaCount} nota`],
    ['Alat branding', st.branding, ''],
    ['Drop banner', st.drop, '']
  ];

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Analisis</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Rekap Medpro</h1>
            <p className="mt-1 text-sm text-slate-600">Biaya banner/plank, alat branding & drop banner Brighton HUB Cibubur.</p>
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
              fileBase={`rekap_medpro_cibubur_${year || 'semua'}`}
              disabled={!data || st.total === 0}
              build={() => medproRecapSheets(data?.notas ?? [], data?.drops ?? [], year, printedAt)}
            />
          </div>
        </div>

        {data === null ? (
          <p className="mt-6 text-sm text-slate-500">Memuat…</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs text-slate-400">Total biaya</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatRupiah(st.total)}</p>
                <p className="text-[11px] text-slate-400">{year ? `Tahun ${year}` : 'Semua tahun'}</p>
              </div>
              {tiles.map(([label, value, note]) => (
                <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{formatRupiah(value)}</p>
                  <p className="text-[11px] text-slate-500">
                    {st.total ? Math.round((value / st.total) * 100) : 0}% dari total{note ? ` · ${note}` : ''}
                  </p>
                </div>
              ))}
            </div>

            <div className={`${card} mt-4`}>
              <h2 className="text-sm font-bold text-slate-950">{year ? `Biaya per bulan · ${year}` : 'Biaya per tahun'}</h2>
              <p className="text-[11px] text-slate-500">Banner/plank + alat branding + drop banner, menurut tanggal nota</p>
              <div className="mt-4">
                {st.timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada data nota.</p>
                ) : (
                  <ColumnChart data={st.timeline} suffix={year} format={formatRupiah} short={shortRupiah} />
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className={card}>
                <h2 className="text-sm font-bold text-slate-950">Pembayaran</h2>
                <p className="mb-3 text-[11px] text-slate-500">Setiap tanggal 14 & 28 (Sabtu/Minggu dimajukan ke Jumat) · 10 terbaru</p>
                <RankBars
                  data={st.payments.slice(0, 10).map((p) => ({ label: formatLongId(p.paidOn), count: p.total }))}
                  empty="Belum ada pembayaran."
                  format={formatRupiah}
                  labelWidth="11rem"
                />
              </div>
              <div className={card}>
                <h2 className="text-sm font-bold text-slate-950">Drop banner per kantor</h2>
                <p className="mb-3 text-[11px] text-slate-500">Total biaya drop menurut kantor tujuan</p>
                <RankBars data={st.dropByOffice.slice(0, 10)} empty="Belum ada drop banner." format={formatRupiah} />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
