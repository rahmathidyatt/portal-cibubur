import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ColumnChart, RankBars } from '../../components/charts/SimpleCharts';
import { todayInJakarta } from '../../utils/schedule';
import {
  DEFAULT_LIMITS,
  MODE_LABEL,
  STATUS_LABEL,
  countBy,
  dailyCounts,
  quotaWindowStart,
  topQuestions,
  usageToday,
  type GeminiLimits,
  type ModelLabel,
  type UsageRow,
  type UsageStatus
} from './aiUsage';
import { getLimits, listUsage, saveLimits } from './aiUsageStore';

const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';
const input =
  'w-24 px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400';

const STATUS_TONE: Record<UsageStatus, string> = {
  ok: 'text-emerald-700',
  busy: 'text-amber-700',
  rate_limit: 'text-red-700',
  timeout: 'text-amber-700',
  error: 'text-red-700'
};

function hhmmWib(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3600_000);
  return `${String(t.getUTCHours()).padStart(2, '0')}.${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

/** Menu admin Analisis › Penggunaan Gemini. */
export const AiUsagePage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [limits, setLimits] = useState<GeminiLimits>(DEFAULT_LIMITS);
  const [editing, setEditing] = useState<GeminiLimits | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([listUsage(auth), getLimits()]);
      setRows(r);
      setLimits(l);
      setNow(new Date());
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat penggunaan Gemini.', 'error');
      setRows([]);
    }
  }, [auth, toast]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const data = rows ?? [];
  const today = useMemo(() => usageToday(data, now), [data, now]);
  const resetAt = useMemo(() => new Date(quotaWindowStart(now).getTime() + 86_400_000), [now]);
  const daily = useMemo(() => dailyCounts(data, todayInJakarta(now), 30), [data, now]);
  const byMode = useMemo(() => countBy(data, (r) => MODE_LABEL[r.mode] ?? r.mode), [data]);
  const byStatus = useMemo(() => countBy(data, (r) => r.status), [data]);
  const questions = useMemo(() => topQuestions(data), [data]);
  const okRows = data.filter((r) => r.status === 'ok' && r.durationMs !== null);
  const avgSec = okRows.length ? okRows.reduce((s, r) => s + (r.durationMs ?? 0), 0) / okRows.length / 1000 : 0;
  const fallbackCount = data.filter((r) => r.fallback).length;

  const quota: { label: ModelLabel; used: number; limit: number; hint: string }[] = [
    { label: 'Flash', used: today.Flash, limit: limits.flash, hint: 'Epigram, ucapan, scan nota' },
    { label: 'Flash-Lite', used: today['Flash-Lite'], limit: limits.lite, hint: 'Terjemahan EN & cadangan saat Flash sibuk' }
  ];

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Ringkasan · Analisis</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950">
          <Sparkles className="h-6 w-6 text-amber-600" aria-hidden="true" />
          Penggunaan Gemini
        </h1>

        {rows === null ? (
          <p className="py-16 text-center text-sm text-slate-500">Memuat…</p>
        ) : (
          <>
            {/* Jatah hari ini */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {quota.map((q) => {
                const pct = Math.min(100, Math.round((q.used / q.limit) * 100));
                const left = Math.max(0, q.limit - q.used);
                const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                  <div key={q.label} className={card}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-slate-950">Gemini {q.label}</p>
                      <p className="text-xs text-slate-500">{q.hint}</p>
                    </div>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950">
                      {q.used}
                      <span className="text-base font-semibold text-slate-400"> / {q.limit}</span>
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {left > 0 ? `Sisa sekitar ${left} permintaan` : 'Jatah habis — otomatis memakai model cadangan'} · reset pukul {hhmmWib(resetAt)} WIB
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {editing ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveLimits(editing, auth)
                      .then(() => {
                        setLimits(editing);
                        setEditing(null);
                        toast('Batas harian disimpan.');
                      })
                      .catch((err) => toast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error'));
                  }}
                >
                  Flash
                  <input className={input} inputMode="numeric" value={editing.flash} onChange={(e) => setEditing({ ...editing, flash: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Batas harian Flash" />
                  Flash-Lite
                  <input className={input} inputMode="numeric" value={editing.lite} onChange={(e) => setEditing({ ...editing, lite: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Batas harian Flash-Lite" />
                  <button type="submit" className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-slate-950 hover:bg-amber-500 cursor-pointer">
                    Simpan
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="px-2 py-1.5 font-semibold text-slate-600 cursor-pointer">
                    Batal
                  </button>
                </form>
              ) : (
                <>
                  <span>Batas harian mengikuti halaman Rate limit di Google AI Studio; angka pemakaian adalah perkiraan dari catatan portal.</span>
                  <button type="button" onClick={() => setEditing(limits)} className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-950 cursor-pointer">
                    <Pencil className="h-3.5 w-3.5" /> Ubah batas
                  </button>
                </>
              )}
            </div>

            {/* Status 30 hari */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(['ok', 'busy', 'rate_limit', 'timeout', 'error'] as UsageStatus[]).map((s) => {
                const n = byStatus.find((x) => x.label === s)?.count ?? 0;
                return (
                  <div key={s} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="text-xs font-semibold text-slate-500">{STATUS_LABEL[s]}</p>
                    <p className={`mt-1 text-2xl font-bold tabular-nums ${n > 0 ? STATUS_TONE[s] : 'text-slate-400'}`}>{n}</p>
                  </div>
                );
              })}
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold text-slate-500">Rata-rata respons</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{avgSec ? `${avgSec.toFixed(1)} dtk` : '—'}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">30 hari terakhir · {fallbackCount} kali dialihkan ke model cadangan.</p>

            <div className={`${card} mt-6`}>
              <h2 className="text-base font-bold text-slate-950">Panggilan Gemini per hari (30 hari)</h2>
              <div className="mt-4">
                <ColumnChart data={daily.map((d) => ({ label: d.date.slice(8, 10), count: d.count }))} suffix="" format={(n) => `${n} panggilan`} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className={card}>
                <h2 className="text-base font-bold text-slate-950">Per fitur (30 hari)</h2>
                <div className="mt-4">
                  <RankBars data={byMode} empty="Belum ada pemakaian." labelWidth="10rem" />
                </div>
              </div>
              <div className={card}>
                <h2 className="text-base font-bold text-slate-950">Pertanyaan Epigram terbanyak</h2>
                <div className="mt-4">
                  <RankBars data={questions} empty="Belum ada pertanyaan yang dijawab Gemini." labelWidth="14rem" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
