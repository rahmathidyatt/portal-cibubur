import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import {
  calculateBphtb,
  calculateCommission,
  calculateKpr,
  calculatePphFinal,
  formatRupiah,
  formatThousands,
  parseRupiahInput
} from '../utils/calculators';

type CalcTab = 'kpr' | 'pajak' | 'komisi';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'kpr', label: 'Cicilan KPR' },
  { id: 'pajak', label: 'BPHTB & PPh' },
  { id: 'komisi', label: 'Komisi' }
];

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

const RupiahField: React.FC<{
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}> = ({ id, label, value, onChange, hint }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        value={formatThousands(value)}
        onChange={(e) => onChange(parseRupiahInput(e.target.value))}
        className={`${inputClass} pl-9 font-mono`}
      />
    </div>
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);

const NumberField: React.FC<{
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  step?: number;
  min?: number;
  max?: number;
}> = ({ id, label, value, onChange, suffix, step = 0.1, min = 0, max }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={`${inputClass} pr-14 font-mono`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span>
    </div>
  </div>
);

const ResultRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong
}) => (
  <div className="flex items-baseline justify-between gap-4 py-2">
    <span className="text-sm text-slate-600">{label}</span>
    <span className={`font-mono text-right ${strong ? 'text-lg font-bold text-slate-950' : 'text-sm text-slate-900'}`}>
      {value}
    </span>
  </div>
);

export const PropertyCalculators: React.FC = () => {
  const [tab, setTab] = useState<CalcTab>('kpr');

  // KPR
  const [price, setPrice] = useState<number>(1_000_000_000);
  const [dpPct, setDpPct] = useState<number>(20);
  const [ratePct, setRatePct] = useState<number>(7.5);
  const [years, setYears] = useState<number>(15);

  // Pajak
  const [txValue, setTxValue] = useState<number>(1_000_000_000);
  const [npoptkp, setNpoptkp] = useState<number>(80_000_000);
  const [bphtbRate, setBphtbRate] = useState<number>(5);
  const [pphRate, setPphRate] = useState<number>(2.5);

  // Komisi
  const [commValue, setCommValue] = useState<number>(1_000_000_000);
  const [commPct, setCommPct] = useState<number>(2.5);
  const [advisorPct, setAdvisorPct] = useState<number>(50);

  const kpr = calculateKpr(price, dpPct, ratePct, years);
  const bphtb = calculateBphtb(txValue, npoptkp, bphtbRate);
  const pph = calculatePphFinal(txValue, pphRate);
  const comm = calculateCommission(commValue, commPct, advisorPct);

  return (
    <section id="kalkulator" className="scroll-mt-20 py-12 sm:py-16 bg-stone-50 border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              <Calculator className="w-6 h-6 text-slate-400" />
              Kalkulator transaksi
            </h2>
            <p className="mt-2 text-base text-slate-600 max-w-xl">
              Hitung perkiraan cicilan, pajak, dan komisi untuk diskusi awal dengan klien.
            </p>
          </div>
          <div role="tablist" aria-label="Jenis kalkulator" className="flex flex-wrap gap-1 p-1 bg-slate-200/70 rounded-xl self-start">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  tab === t.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            {tab === 'kpr' && (
              <>
                <RupiahField id="kpr-price" label="Harga properti" value={price} onChange={setPrice} />
                <div className="grid grid-cols-3 gap-3">
                  <NumberField id="kpr-dp" label="Uang muka" value={dpPct} onChange={setDpPct} suffix="%" step={1} max={100} />
                  <NumberField id="kpr-rate" label="Bunga/tahun" value={ratePct} onChange={setRatePct} suffix="%" />
                  <NumberField id="kpr-years" label="Tenor" value={years} onChange={setYears} suffix="thn" step={1} max={30} />
                </div>
              </>
            )}
            {tab === 'pajak' && (
              <>
                <RupiahField
                  id="tax-value"
                  label="Nilai transaksi / NPOP"
                  value={txValue}
                  onChange={setTxValue}
                  hint="Gunakan nilai transaksi atau NJOP, mana yang lebih tinggi."
                />
                <RupiahField
                  id="tax-npoptkp"
                  label="NPOPTKP"
                  value={npoptkp}
                  onChange={setNpoptkp}
                  hint="Minimal Rp80 juta (UU HKPD); besaran pasti ditetapkan Perda Kabupaten Bogor."
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField id="tax-bphtb" label="Tarif BPHTB" value={bphtbRate} onChange={setBphtbRate} suffix="%" max={5} />
                  <NumberField id="tax-pph" label="Tarif PPh final" value={pphRate} onChange={setPphRate} suffix="%" />
                </div>
              </>
            )}
            {tab === 'komisi' && (
              <>
                <RupiahField id="comm-value" label="Nilai transaksi" value={commValue} onChange={setCommValue} />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField id="comm-pct" label="Komisi kantor" value={commPct} onChange={setCommPct} suffix="%" />
                  <NumberField id="comm-share" label="Bagian advisor" value={advisorPct} onChange={setAdvisorPct} suffix="%" step={1} max={100} />
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6" aria-live="polite">
            <p className="text-xs font-semibold text-amber-700">Hasil perkiraan</p>
            <div className="mt-2 divide-y divide-slate-100">
              {tab === 'kpr' && (
                <>
                  <ResultRow label="Cicilan per bulan" value={formatRupiah(kpr.monthly)} strong />
                  <ResultRow label="Uang muka" value={formatRupiah(kpr.downPayment)} />
                  <ResultRow label="Pokok pinjaman" value={formatRupiah(kpr.principal)} />
                  <ResultRow label="Total bunga" value={formatRupiah(kpr.totalInterest)} />
                </>
              )}
              {tab === 'pajak' && (
                <>
                  <ResultRow label="BPHTB (dibayar pembeli)" value={formatRupiah(bphtb)} strong />
                  <ResultRow label="PPh final (dibayar penjual)" value={formatRupiah(pph)} strong />
                  <ResultRow label="Dasar BPHTB (NPOP − NPOPTKP)" value={formatRupiah(Math.max(0, txValue - npoptkp))} />
                </>
              )}
              {tab === 'komisi' && (
                <>
                  <ResultRow label="Komisi bruto" value={formatRupiah(comm.gross)} strong />
                  <ResultRow label="Bagian advisor" value={formatRupiah(comm.advisorShare)} />
                  <ResultRow label="Bagian kantor" value={formatRupiah(comm.officeShare)} />
                </>
              )}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              {tab === 'kpr' &&
                'Bunga anuitas tetap sepanjang tenor. Bunga KPR sebenarnya bisa berjenjang (fixed lalu floating) dan belum termasuk biaya provisi, asuransi, dan notaris.'}
              {tab === 'pajak' &&
                'PPh final 2,5% berlaku umum (PP 34/2016); rumah sederhana dikenakan 1%. Angka final mengikuti validasi Bapenda dan kantor pajak.'}
              {tab === 'komisi' &&
                'Belum dipotong pajak penghasilan advisor. Persentase mengikuti perjanjian kerja sama yang berlaku.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
