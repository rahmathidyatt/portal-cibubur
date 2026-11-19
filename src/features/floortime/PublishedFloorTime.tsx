import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Search, Send } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { todayInJakarta } from '../../utils/schedule';
import {
  DAY_NAMES_ID,
  displayName,
  formatDateId,
  MONTH_NAMES_ID,
  monthLabel,
  weekdayOf
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
import { FEATURES } from '../../data/features';
import { MySchedulePanel } from './MySchedulePanel';
import { readMyAgentCode } from './mySchedule';

const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** "Senin" (bukan huruf kapital semua) agar seragam di seluruh portal. */
function dayName(iso: string): string {
  const n = DAY_NAMES_ID[weekdayOf(iso)];
  return n.charAt(0) + n.slice(1).toLowerCase();
}

/** "17 Nov, 15.40 WIB" */
function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
      .format(new Date(iso))
      .concat(' WIB');
  } catch {
    return iso;
  }
}

/** "16 Nov" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES_ID[m - 1].slice(0, 3)}`;
}

/** "16–21 Nov" atau "26 Okt – 1 Nov" (hanya Senin–Sabtu). */
export function shortRange(dates: string[]): string {
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return '';
  if (first.slice(0, 7) === last.slice(0, 7)) return `${Number(first.slice(8))}–${shortDate(last)}`;
  return `${shortDate(first)} – ${shortDate(last)}`;
}

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
  const [prefill, setPrefill] = useState<RequestPrefill | null>(null);

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
  // Minggu yang sudah berlalu tidak ditampilkan (kecuali seluruh bulan sudah lewat).
  const upcomingWeeks = data.weeks.filter((w) => w.dates[w.dates.length - 1] >= today);
  const weeks = upcomingWeeks.length > 0 ? upcomingWeeks : data.weeks;
  const week = weeks.find((w) => w.weekNo === weekNo) ?? weeks[0];
  const open = isRequestOpen(schedule.requestDeadline);
  const needle = search.trim().toLowerCase();
  const matches = (name: string) => needle !== '' && name.toLowerCase().includes(needle);

  // Hasil pencarian: slot-slot (sebulan) yang memuat agen yang cocok.
  const searchHits = needle
    ? data.slots
        .filter((slot) => upcomingWeeks.length === 0 || slot.date >= today)
        .flatMap((slot) =>
          (data.assignments[slot.key] ?? [])
            .filter((e) => matches(e.displayName))
            .map((e) => ({ slot, name: e.displayName }))
        )
        .sort((a, b) => a.slot.key.localeCompare(b.slot.key))
    : [];
  const hitsPerWeek = new Map<number, number>();
  for (const h of searchHits) hitsPerWeek.set(h.slot.weekNo, (hitsPerWeek.get(h.slot.weekNo) ?? 0) + 1);
  const hitNames = [...new Set(searchHits.map((h) => h.name))];

  return (
    <div className="space-y-5">
      <MySchedulePanel
        schedule={schedule}
        today={today}
        onJump={setWeekNo}
        requestOpen={open}
        onRequest={(agentId, kind, fromSlot) =>
          setPrefill((p) => ({ agentId, kind, fromSlot: fromSlot ?? '', nonce: (p?.nonce ?? 0) + 1 }))
        }
      />
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Jadwal Floor Time {monthLabel(data.year, data.month)}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Diperbarui {formatUpdated(schedule.updatedAt ?? schedule.publishedAt)}</p>
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
          {open && (
            <a
              href="#request-jadwal"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('request-jadwal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Send className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              Ajukan perubahan
            </a>
          )}
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              aria-label="Cari nama agen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / kode agen"
              className={`${input} pl-9 sm:w-64`}
            />
          </label>
          </div>
        </div>

        {needle && (
          <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            {searchHits.length === 0 ? (
              <p className="text-sm text-slate-700">Tidak ada jadwal untuk “{search.trim()}” di bulan ini.</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {hitNames.length === 1 ? hitNames[0] : `${hitNames.length} agen cocok`} · {searchHits.length} jadwal
                  bulan ini
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {searchHits.map(({ slot, name }) => (
                    <button
                      key={`${slot.key}-${name}`}
                      type="button"
                      onClick={() => setWeekNo(slot.weekNo)}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-800 ring-1 ring-amber-300 hover:bg-amber-100 cursor-pointer"
                    >
                      {DAY_SHORT[slot.weekday]} {shortDate(slot.date)} · {slot.timeLabel}
                      {hitNames.length > 1 && <span className="text-slate-500"> · {name}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div role="tablist" aria-label="Pilih minggu" className="flex gap-2 overflow-x-auto px-5 pb-4 border-b border-slate-200">
          {weeks.map((w) => {
            const active = w.weekNo === week?.weekNo;
            const isCurrent = w.dates[0] <= today && today <= w.dates[w.dates.length - 1];
            const hits = hitsPerWeek.get(w.weekNo) ?? 0;
            return (
              <button
                key={w.weekNo}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setWeekNo(w.weekNo)}
                className={`relative shrink-0 rounded-xl px-3.5 py-2 text-left cursor-pointer transition-colors ${
                  active
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`block text-[11px] font-semibold ${active ? 'text-amber-300' : 'text-slate-500'}`}>
                  {isCurrent ? 'Minggu ini' : `Minggu ${w.weekNo}`}
                </span>
                <span className="block text-sm font-bold whitespace-nowrap">{shortRange(w.dates)}</span>
                {hits > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-[11px] font-bold text-slate-950 grid place-items-center">
                    {hits}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-3 sm:p-4 space-y-2 bg-stone-50">
          {week?.dates
            .filter((d) => weekdayOf(d) <= 5)
            .map((date) => {
              const holiday = data.holidays[date];
              const slots = data.slots.filter((s) => s.date === date).sort((a, b) => a.shiftIndex - b.shiftIndex);
              const isToday = date === today;
              const isPast = date < today;
              const isSaturday = weekdayOf(date) === 5;
              return (
                <article
                  key={date}
                  aria-current={isToday ? 'date' : undefined}
                  className={`rounded-xl border px-4 py-3 grid grid-cols-1 md:grid-cols-[110px_1fr_1fr] gap-x-4 gap-y-2 ${
                    holiday !== undefined
                      ? 'bg-red-50 border-red-200'
                      : isSaturday
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-slate-200'
                  } ${isToday ? 'ring-2 ring-amber-400' : ''} ${isPast && !isToday ? 'opacity-80' : ''}`}
                >
                  <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0">
                    <p className="text-base font-bold text-slate-950">{dayName(date)}</p>
                    <p className="text-xs text-slate-600">{formatDateId(date)}</p>
                    {isToday && (
                      <span className="md:mt-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                        Hari ini
                      </span>
                    )}
                  </div>
                  {holiday !== undefined ? (
                    <p className="md:col-span-2 self-center text-sm font-semibold text-red-800">Libur · {holiday}</p>
                  ) : (
                    slots.map((slot) => {
                      const entries = data.assignments[slot.key] ?? [];
                      return (
                        <div key={slot.key} className="md:border-l md:border-slate-200 md:pl-4">
                          <p className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {slot.shiftName} · {slot.timeLabel.replace('-', '–')}
                          </p>
                          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                            {entries.map((e) => (
                              <li
                                key={e.agentId}
                                title={e.displayName}
                                className={`truncate text-[13px] font-semibold ${
                                  matches(e.displayName)
                                    ? 'text-slate-950 bg-amber-200 rounded px-1 -mx-1'
                                    : 'text-slate-800'
                                }`}
                              >
                                {e.displayName}
                              </li>
                            ))}
                            {entries.length === 0 && <li className="text-xs text-slate-500">Belum terisi</li>}
                          </ul>
                        </div>
                      );
                    })
                  )}
                </article>
              );
            })}

          {data.notes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row gap-1 sm:gap-6">
              <p className="text-sm font-bold text-slate-950 sm:border-r-2 sm:border-amber-500 sm:pr-6">Catatan</p>
              <ul className="space-y-1 text-sm text-slate-700">
                {data.notes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <RequestForm schedule={schedule} open={open} onSubmitted={load} prefill={prefill} />

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

export interface RequestPrefill {
  agentId: string;
  kind: 'move' | 'add';
  fromSlot: string;
  /** Berubah setiap kali tombol "Ajukan" ditekan agar form terisi ulang. */
  nonce: number;
}

const RequestForm: React.FC<{
  schedule: PublishedSchedule;
  open: boolean;
  onSubmitted: () => void;
  prefill: RequestPrefill | null;
}> = ({ schedule, open, onSubmitted, prefill }) => {
  const data = schedule.data;
  const toRef = useRef<HTMLSelectElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Bawaan: nama yang dipilih di "Jadwal saya".
  const [agentId, setAgentId] = useState<string>(() => {
    const code = readMyAgentCode();
    return data.agents.find((a) => code && a.code === code)?.id ?? '';
  });
  const [kind, setKind] = useState<'move' | 'add'>('move');
  const [fromSlot, setFromSlot] = useState<string>('');
  const [toSlot, setToSlot] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const agents = useMemo(() => [...data.agents].sort((a, b) => a.name.localeCompare(b.name, 'id')), [data.agents]);
  const mine = agentId ? agentSlots(data, agentId) : [];

  // Diisi dari tombol "Ajukan pindah / tambah" di Jadwal saya.
  useEffect(() => {
    if (!prefill) return;
    setAgentId(prefill.agentId);
    setKind(FEATURES.floortimeAddRequest ? prefill.kind : 'move');
    setFromSlot(prefill.fromSlot);
    setToSlot('');
    setFeedback(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => toRef.current?.focus({ preventScroll: true }), 400);
  }, [prefill]);
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
    <form
      id="request-jadwal"
      ref={formRef}
      onSubmit={handleSubmit}
      className="scroll-mt-24 bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
      noValidate
    >
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
        {FEATURES.floortimeAddRequest && (
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
        )}
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
          <select ref={toRef} value={toSlot} onChange={(e) => setToSlot(e.target.value)} className={`${input} mt-1`}>
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
