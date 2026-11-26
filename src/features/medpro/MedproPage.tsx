import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CalendarClock, ChevronDown, FileSpreadsheet, MessageCircle, Plus, Undo2, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { CopyTextBlock } from '../../components/CopyTextBlock';
import { readXlsxGrid } from '../../utils/xlsxGrid';
import { greetingForMinutes, minutesNowInJakarta, todayInJakarta } from '../../utils/schedule';
import {
  buildDropBc,
  buildPaymentBc,
  findMedproSheet,
  formatLongId,
  formatRupiah,
  formatShortId,
  groupByPaidOn,
  importMedproSheet,
  invoiceBr,
  arrivalMessage,
  invoiceFormatWarning,
  lineMismatch,
  lineTotals,
  nextPayday,
  normalizeInvoice,
  notaTotal,
  parseRupiah,
  sortNotas,
  summarize,
  validateNotaInput,
  type MedproDrop,
  type MedproNota,
  type NotaLine
} from './medpro';
import { getMedproStore } from './medproStore';
import { dropReport, medproReport } from './medproReport';
import { ExportButtons } from '../../components/ExportButtons';

const printedAt = () =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }).format(new Date());

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';
const num = new Intl.NumberFormat('id-ID');
const money = (n: number) => (n ? num.format(n) : '');

type Tab = 'berjalan' | 'drop' | 'riwayat';

