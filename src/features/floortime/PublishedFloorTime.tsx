import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Search, Send } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { todayInJakarta } from '../../utils/schedule';
import {
  DAY_NAMES_ID,
  displayName,
  formatDateId,
  monthLabel,
  weekdayOf,
  weekRangeLabel
} from './engine';
import {
  agentSlots,
  formatDeadlineWib,
  isRequestOpen,
  slotLabel,
  validateChangeRequest,
  type ChangeRequest,
  type PublishedSchedule
} from './requests';
import { getScheduleStore } from './scheduleStore';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

/** Jadwal Floor Time yang diterbitkan staf + formulir request perubahan untuk advisor. */
export const PublishedFloorTime: React.FC = () => {
  const store = getScheduleStore();
  const { auth } = useAdmin();
  const today = todayInJakarta();
  const [schedule, setSchedule] = useState<PublishedSchedule | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [weekNo, setWeekNo] = useState<number>(1);
  const [search, setSearch] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [y, m] = today.split('-').map(Number);
      // Bulan berjalan; bila belum terbit, pakai jadwal terbaru yang ada.
      let s = await store.getSchedule(y, m);
      if (!s) {
        const list = await store.listSchedules();
        if (list[0]) s = await store.getSchedule(list[0].year, list[0].month);
      }
      setSchedule(s);
      setRequests(s ? await store.listRequests(s.id, auth) : []);
      if (s) {
        const current = s.data.weeks.find((w) => w.dates[0] <= today && today <= w.dates[w.dates.length - 1]);
        setWeekNo(current?.weekNo ?? s.data.weeks[0]?.weekNo ?? 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal floor time.');
    } finally {
      setLoading(false);
    }
  }, [store, auth, today]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Memuat jadwal floor time…</p>;
  }
  if (error) {
    return <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  }
  if (!schedule) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Jadwal floor time bulanan belum diterbitkan oleh staf kantor.
      </p>
    );
  }

  const data = schedule.data;
  const week = data.weeks.find((w) => w.weekNo === weekNo) ?? data.weeks[0];
  const open = isRequestOpen(schedule.requestDeadline);
  const needle = search.trim().toLowerCase();

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Jadwal Floor Time {monthLabel(data.year, data.month)}</h2>
            <p
              className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${open ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              <Clock className="w-3.5 h-3.5" />
              {open
                ? `Request perubahan dibuka sampai ${formatDeadlineWib(schedule.requestDeadline)}`
                : `Batas request sudah lewat (${formatDeadlineWib(schedule.requestDeadline)})`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                aria-label="Cari nama agen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / kode"
                className={`${input} pl-9 sm:w-52`}
              />
            </label>
            <select
              aria-label="Pilih minggu"
              value={week?.weekNo}
              onChange={(e) => setWeekNo(Number(e.target.value))}
              className={`${input} sm:w-auto`}
            >
              {data.weeks.map((w) => (
                <option key={w.weekNo} value={w.weekNo}>
                  {weekRangeLabel(w.dates)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {week?.dates
            .filter((d) => weekdayOf(d) <= 5)
            .map((date) => {
              const holiday = data.holidays[date];
              const slots = data.slots.filter((s) => s.date === date).sort((a, b) => a.shiftIndex - b.shiftIndex);
              const isToday = date === today;
              return (
                <li
                  key={date}
                  className={`grid grid-cols-1 md:grid-cols-[160px_1fr_1fr] gap-3 p-4 ${
                    holiday !== undefined ? 'bg-red-50' : weekdayOf(date) === 5 ? 'bg-amber-50/60' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {DAY_NAMES_ID[weekdayOf(date)]}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold">Hari ini</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateId(date)}</p>
                  </div>
                  {holiday !== undefined ? (
                    <p className="md:col-span-2 text-sm font-semibold text-red-800">{holiday}</p>
                  ) : (
                    slots.map((slot) => (
                      <div key={slot.key}>
                        <p className="text-xs font-bold text-amber-800">
                          {slot.shiftName} · {slot.timeLabel}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {(data.assignments[slot.key] ?? []).map((e) => {
                            const hit = needle && e.displayName.toLowerCase().includes(needle);
                            return (
                              <li
                                key={e.agentId}
                                className={`text-sm ${hit ? 'font-bold text-slate-950 bg-amber-100 rounded px-1 -mx-1' : 'text-slate-800'}`}
                              >
                                {e.displayName}
                              </li>
                            );
                          })}
                          {(data.assignments[slot.key] ?? []).length === 0 && (
                            <li className="text-xs text-slate-400">Belum terisi</li>
                          )}
                        </ul>
                      </div>
                    ))
                  )}
                </li>
              );
            })}
        </ul>
      </div>

      <RequestForm schedule={schedule} open={open} onSubmitted={load} />

      {requests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-slate-950">Status request</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {requests.slice(0, 20).map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-900">{r.agentName}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {r.fromSlot ? 'pindah ke' : 'tambah'} {slotLabel(data, r.toSlot)}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-xs font-bold ${
                    r.status === 'approved' ? 'text-emerald-700' : r.status === 'rejected' ? 'text-slate-500' : 'text-amber-700'
                  }`}
                >
                  {r.status === 'approved' ? 'Disetujui' : r.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const RequestForm: React.FC<{ schedule: PublishedSchedule; open: boolean; onSubmitted: () => void }> = ({
  schedule,
  open,
  onSubmitted
}) => {
  const data = schedule.data;
  const [agentId, setAgentId] = useState<string>('');
  const [kind, setKind] = useState<'move' | 'add'>('move');
  const [fromSlot, setFromSlot] = useState<string>('');
  const [toSlot, setToSlot] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const agents = useMemo(() => [...data.agents].sort((a, b) => a.name.localeCompare(b.name, 'id')), [data.agents]);
  const mine = agentId ? agentSlots(data, agentId) : [];
  const targets = data.slots.filter((s) => s.date >= todayInJakarta());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { agentId, fromSlot: kind === 'move' ? fromSlot || null : null, toSlot, reason };
    if (kind === 'move' && !fromSlot) {
      setFeedback({ ok: false, text: 'Pilih jadwal asal yang ingin dipindah.' });
      return;
    }
    const error = validateChangeRequest(data, input);
    if (error) {
      setFeedback({ ok: false, text: error });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await getScheduleStore().submitRequest(schedule, input);
      setFeedback({ ok: true, text: 'Request terkirim. Staf kantor akan meninjau sebelum jadwal diubah.' });
      setReason('');
      setToSlot('');
      onSubmitted();
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : 'Request gagal dikirim.' });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Request perubahan jadwal sudah ditutup. Hubungi Operasional bila ada keperluan mendesak.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" noValidate>
      <div>
        <p className="text-sm font-bold text-slate-950">Request perubahan jadwal</p>
        <p className="text-xs text-slate-500">
          Batas pengajuan {formatDeadlineWib(schedule.requestDeadline)}. Jadwal berubah setelah disetujui staf.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-700">
          Nama agen
          <select
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              setFromSlot('');
            }}
            className={`${input} mt-1`}
          >
            <option value="">Pilih nama…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {displayName(a)}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs font-semibold text-slate-700">
          Jenis request
          <div className="mt-1 flex gap-1">
            {(
              [
                ['move', 'Pindah jadwal'],
                ['add', 'Tambah jadwal']
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 px-3 py-2 text-sm font-bold rounded-lg border cursor-pointer ${
                  kind === k ? 'bg-amber-400 border-amber-400 text-slate-950' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {kind === 'move' && (
          <label className="text-xs font-semibold text-slate-700">
            Jadwal asal
            <select value={fromSlot} onChange={(e) => setFromSlot(e.target.value)} className={`${input} mt-1`} disabled={!agentId}>
              <option value="">{agentId ? (mine.length ? 'Pilih jadwal asal…' : 'Agen belum punya jadwal') : 'Pilih nama dulu'}</option>
              {mine.map((k) => (
                <option key={k} value={k}>
                  {slotLabel(data, k)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-semibold text-slate-700">
          {kind === 'move' ? 'Pindah ke' : 'Tanggal & shift tambahan'}
          <select value={toSlot} onChange={(e) => setToSlot(e.target.value)} className={`${input} mt-1`}>
            <option value="">Pilih tanggal & shift…</option>
            {targets.map((s) => (
              <option key={s.key} value={s.key}>
                {slotLabel(data, s.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700 md:col-span-2">
          Alasan
          <input
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mis. ada jadwal akad klien di jam tersebut"
            className={`${input} mt-1`}
          />
        </label>
      </div>
      {feedback && (
        <p className={`text-sm font-semibold ${feedback.ok ? 'text-emerald-700' : 'text-red-700'}`}>{feedback.text}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer"
      >
        <Send className="w-4 h-4" />
        {busy ? 'Mengirim…' : 'Kirim request'}
      </button>
    </form>
  );
};
