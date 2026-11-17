import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getScheduleStore } from '../../features/floortime/scheduleStore';
import type { PublishedSchedule } from '../../features/floortime/requests';
import { CardSkeleton, DashCard, EmptyNote } from './DashCard';

/** Siapa yang jaga Floor Time hari ini (dari jadwal bulanan yang terbit). */
export const FloorTimeTodayCard: React.FC<{ today: string; minutesNow: number }> = ({ today, minutesNow }) => {
  const [schedule, setSchedule] = useState<PublishedSchedule | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const [y, m] = today.split('-').map(Number);
    getScheduleStore()
      .getSchedule(y, m)
      .then((s) => alive && setSchedule(s))
      .catch(() => alive && setSchedule(null));
    return () => {
      alive = false;
    };
  }, [today]);

  let body: React.ReactNode;
  if (schedule === undefined) {
    body = <CardSkeleton />;
  } else if (!schedule) {
    body = <EmptyNote>Jadwal floor time bulan ini belum terbit.</EmptyNote>;
  } else if (schedule.data.holidays[today] !== undefined) {
    body = <EmptyNote>Libur · {schedule.data.holidays[today]}</EmptyNote>;
  } else {
    const slots = schedule.data.slots.filter((s) => s.date === today).sort((a, b) => a.shiftIndex - b.shiftIndex);
    body =
      slots.length === 0 ? (
        <EmptyNote>Tidak ada floor time hari ini.</EmptyNote>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {slots.map((slot) => {
            const [start, end] = slot.timeLabel.split('-').map((t) => {
              const [h, mm] = t.split('.').map(Number);
              return h * 60 + (mm || 0);
            });
            const live = minutesNow >= start && minutesNow < end;
            const done = minutesNow >= end;
            const people = schedule.data.assignments[slot.key] ?? [];
            return (
              <div
                key={slot.key}
                className={`rounded-xl p-3 ring-1 ${live ? 'bg-amber-50 ring-amber-300' : 'bg-stone-50 ring-slate-200'} ${done ? 'opacity-60' : ''}`}
              >
                <p className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900">
                  {slot.shiftName}
                  {live && (
                    <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">Sekarang</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">{slot.timeLabel.replace('-', '–')}</p>
                <ul className="mt-2 space-y-1">
                  {people.map((p) => (
                    <li key={p.agentId} className="truncate text-sm font-semibold text-slate-800" title={p.displayName}>
                      {p.displayName}
                    </li>
                  ))}
                  {people.length === 0 && <li className="text-xs text-slate-400">Belum terisi</li>}
                </ul>
              </div>
            );
          })}
        </div>
      );
  }

  return (
    <DashCard id="ft-today" title="Floor Time hari ini" Icon={Users} action={{ href: '#floortime', label: 'Jadwal lengkap' }}>
      {body}
    </DashCard>
  );
};
