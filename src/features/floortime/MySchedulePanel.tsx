import React, { useState } from 'react';
import { ArrowLeftRight, CalendarCheck, CalendarPlus, Plus, UserRound } from 'lucide-react';
import { OFFICE_IDENTITY } from '../../data/cibuburData';
import { minutesNowInJakarta } from '../../utils/schedule';
import { DAY_NAMES_ID, displayName, formatDateId, weekdayOf } from './engine';
import { buildIcs, nextSlot, readMyAgentCode, saveMyAgentCode, slotsForAgentCode } from './mySchedule';
import type { PublishedSchedule } from './requests';

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function downloadText(text: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Jadwal saya": agen memilih namanya, melihat jadwalnya, dan menyimpannya ke kalender HP. */
export const MySchedulePanel: React.FC<{
  schedule: PublishedSchedule;
  today: string;
  onJump: (weekNo: number) => void;
  /** Request perubahan masih dibuka (sebelum batas waktu). */
  requestOpen: boolean;
  /** Buka form request yang sudah terisi nama (dan jadwal asal untuk pindah). */
  onRequest: (agentId: string, kind: 'move' | 'add', fromSlot?: string) => void;
}> = ({ schedule, today, onJump, requestOpen, onRequest }) => {
  const data = schedule.data;
  const [code, setCode] = useState<string>(() => {
    const saved = readMyAgentCode();
    return data.agents.some((a) => a.code === saved) ? saved : '';
  });
  const agents = [...data.agents].sort((a, b) => a.name.localeCompare(b.name));
  const agent = data.agents.find((a) => a.code === code);
  const slots = agent ? slotsForAgentCode(data, agent.code) : [];
  const next = nextSlot(slots, today, minutesNowInJakarta());

  const choose = (value: string) => {
    setCode(value);
    saveMyAgentCode(value);
  };

  return (
    <section aria-labelledby="jadwal-saya-title" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="jadwal-saya-title" className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </span>
          Jadwal saya
        </h2>
        <select
          aria-label="Pilih nama Anda"
          value={code}
          onChange={(e) => choose(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Pilih nama Anda…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.code}>
              {displayName(a)}
            </option>
          ))}
        </select>
      </div>

      {!agent ? (
        <p className="mt-3 text-sm text-slate-500">
          Pilih nama Anda sekali saja; portal akan mengingatnya di perangkat ini dan menampilkan jadwal Anda berikutnya di
          beranda.
        </p>
      ) : slots.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {displayName(agent)} tidak mendapat jadwal floor time bulan ini.{' '}
          {requestOpen && (
            <button
              type="button"
              onClick={() => onRequest(agent.id, 'add')}
              className="font-bold text-slate-800 underline underline-offset-2 hover:text-amber-700 cursor-pointer"
            >
              Ajukan tambah jadwal
            </button>
          )}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            {next ? (
              <p className="text-sm text-slate-700">
                Berikutnya:{' '}
                <b className="text-slate-950">
                  {titleCase(DAY_NAMES_ID[weekdayOf(next.date)])}, {formatDateId(next.date)} · {next.shiftName}{' '}
                  {next.timeLabel.replace('-', '–')}
                </b>
              </p>
            ) : (
              <p className="text-sm text-slate-700">Semua jadwal bulan ini sudah selesai.</p>
            )}
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {slots.map((s) => {
                const isNext = next?.key === s.key;
                const past = !isNext && s.date <= today && (!next || s.key < next.key);
                const label = `${titleCase(DAY_NAMES_ID[weekdayOf(s.date)]).slice(0, 3)} ${Number(s.date.slice(8))} · ${s.shiftName}`;
                const canMove = requestOpen && !past && s.date >= today;
                return (
                  <li
                    key={s.key}
                    className={`inline-flex items-stretch overflow-hidden rounded-full ring-1 ${
                      isNext ? 'bg-amber-400 ring-amber-400' : past ? 'bg-slate-50 ring-slate-200' : 'bg-white ring-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onJump(s.weekNo)}
                      title="Lihat di jadwal mingguan"
                      className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        isNext
                          ? 'text-slate-950'
                          : past
                            ? 'text-slate-400 line-through'
                            : 'text-slate-800 hover:bg-amber-50'
                      }`}
                    >
                      {label}
                    </button>
                    {canMove && (
                      <button
                        type="button"
                        onClick={() => onRequest(agent.id, 'move', s.key)}
                        aria-label={`Ajukan pindah jadwal ${label}`}
                        title="Ajukan pindah jadwal ini"
                        className={`inline-flex items-center gap-1 border-l px-2 text-[11px] font-bold cursor-pointer ${
                          isNext
                            ? 'border-amber-500/40 text-slate-900 hover:bg-amber-300'
                            : 'border-slate-200 text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                        Pindah
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{slots.length} jadwal bulan ini</span>
              {requestOpen ? (
                <>
                  <span>
                    Tekan <b className="text-amber-700">Pindah</b> untuk mengajukan perubahan.
                  </span>
                  <button
                    type="button"
                    onClick={() => onRequest(agent.id, 'add')}
                    className="inline-flex items-center gap-1 font-bold text-slate-800 underline underline-offset-2 hover:text-amber-700 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Ajukan tambah jadwal
                  </button>
                </>
              ) : (
                <span>Batas request perubahan sudah lewat.</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadText(
                buildIcs(slots, { agentName: displayName(agent), location: `${OFFICE_IDENTITY.name}, ${OFFICE_IDENTITY.address}` }),
                `floor-time-${agent.code.toLowerCase()}-${data.year}-${String(data.month).padStart(2, '0')}.ics`,
                'text/calendar;charset=utf-8'
              )
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 cursor-pointer"
          >
            <CalendarPlus className="h-4 w-4 text-amber-400" aria-hidden="true" />
            Simpan ke kalender
          </button>
        </div>
      )}
      {agent && (
        <p className="sr-only" aria-live="polite">
          <CalendarCheck aria-hidden="true" /> Jadwal {displayName(agent)} ditampilkan.
        </p>
      )}
    </section>
  );
};
