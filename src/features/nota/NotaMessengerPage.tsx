import React, { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { minutesNowInJakarta, todayInJakarta } from '../../utils/schedule';
import { CopyTextBlock } from '../../components/CopyTextBlock';
import { buildNotaMessage, buildPhotoMessage } from './notaMessages';
import { canvasToPng, downloadBytes } from '../floortime/posterRenderer';
import {
  calculateTotal,
  DEFAULT_NOTA_CONFIG,
  DEFAULT_REKENING,
  emptyJob,
  exampleOnePoint,
  exampleTwoPoints,
  formatDateDisplay,
  formatNumberId,
  formatRupiah,
  MAX_TEMPLATE_ROWS,
  sanitizeFilename,
  type NotaConfig,
  type NotaJob
} from './notaCalc';
import { notaPdfFromPng, renderNotaCanvas } from './notaRenderer';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'bg-white border border-slate-200 rounded-2xl p-5';
const btn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-lg border cursor-pointer disabled:opacity-50';

export const NotaMessengerPage: React.FC = () => {
  const today = todayInJakarta();
  const [config, setConfig] = useState<NotaConfig>(DEFAULT_NOTA_CONFIG);
  const [tglRequest, setTglRequest] = useState<string>(today);
  const [namaAgent, setNamaAgent] = useState<string>('');
  const [kantor, setKantor] = useState<string>('HUB CIBUBUR');
  const [pembayaran, setPembayaran] = useState<string>('Cash/Transfer');
  const [rekening, setRekening] = useState<string>(DEFAULT_REKENING);
  const [estimasi, setEstimasi] = useState<string>(today);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [jobs, setJobs] = useState<NotaJob[]>([emptyJob()]);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => calculateTotal(distanceKm, jobs, config), [distanceKm, jobs, config]);
  const meta = { tglRequest, namaAgent, kantor, pembayaran, rekening, estimasiTanggal: estimasi };
  const fileSuffix = sanitizeFilename(`${formatDateDisplay(tglRequest)}_${namaAgent || 'agent'}`);

  // Pratinjau diperbarui sesaat setelah input berhenti berubah.
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const canvas = await renderNotaCanvas(meta, jobs, result, config);
        if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal membuat pratinjau.');
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tglRequest, namaAgent, kantor, pembayaran, rekening, estimasi, jobs, result, config]);

  const download = async (kind: 'png' | 'pdf') => {
    const png = await canvasToPng(await renderNotaCanvas(meta, jobs, result, config));
    if (kind === 'png') downloadBytes(png, `nota_smart_messenger_${fileSuffix}.png`, 'image/png');
    else downloadBytes(await notaPdfFromPng(png), `nota_smart_messenger_${fileSuffix}.pdf`, 'application/pdf');
  };

  const applyExample = (ex: { distanceKm: number; jobs: NotaJob[]; namaAgent: string }) => {
    setDistanceKm(ex.distanceKm);
    setJobs(ex.jobs);
    setNamaAgent(ex.namaAgent);
    setKantor('HUB CIBUBUR');
    setPembayaran('Cash/Transfer');
    setRekening(DEFAULT_REKENING);
  };

  const updateJob = (i: number, patch: Partial<NotaJob>) => setJobs(jobs.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <section className="bg-stone-50 min-h-[70vh] py-8 sm:py-12">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <p className="text-xs text-slate-500">Operasional</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">Nota Smart Messenger</h1>
        <p className="mt-1 text-sm text-slate-600">Hitung tagihan messenger pemasangan banner dan unduh notanya.</p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div className={card}>
              <p className="text-sm font-bold text-slate-950">1. Data request</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-700">
                  Tgl request
                  <input type="date" value={tglRequest} onChange={(e) => setTglRequest(e.target.value)} className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Estimasi pengerjaan
                  <input type="date" value={estimasi} onChange={(e) => setEstimasi(e.target.value)} className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Nama agent
                  <input value={namaAgent} onChange={(e) => setNamaAgent(e.target.value)} placeholder="Mis. RUDY" className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Kantor
                  <input value={kantor} onChange={(e) => setKantor(e.target.value)} className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Pembayaran
                  <select value={pembayaran} onChange={(e) => setPembayaran(e.target.value)} className={`${input} mt-1`}>
                    {['Cash/Transfer', 'Cash', 'Transfer'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  No rekening (jika transfer)
                  <input value={rekening} onChange={(e) => setRekening(e.target.value)} className={`${input} mt-1`} />
                </label>
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-950">2. Data pekerjaan</p>
                <button
                  type="button"
                  disabled={jobs.length >= MAX_TEMPLATE_ROWS}
                  onClick={() => setJobs([...jobs, emptyJob()])}
                  className={`${btn} border-slate-300 bg-white text-slate-800`}
                >
                  <Plus className="w-4 h-4" />
                  Titik
                </button>
              </div>
              <label className="mt-3 block text-xs font-semibold text-slate-700">
                Jarak akumulasi (KM) — total perjalanan, bukan per alamat
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={distanceKm || ''}
                  onChange={(e) => setDistanceKm(Math.max(0, num(e.target.value)))}
                  className={`${input} mt-1`}
                />
              </label>
              <ul className="mt-3 space-y-3">
                {jobs.map((job, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Titik {i + 1}</span>
                      {jobs.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Hapus titik ${i + 1}`}
                          onClick={() => setJobs(jobs.filter((_, idx) => idx !== i))}
                          className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <textarea
                      aria-label={`Alamat titik ${i + 1}`}
                      value={job.alamat}
                      onChange={(e) => updateJob(i, { alamat: e.target.value })}
                      placeholder="Alamat lengkap, mis. Workshop Multiteknik, Jl. Alternatif Cibubur No. 12"
                      rows={2}
                      className={`${input} resize-y min-h-[2.75rem] [field-sizing:content] leading-snug`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input aria-label={`Tugas titik ${i + 1}`} value={job.tugas} onChange={(e) => updateJob(i, { tugas: e.target.value })} placeholder="Tugas" className={input} />
                      <input aria-label={`Keterangan titik ${i + 1}`} value={job.keterangan} onChange={(e) => updateJob(i, { keterangan: e.target.value })} placeholder="Keterangan (opsional)" className={input} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <details className={card}>
              <summary className="text-sm font-bold text-slate-950 cursor-pointer">Aturan perhitungan & data contoh</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(
                  [
                    ['tariffPerKm', 'Tarif BBM per KM', 100],
                    ['minimumDistanceKm', 'Batas minimum jarak (KM)', 0.5],
                    ['minimumBbm', 'Tarif minimum BBM', 500],
                    ['serviceFeePerPoint', 'Biaya jasa per titik', 500]
                  ] as const
                ).map(([key, label, step]) => (
                  <label key={key} className="text-xs font-semibold text-slate-700">
                    {label}
                    <input
                      type="number"
                      min={0}
                      step={step}
                      value={config[key]}
                      onChange={(e) => setConfig({ ...config, [key]: Math.max(0, num(e.target.value)) })}
                      className={`${input} mt-1`}
                    />
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={config.enableMinimumBbm}
                  onChange={(e) => setConfig({ ...config, enableMinimumBbm: e.target.checked })}
                />
                Aktifkan tarif minimum BBM
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => applyExample(exampleOnePoint())} className={`${btn} border-slate-300 bg-white text-slate-800`}>
                  Contoh 1 alamat
                </button>
                <button type="button" onClick={() => applyExample(exampleTwoPoints())} className={`${btn} border-slate-300 bg-white text-slate-800`}>
                  Contoh 2 alamat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDistanceKm(0);
                    setJobs([emptyJob()]);
                    setNamaAgent('');
                  }}
                  className={`${btn} border-slate-300 bg-white text-slate-800`}
                >
                  Kosongkan form
                </button>
              </div>
            </details>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Titik', String(result.jobCount)],
                ['BBM', formatRupiah(result.bbmFee)],
                ['Jasa', formatRupiah(result.serviceFee)],
                ['Total', formatRupiah(result.total)]
              ].map(([label, value]) => (
                <div key={label} className={`${card} !p-4`}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-0.5 font-bold text-slate-950 ${label === 'Total' ? 'text-lg' : 'text-base'}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className={`${card} text-sm text-slate-700 space-y-1`}>
              <p>
                BBM awal: {formatNumberId(result.distanceKm)} KM × {formatRupiah(config.tariffPerKm)} = {formatRupiah(result.rawBbmFee)}
              </p>
              <p>
                BBM dipakai: <b>{formatRupiah(result.bbmFee)}</b>. {result.minimumNote}
              </p>
              <p>
                Jasa pasang: {result.jobCount} titik × {formatRupiah(config.serviceFeePerPoint)} = {formatRupiah(result.serviceFee)}
              </p>
              <p className="pt-1 font-bold text-slate-950">Total tagihan: {formatRupiah(result.total)}</p>
            </div>
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-950">Pratinjau nota</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void download('pdf')} className={`${btn} border-amber-400 bg-amber-400 text-slate-950`}>
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                  <button type="button" onClick={() => void download('png')} className={`${btn} border-slate-300 bg-white text-slate-800`}>
                    <Download className="w-4 h-4" />
                    Gambar
                  </button>
                </div>
              </div>
              {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
              {previewUrl ? (
                <img src={previewUrl} alt="Pratinjau nota smart messenger" className="mt-3 w-full rounded-lg border border-slate-200" />
              ) : (
                <p className="mt-3 text-sm text-slate-500">Membuat pratinjau…</p>
              )}
            </div>
            <div className={`${card} space-y-3`}>
              <div>
                <p className="text-sm font-bold text-slate-950">Pesan WhatsApp untuk agen</p>
                <p className="mt-0.5 text-xs text-slate-500">Bahasa formal & sopan, siap disalin. Sesuaikan bila perlu sebelum dikirim.</p>
              </div>
              <CopyTextBlock text={buildNotaMessage(meta, jobs, result, minutesNowInJakarta())} label="BC kirim nota" rows={12} />
              <CopyTextBlock text={buildPhotoMessage(meta, jobs, minutesNowInJakarta())} label="BC kirim foto dokumentasi" rows={9} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
