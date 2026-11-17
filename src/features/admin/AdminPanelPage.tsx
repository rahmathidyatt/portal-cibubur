import React, { useCallback, useEffect, useState } from 'react';
import { Cake, Eye, Plus, RefreshCw, Upload, Users } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { getViewStats, type ViewStats } from '../../services/analytics';
import { getBirthdayStore } from '../../services/birthdayStore';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { readTableFile } from '../floortime/spreadsheet';
import { MONTH_NAMES_ID } from '../floortime/engine';
import { todayInJakarta } from '../../utils/schedule';
import {
  compareBirthday,
  parseBirthDate,
  parseBirthdayRows,
  type AgentBirthday,
  type ParseResult
} from '../birthdays/birthdays';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'bg-white border border-slate-200 rounded-2xl p-5 sm:p-6';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';

const number = new Intl.NumberFormat('id-ID');

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES_ID[m - 1].slice(0, 3)}`;
}

/** Panel admin: statistik kunjungan portal dan data ulang tahun agen. */
export const AdminPanelPage: React.FC = () => (
  <section className="bg-stone-50 min-h-[60vh]">
    <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Panel admin</h1>
        <p className="mt-1 text-sm text-slate-600">Statistik kunjungan portal dan data ulang tahun agen.</p>
      </div>
      <VisitStats />
      <BirthdayManager />
    </div>
  </section>
);

/* ------------------------------------------------------------------ */

const VisitStats: React.FC = () => {
  const { auth } = useAdmin();
  const [stats, setStats] = useState<ViewStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getViewStats(auth));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat statistik.');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const tiles = stats
    ? [
        { label: 'Total kunjungan', value: stats.totalViews, Icon: Eye },
        { label: 'Pengunjung unik', value: stats.uniqueVisitors, Icon: Users },
        { label: 'Kunjungan hari ini', value: stats.todayViews, hint: `${stats.todayVisitors} pengunjung` },
        { label: '7 hari terakhir', value: stats.last7Views }
      ]
    : [];
  const max = Math.max(1, ...(stats?.daily.map((d) => d.views) ?? [1]));

  return (
    <section className={card} aria-labelledby="statistik-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="statistik-title" className="flex items-center gap-2 text-base font-bold text-slate-950">
          <Eye className="w-4 h-4 text-amber-600" aria-hidden="true" />
          Statistik kunjungan
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {stats && (
        <>
          <dl className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl bg-stone-50 ring-1 ring-slate-200 p-4">
                <dt className="text-xs font-semibold text-slate-500">{t.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{number.format(t.value)}</dd>
                {t.hint && <dd className="text-xs text-slate-500">{t.hint}</dd>}
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500">Kunjungan per hari (14 hari terakhir)</p>
            <div className="mt-2 flex items-end gap-1 h-32" role="img" aria-label="Grafik kunjungan 14 hari terakhir">
              {stats.daily.map((d) => (
                <div key={d.date} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1 group">
                  <span className="text-[10px] font-semibold tabular-nums text-slate-600">{d.views || ''}</span>
                  <div
                    title={`${shortDay(d.date)}: ${d.views} kunjungan, ${d.visitors} pengunjung`}
                    className="w-full max-w-8 rounded-t bg-amber-400 group-last:bg-slate-900"
                    style={{ height: `${Math.max(d.views ? 4 : 1, (d.views / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1">
              {stats.daily.map((d, i) => (
                <span key={d.date} className="flex-1 min-w-0 text-center text-[10px] text-slate-500 truncate">
                  {i % 2 === 1 || i === stats.daily.length - 1 ? shortDay(d.date) : ''}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Satu kunjungan dihitung sekali per sesi browser; muat ulang halaman di tab yang sama tidak menambah angka.
          </p>
        </>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */

const BirthdayManager: React.FC = () => {
  const { auth } = useAdmin();
  const store = getBirthdayStore();
  const currentMonth = Number(todayInJakarta().slice(5, 7));
  const [month, setMonth] = useState<number>(currentMonth);
  const [list, setList] = useState<AgentBirthday[]>([]);
  const [preview, setPreview] = useState<(ParseResult & { fileName: string }) | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [manual, setManual] = useState({ code: '', name: '', date: '' });

  const load = useCallback(async () => {
    try {
      setList(await store.list());
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal memuat data ulang tahun.' });
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await load();
      setMessage({ ok: true, text: success });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal menyimpan.' });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const result = parseBirthdayRows(await readTableFile(file));
      setPreview({ ...result, fileName: file.name });
      const months = [...new Set(result.entries.map((e) => e.month))];
      if (months.length === 1) setMonth(months[0]);
    } catch (err) {
      setPreview(null);
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'File tidak dapat dibaca.' });
    }
  };

  const handleManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manual.code.trim().toUpperCase();
    const name = manual.name.trim();
    const date = parseBirthDate(manual.date);
    if (!/^[A-Z0-9]{2,12}$/.test(code)) return setMessage({ ok: false, text: 'Kode agen 2–12 huruf/angka.' });
    if (!name) return setMessage({ ok: false, text: 'Nama panggilan wajib diisi.' });
    if (!date) return setMessage({ ok: false, text: 'Tanggal lahir tidak terbaca. Contoh: 15-Nov-79 atau 15/11/1979.' });
    void run(async () => {
      await store.upsert([{ code, name: name.includes(`(${code})`) ? name : `${name} (${code})`, ...date }], auth);
      setManual({ code: '', name: '', date: '' });
      setMonth(date.month);
    }, 'Data ulang tahun disimpan.');
  };

  const perMonth = new Map<number, number>();
  for (const b of list) perMonth.set(b.month, (perMonth.get(b.month) ?? 0) + 1);
  const monthList = list.filter((b) => b.month === month).sort(compareBirthday);

  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
        <Cake className="w-4 h-4 text-amber-600" aria-hidden="true" />
        Ulang tahun agen
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Unggah ekspor bulanan (kolom <b>Code</b>, <b>Nama Panggilan</b>, <b>Tgl Lahir</b>) dalam .csv atau .xlsx. Beranda
        menampilkan agen yang berulang tahun hari ini dan besok. Tahun lahir tidak disimpan.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-stone-50 p-5 text-center cursor-pointer hover:border-amber-400">
          <Upload className="w-5 h-5 text-slate-500" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-800">Pilih file ulang tahun</span>
          <span className="text-xs text-slate-500">.csv atau .xlsx</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            aria-label="File ulang tahun agen"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>

        <form onSubmit={handleManual} className="rounded-xl ring-1 ring-slate-200 p-4 space-y-2" noValidate>
          <p className="text-sm font-semibold text-slate-800">Tambah satu agen</p>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <input
              aria-label="Kode agen"
              placeholder="Kode"
              value={manual.code}
              onChange={(e) => setManual({ ...manual, code: e.target.value })}
              className={input}
            />
            <input
              aria-label="Nama panggilan"
              placeholder="Nama panggilan"
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
              className={input}
            />
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Tanggal lahir"
              placeholder="Tgl lahir, mis. 15-Nov-79"
              value={manual.date}
              onChange={(e) => setManual({ ...manual, date: e.target.value })}
              className={input}
            />
            <button type="submit" disabled={busy} className={`${primaryBtn} shrink-0`}>
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </div>
        </form>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}
        >
          {message.text}
        </p>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {preview.fileName}: {preview.entries.length} agen siap disimpan
            {preview.skipped.length > 0 && `, ${preview.skipped.length} baris dilewati`}
          </p>
          {preview.skipped.length > 0 && (
            <ul className="mt-1 text-xs text-red-800 list-disc pl-5">
              {preview.skipped.slice(0, 5).map((s) => (
                <li key={s.line}>
                  Baris {s.line}: {s.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-white ring-1 ring-amber-200">
            <table className="w-full text-sm">
              <tbody>
                {preview.entries.map((e) => (
                  <tr key={e.code} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-1.5 w-24 tabular-nums text-slate-600">
                      {e.day} {MONTH_NAMES_ID[e.month - 1].slice(0, 3)}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{e.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy || preview.entries.length === 0}
              onClick={() =>
                void run(async () => {
                  await store.upsert(preview.entries, auth);
                  setPreview(null);
                }, `${preview.entries.length} data ulang tahun disimpan.`)
              }
              className={primaryBtn}
            >
              Simpan {preview.entries.length} data
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <div role="tablist" aria-label="Pilih bulan" className="flex gap-1.5 overflow-x-auto pb-1">
          {MONTH_NAMES_ID.map((name, i) => {
            const m = i + 1;
            const count = perMonth.get(m) ?? 0;
            const active = m === month;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMonth(m)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  active ? 'bg-slate-950 text-white' : 'bg-stone-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {name.slice(0, 3)}
                {count > 0 && <span className={active ? 'text-amber-300' : 'text-slate-400'}> · {count}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-950">
            {MONTH_NAMES_ID[month - 1]} · {monthList.length} agen
          </p>
          {monthList.length > 0 && (
            <ConfirmCancelButton
              label={`Hapus semua ${MONTH_NAMES_ID[month - 1]}`}
              confirmLabel="Ya, hapus"
              onConfirm={() => run(() => store.removeMonth(month, auth), `Data ${MONTH_NAMES_ID[month - 1]} dihapus.`)}
            />
          )}
        </div>
        {monthList.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada data ulang tahun untuk bulan ini.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {monthList.map((b) => (
              <li key={b.code} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-14 shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-amber-700">
                    {b.day} {MONTH_NAMES_ID[b.month - 1].slice(0, 3)}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-900">{b.name}</span>
                </span>
                <ConfirmCancelButton
                  label="Hapus"
                  confirmLabel="Ya, hapus"
                  onConfirm={() => run(() => store.remove(b.code, auth), `${b.name} dihapus.`)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
