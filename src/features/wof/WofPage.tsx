import React, { useEffect, useMemo, useState } from 'react';
import { CopyTextBlock } from '../../components/CopyTextBlock';
import { useAdmin } from '../../hooks/useAdmin';
import { getBirthdayStore } from '../../services/birthdayStore';
import { todayInJakarta } from '../../utils/schedule';
import type { AgentBirthday } from '../birthdays/birthdays';
import type { Closing } from '../closing/closing';
import { getClosingStore } from '../closing/closingStore';
import { buildWofBc, closingsWithoutCode, findWofClaims, formatBirthday, formatMonth, formatTransactionDate } from './wof';

/** Menu admin Operasional › WOF: agen yang closing di bulan ulang tahunnya + BC klaim. */
export const WofPage: React.FC = () => {
  const { auth } = useAdmin();
  const [closings, setClosings] = useState<Closing[] | null>(null);
  const [birthdays, setBirthdays] = useState<AgentBirthday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(todayInJakarta().slice(0, 7));

  useEffect(() => {
    const birthdays = getBirthdayStore();
    Promise.all([getClosingStore().list(), birthdays.list(), birthdays.listYears(auth).catch(() => new Map<string, number>())])
      .then(([c, b, years]) => {
        setClosings(c);
        setBirthdays(b.map((x) => (years.has(x.code) ? { ...x, year: years.get(x.code) } : x)));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat data.');
        setClosings([]);
      });
  }, [auth]);

  const months = useMemo(() => {
    const set = new Set<string>((closings ?? []).map((c) => c.date.slice(0, 7)));
    set.add(todayInJakarta().slice(0, 7));
    return [...set].sort().reverse();
  }, [closings]);
  const claims = findWofClaims(closings ?? [], birthdays, month);
  const noCode = closingsWithoutCode(closings ?? [], month);

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Operasional</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">WOF</h1>
            <p className="mt-1 text-sm text-slate-600">
              Agen yang closing di bulan ulang tahunnya. Dicocokkan lewat kode PA dan nama saat closing dengan data Ulang tahun agen.
            </p>
          </div>
          <select
            className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Bulan"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        {noCode.length > 0 && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            Belum bisa dicek karena kode PA saat closing kosong:{' '}
            <b>{noCode.map((x) => `${x.name} (${formatTransactionDate(x.closing.date)})`).join(', ')}</b>. Lengkapi kodenya di menu Closing.
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-950">
              Klaim {formatMonth(month)} ({claims.length})
            </h2>
            {closings === null ? (
              <p className="mt-3 text-sm text-slate-500">Memuat…</p>
            ) : claims.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada agen yang closing di bulan ulang tahunnya.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {claims.map((c) => (
                  <li key={`${c.closing.id}-${c.code}`} className="py-3">
                    <p className="text-sm font-bold text-slate-900">
                      {c.name}
                      {c.code && <span className="font-semibold text-slate-500"> ({c.code})</span>}
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        Ultah {formatBirthday(c.birthday)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {c.closing.type} – {c.closing.location.toUpperCase()} · {formatTransactionDate(c.closing.date)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <CopyTextBlock text={buildWofBc(claims)} label="BC klaim wheel of fortune" emptyText="Belum ada klaim di bulan ini." rows={14} />
        </div>
      </div>
    </section>
  );
};