/** Menu admin: nota medpro (banner/plank & alat branding) dan drop banner. */
export const MedproPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getMedproStore();
  const [tab, setTab] = useState<Tab>('berjalan');
  const [notas, setNotas] = useState<MedproNota[] | null>(null);
  const [drops, setDrops] = useState<MedproDrop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidBc, setPaidBc] = useState<{ title: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [n, d] = await Promise.all([store.listNotas(auth), store.listDrops(auth)]);
      setNotas(n);
      setDrops(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat nota medpro.');
    }
  }, [store, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>, message?: string) => {
    try {
      await fn();
      await load();
      if (message) toast(message);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    }
  };

  const active = sortNotas((notas ?? []).filter((n) => !n.paidOn));
  const history = groupByPaidOn(notas ?? []);
  const dropActive = sortNotas((drops ?? []).filter((d) => !d.paidOn));
  const dropHistory = groupByPaidOn(drops ?? []);
  const payday = nextPayday(todayInJakarta());

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Operasional</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Nota Medpro</h1>
            <p className="mt-1 text-sm text-slate-600">
              Nota banner/plank & alat branding. Pembayaran tanggal 14 dan 28 (Sabtu/Minggu dimajukan ke Jumat).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImportButton onImported={load} />
            <ExportButtons
              fileBase={`nota_medpro_cibubur_${todayInJakarta()}`}
              disabled={!notas || (notas.length === 0 && (drops ?? []).length === 0)}
              build={() => [
                { name: 'NOTA MEDPRO', doc: medproReport(notas ?? [], payday, printedAt()) },
                { name: 'DROP BANNER', doc: dropReport(drops ?? [], printedAt()) }
              ]}
            />
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}

        <div role="tablist" aria-label="Bagian nota medpro" className="mt-6 inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {(
            [
              ['berjalan', `Periode berjalan (${active.length})`],
              ['drop', `Drop banner (${dropActive.length})`],
              ['riwayat', `Riwayat pembayaran (${history.length})`]
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold cursor-pointer ${
                tab === t ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notas === null ? (
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-slate-200/70" aria-label="Memuat" />
        ) : tab === 'berjalan' ? (
          <ActivePeriod
            notas={active}
            allNotas={notas}
            payday={payday}
            run={run}
            onPaid={(paidList, date) =>
              setPaidBc({ title: `Pembayaran ${formatLongId(date)}`, text: buildPaymentBc(paidList) })
            }
          />
        ) : tab === 'drop' ? (
          <DropSection drops={drops ?? []} active={dropActive} history={dropHistory} payday={payday} run={run} />
        ) : (
          <History groups={history} run={run} />
        )}
      </div>

      {paidBc && (
        <div role="dialog" aria-modal="true" aria-label="BC pembayaran" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={() => setPaidBc(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-base font-bold text-slate-950">
                  <BadgeCheck className="h-5 w-5 text-green-600" /> Pembayaran dicatat
                </p>
                <p className="text-sm text-slate-600">{paidBc.title}. Periode baru otomatis dimulai.</p>
              </div>
              <button type="button" onClick={() => setPaidBc(null)} aria-label="Tutup" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <CopyTextBlock text={paidBc.text} label="BC pembayaran" rows={14} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

type Run = (fn: () => Promise<void>, message?: string) => Promise<void>;

/* ------------------------------------------------------------------ */

const ActivePeriod: React.FC<{
  notas: MedproNota[];
  allNotas: MedproNota[];
  payday: string;
  run: Run;
  onPaid: (paid: MedproNota[], date: string) => void;
}> = ({ notas, allNotas, payday, run, onPaid }) => {
  const { auth } = useAdmin();
  const store = getMedproStore();
  const s = summarize(notas);
  const [paidDate, setPaidDate] = useState<string>(payday);
  const [confirmPay, setConfirmPay] = useState<boolean>(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-950 p-4 text-white sm:col-span-2 lg:col-span-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <CalendarClock className="h-4 w-4" /> Jadwal bayar berikutnya
          </p>
          <p className="mt-1 text-lg font-bold">{formatLongId(payday)}</p>
        </div>
        <Stat label="Banner / plank" value={formatRupiah(s.banner)} />
        <Stat label="Alat branding" value={formatRupiah(s.branding)} />
        <Stat label="Total tagihan" value={formatRupiah(s.total)} strong />
      </div>

      <NotaForm allNotas={allNotas} run={run} />

      <NotaTable notas={notas} run={run} editable />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-950">Tandai sudah dibayar</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {s.checked}/{s.count} nota sudah dicek sesuai.{' '}
            {s.count > 0 && s.checked < s.count && <b className="text-red-700">Masih ada nota yang belum dicek.</b>}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-700">
              Tanggal bayar
              <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={`${input} mt-1`} />
            </label>
            {!confirmPay ? (
              <button type="button" disabled={s.count === 0 || !paidDate} onClick={() => setConfirmPay(true)} className={primaryBtn}>
                <BadgeCheck className="h-4 w-4" />
                Sudah dibayar
              </button>
            ) : (
              <span className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmPay(false);
                    const list = [...notas];
                    await run(
                      () => store.setNotasPaid(list.map((n) => n.id), paidDate, auth),
                      `${list.length} nota ditandai dibayar.`
                    );
                    onPaid(list, paidDate);
                  }}
                  className={primaryBtn}
                >
                  Ya, {s.count} nota dibayar {formatShortId(paidDate)}
                </button>
                <button type="button" onClick={() => setConfirmPay(false)} className={ghostBtn}>
                  Batal
                </button>
              </span>
            )}
          </div>
        </div>
        <CopyTextBlock text={buildPaymentBc(notas)} label="Pratinjau BC pembayaran" emptyText="Belum ada nota di periode ini." rows={8} />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className={`mt-1 tabular-nums ${strong ? 'text-xl font-extrabold text-slate-950' : 'text-lg font-bold text-slate-900'}`}>{value}</p>
  </div>
);

const NotaForm: React.FC<{ allNotas: MedproNota[]; run: Run }> = ({ allNotas, run }) => {
  const { auth } = useAdmin();
  const [date, setDate] = useState<string>(todayInJakarta());
  const [invoice, setInvoice] = useState<string>('');
  const [banner, setBanner] = useState<string>('');
  const [branding, setBranding] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const inv = normalizeInvoice(invoice);
  const duplicate = inv ? allNotas.find((n) => n.invoice === inv) : undefined;
  const warning = inv && !duplicate ? invoiceFormatWarning(inv) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { date, invoice: inv, banner: parseRupiah(banner), branding: parseRupiah(branding) };
    const problem = duplicate ? `Nomor INVOICE ${inv} sudah tercatat.` : validateNotaInput(data);
    setError(problem);
    if (problem) return;
    await run(
      () => getMedproStore().addNota({ ...data, checked: false, paidOn: null }, auth),
      `Nota ${invoiceBr(inv)} ditambahkan.`
    );
    setInvoice('');
    setBanner('');
    setBranding('');
    document.getElementById('medpro-invoice')?.focus();
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" noValidate>
      <p className="text-sm font-bold text-slate-950">Input nota</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[150px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="text-xs font-semibold text-slate-700">
          Tanggal
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          INVOICE (asli)
          <input
            id="medpro-invoice"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            placeholder="022589/ASP/FP/XI/2026"
            className={`${input} mt-1 font-mono uppercase`}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Banner / plank
          <input inputMode="numeric" value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="0" className={`${input} mt-1 tabular-nums`} />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Alat branding
          <input inputMode="numeric" value={branding} onChange={(e) => setBranding(e.target.value)} placeholder="0" className={`${input} mt-1 tabular-nums`} />
        </label>
        <button type="submit" className={primaryBtn}>
          <Plus className="h-4 w-4" />
          Tambah
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        INVOICE BR otomatis: <b className="font-mono text-slate-900">{inv ? invoiceBr(inv) : '…-CIBUBUR'}</b>
        {(parseRupiah(banner) || parseRupiah(branding)) > 0 && (
          <> · Total <b className="text-slate-900">{formatRupiah(parseRupiah(banner) + parseRupiah(branding))}</b></>
        )}
      </p>
      {duplicate && (
        <p className="mt-1 text-xs font-semibold text-red-700">
          Nomor ini sudah tercatat ({formatShortId(duplicate.date)}{duplicate.paidOn ? `, dibayar ${formatShortId(duplicate.paidOn)}` : ''}).
        </p>
      )}
      {warning && <p className="mt-1 text-xs text-amber-800">{warning}</p>}
      {error && !duplicate && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </form>
  );
};

/** Rincian barang di dalam nota: untuk cek silang dengan web Brighton & kabari agen lewat WhatsApp. */
const NotaLines: React.FC<{ nota: MedproNota; mismatch: string | null; onCategory?: (index: number, category: NotaLine['category']) => void }> = ({
  nota,
  mismatch,
  onCategory
}) => {
  if (!nota.items?.length)
    return (
      <p className="text-xs text-slate-500">
        Rincian barang tidak tersedia. Nota ini diinput manual/impor, bukan lewat Input nota.
      </p>
    );
  const notify = (it: NotaLine) => {
    const text = arrivalMessage(it, greetingForMinutes(minutesNowInJakarta()));
    // Tanpa nomor: WhatsApp membuka daftar kontak untuk memilih agen.
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return (
    <div>
      {mismatch && (
        <p className="mb-2 flex items-start gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {mismatch}
        </p>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] font-bold text-slate-500">
            <th className="py-1 pr-2">No</th>
            <th className="py-1 pr-2">Barang</th>
            <th className="py-1 pr-2">Masuk ke</th>
            <th className="py-1 pr-2 text-right">Harga</th>
            <th className="py-1 pr-2 text-center">Qty</th>
            <th className="py-1 pr-2 text-right">Jumlah</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {nota.items.map((it, i) => (
            <tr key={i} className="border-t border-slate-200/70">
              <td className="py-1.5 pr-2 tabular-nums text-slate-500">{i + 1}</td>
              <td className="py-1.5 pr-2 font-semibold text-slate-800">{it.description}</td>
              <td className="py-1.5 pr-2">
                {onCategory ? (
                  <select
                    value={it.category}
                    aria-label={`Kategori ${it.description}`}
                    onChange={(e) => onCategory(i, e.target.value as NotaLine['category'])}
                    className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                      it.category === 'banner' ? 'bg-sky-100 text-sky-900' : 'bg-violet-100 text-violet-900'
                    }`}
                  >
                    <option value="banner">Banner / plank</option>
                    <option value="branding">Alat branding</option>
                  </select>
                ) : (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      it.category === 'banner' ? 'bg-sky-100 text-sky-900' : 'bg-violet-100 text-violet-900'
                    }`}
                  >
                    {it.category === 'banner' ? 'Banner / plank' : 'Alat branding'}
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{money(it.price)}</td>
              <td className="py-1.5 pr-2 text-center tabular-nums">{it.qty}</td>
              <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{money(it.total)}</td>
              <td className="py-1.5 text-right">
                <button
                  type="button"
                  onClick={() => notify(it)}
                  className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-green-700 cursor-pointer whitespace-nowrap"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Kabari agen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Tabel seperti rekap Excel: tanggal sekali per grup, INVOICE BR hijau bila sudah dicek. */
const NotaTable: React.FC<{ notas: MedproNota[]; run: Run; editable?: boolean }> = ({ notas, run, editable }) => {
  const { auth } = useAdmin();
  const store = getMedproStore();
  const s = summarize(notas);
  /** Nota yang rinciannya sedang dibuka. */
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-stone-50 text-left text-xs font-bold text-slate-700">
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">INVOICE BR</th>
            <th className="px-3 py-2">INVOICE</th>
            <th className="px-3 py-2 text-right">Banner / plank</th>
            <th className="px-3 py-2 text-right">Alat branding</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-center">Sesuai</th>
            {editable && <th className="w-24" />}
          </tr>
        </thead>
        <tbody>
          {notas.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                Belum ada nota di periode ini.
              </td>
            </tr>
          )}
          {notas.map((n, i) => {
            const firstOfDate = i === 0 || notas[i - 1].date !== n.date;
            const mismatch = lineMismatch(n);
            const isOpen = open.has(n.id);
            return (
              <React.Fragment key={n.id}>
              <tr className={`border-t ${firstOfDate ? 'border-slate-200' : 'border-slate-100'}`}>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">{firstOfDate ? formatShortId(n.date) : ''}</td>
                <td className="px-1.5 py-1">
                  <span
                    className={`inline-block rounded-md px-1.5 py-1 font-mono text-xs font-semibold ${
                      n.checked ? 'bg-green-400/80 text-green-950' : 'bg-white text-slate-800 ring-1 ring-slate-200'
                    }`}
                  >
                    {invoiceBr(n.invoice)}
                  </span>
                  {n.note && <span className="ml-1.5 text-[11px] font-semibold text-amber-800">{n.note}</span>}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-slate-700">
                  <button
                    type="button"
                    onClick={() => toggle(n.id)}
                    aria-expanded={isOpen}
                    className="inline-flex items-center gap-1 hover:text-slate-950 cursor-pointer"
                    title="Lihat isi nota"
                  >
                    {n.invoice}
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mismatch && (
                    <span title={mismatch} className="ml-1 inline-flex align-middle text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" aria-label={mismatch} />
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(n.banner)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(n.branding)}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{money(notaTotal(n))}</td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={n.checked}
                    aria-label={`Tandai ${invoiceBr(n.invoice)} sesuai`}
                    onChange={(e) => void run(() => store.updateNota(n.id, { checked: e.target.checked }, auth))}
                    className="h-4 w-4 accent-green-600 cursor-pointer"
                  />
                </td>
                {editable && (
                  <td className="px-2 text-right">
                    <ConfirmCancelButton
                      label="Hapus"
                      confirmLabel="Ya"
                      onConfirm={() => run(() => store.removeNota(n.id, auth), `Nota ${invoiceBr(n.invoice)} dihapus.`)}
                    />
                  </td>
                )}
              </tr>
              {isOpen && (
                <tr className="bg-stone-50/70">
                  <td colSpan={editable ? 8 : 7} className="px-3 py-3">
                    <NotaLines
                      nota={n}
                      mismatch={mismatch}
                      onCategory={
                        editable && n.items
                          ? (idx, category) => {
                              // Ubah kategori barang → kolom Banner/Alat branding dihitung ulang dari rinciannya.
                              const items = n.items!.map((it, j) => (j === idx ? { ...it, category } : it));
                              const t = lineTotals(items);
                              void run(
                                () => store.updateNota(n.id, { items, banner: t.banner, branding: t.branding }, auth),
                                `Kategori diubah. ${invoiceBr(n.invoice)} dihitung ulang.`
                              );
                            }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
        {notas.length > 0 && (
          <tfoot>
            <tr className="bg-rose-100 font-bold text-slate-950">
              <td className="px-3 py-2" colSpan={3}>
                TOTAL TAGIHAN · {s.count} nota
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{num.format(s.banner)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{num.format(s.branding)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{num.format(s.total)}</td>
              <td className="px-3 py-2 text-center text-xs tabular-nums">
                {s.checked}/{s.count}
              </td>
              {editable && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

const History: React.FC<{ groups: { paidOn: string; items: MedproNota[] }[]; run: Run }> = ({ groups, run }) => {
  const { auth } = useAdmin();
  const [open, setOpen] = useState<string | null>(groups[0]?.paidOn ?? null);
  if (groups.length === 0) return <p className="mt-4 rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">Belum ada pembayaran tercatat.</p>;
  return (
    <div className="mt-4 space-y-3">
      {groups.map((g) => {
        const s = summarize(g.items);
        const sorted = sortNotas(g.items);
        const isOpen = open === g.paidOn;
        return (
          <div key={g.paidOn} className="rounded-2xl bg-white ring-1 ring-slate-200">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : g.paidOn)}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
            >
              <span>
                <span className="block text-sm font-bold text-slate-950">Dibayar {formatLongId(g.paidOn)}</span>
                <span className="block text-xs text-slate-500">
                  {formatShortId(sorted[0].date)} – {formatShortId(sorted[sorted.length - 1].date)} · {s.count} nota
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-bold tabular-nums text-slate-950">{formatRupiah(s.total)}</span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t border-slate-100 p-4">
                <NotaTable notas={sorted} run={run} />
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <CopyTextBlock text={buildPaymentBc(sorted)} label="BC pembayaran" rows={8} />
                  <ConfirmCancelButton
                    label="Batalkan pembayaran"
                    confirmLabel="Ya, kembalikan ke periode berjalan"
                    onConfirm={() =>
                      run(() => getMedproStore().setNotasPaid(g.items.map((n) => n.id), null, auth), 'Pembayaran dibatalkan.')
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */

const DropSection: React.FC<{
  drops: MedproDrop[];
  active: MedproDrop[];
  history: { paidOn: string; items: MedproDrop[] }[];
  payday: string;
  run: Run;
}> = ({ drops, active, history, payday, run }) => {
  const { auth } = useAdmin();
  const store = getMedproStore();
  const [date, setDate] = useState<string>(todayInJakarta());
  const [office, setOffice] = useState<string>('');
  const [notaNo, setNotaNo] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paidDate, setPaidDate] = useState<string>(payday);
  const [error, setError] = useState<string | null>(null);
  const offices = useMemo(() => [...new Set(drops.map((d) => d.office))].sort(), [drops]);
  const total = active.reduce((s, d) => s + d.amount, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const o = office.trim().toUpperCase();
    const n = normalizeInvoice(notaNo);
    if (!o || !n) return setError('Kantor tujuan dan nomor nota wajib diisi.');
    setError(null);
    await run(
      () => store.addDrop({ date, office: o, notaNo: n, amount: parseRupiah(amount), checked: false, paidOn: null }, auth),
      `Nota drop ${n} (${o}) ditambahkan.`
    );
    setNotaNo('');
    setAmount('');
  };

  const table = (list: MedproDrop[], editable: boolean) => (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="bg-stone-50 text-left text-xs font-bold text-slate-700">
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">Kantor tujuan</th>
            <th className="px-3 py-2">Nomor nota</th>
            <th className="px-3 py-2 text-right">Nominal</th>
            <th className="px-3 py-2 text-center">Sesuai</th>
            {editable && <th className="w-20" />}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                Belum ada nota drop banner.
              </td>
            </tr>
          )}
          {list.map((d) => (
            <tr key={d.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 whitespace-nowrap">{formatShortId(d.date)}</td>
              <td className="px-3 py-1.5 font-semibold">{d.office}</td>
              <td className="px-1.5 py-1">
                <span className={`inline-block rounded-md px-1.5 py-1 font-mono text-xs font-semibold ${d.checked ? 'bg-green-400/80 text-green-950' : 'ring-1 ring-slate-200'}`}>
                  {d.notaNo}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{money(d.amount)}</td>
              <td className="px-3 py-1.5 text-center">
                <input
                  type="checkbox"
                  checked={d.checked}
                  aria-label={`Tandai ${d.notaNo} sesuai`}
                  onChange={(e) => void run(() => store.updateDrop(d.id, { checked: e.target.checked }, auth))}
                  className="h-4 w-4 accent-green-600 cursor-pointer"
                />
              </td>
              {editable && (
                <td className="px-2 text-right">
                  <ConfirmCancelButton label="Hapus" confirmLabel="Ya" onConfirm={() => run(() => store.removeDrop(d.id, auth), 'Nota drop dihapus.')} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-slate-600">
        Drop banner dicatat terpisah dari nota kantor sendiri karena tanggal & nomornya berbeda.
      </p>
      <form onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200" noValidate>
        <p className="text-sm font-bold text-slate-950">Input nota drop banner</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="text-xs font-semibold text-slate-700">
            Tanggal
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Kantor tujuan
            <input list="drop-offices" value={office} onChange={(e) => setOffice(e.target.value)} placeholder="Mis. BALI" className={`${input} mt-1 uppercase`} />
            <datalist id="drop-offices">
              {offices.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Nomor nota
            <input value={notaNo} onChange={(e) => setNotaNo(e.target.value)} placeholder="01K48F" className={`${input} mt-1 font-mono uppercase`} />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Nominal
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${input} mt-1 tabular-nums`} />
          </label>
          <button type="submit" className={primaryBtn}>
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
      </form>

      {table(active, true)}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-950">Belum dibayar: {active.length} nota · {formatRupiah(total)}</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-700">
              Tanggal bayar
              <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={`${input} mt-1`} />
            </label>
            <ConfirmCancelButton
              label="Tandai semua sudah dibayar"
              confirmLabel={`Ya, ${active.length} nota dibayar`}
              onConfirm={() =>
                active.length === 0
                  ? Promise.resolve()
                  : run(() => store.setDropsPaid(active.map((d) => d.id), paidDate, auth), 'Nota drop ditandai dibayar.')
              }
            />
          </div>
        </div>
        <CopyTextBlock text={buildDropBc(active)} label="BC drop banner" emptyText="Tidak ada nota drop yang belum dibayar." rows={6} />
      </div>

      {history.length > 0 && (
        <details className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">Riwayat drop banner ({history.length} pembayaran)</summary>
          <div className="mt-3 space-y-4">
            {history.map((g) => (
              <div key={g.paidOn} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Dibayar {formatLongId(g.paidOn)}</p>
                  <button
                    type="button"
                    onClick={() => void run(() => store.setDropsPaid(g.items.map((d) => d.id), null, auth), 'Pembayaran drop dibatalkan.')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 cursor-pointer"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Batalkan
                  </button>
                </div>
                {table(sortNotas(g.items), false)}
                <CopyTextBlock text={buildDropBc(g.items)} label="BC drop banner" rows={4} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

const ImportButton: React.FC<{ onImported: () => Promise<void> }> = ({ onImported }) => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState<boolean>(false);
  return (
    <label className={`${ghostBtn} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
      <FileSpreadsheet className="h-4 w-4 text-green-700" />
      {busy ? 'Mengimpor…' : 'Impor dari Excel'}
      <input
        type="file"
        accept=".xlsx"
        aria-label="File rekap medpro"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const sheet = findMedproSheet(await readXlsxGrid(await file.arrayBuffer()));
            if (!sheet) throw new Error('Sheet nota medpro (kolom "INVOICE BR") tidak ditemukan.');
            const r = importMedproSheet(sheet);
            const store = getMedproStore();
            const added = await store.importNotas(r.notas, auth);
            const addedDrops = await store.importDrops(r.drops, auth);
            await onImported();
            toast(
              `${added} nota baru dari ${r.periods} periode${addedDrops ? ` dan ${addedDrops} drop banner` : ''} diimpor. Nota yang sudah ada dilewati.`
            );
          } catch (err) {
            toast(err instanceof Error ? err.message : 'File tidak dapat diimpor.', 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
};

