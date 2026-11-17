import React, { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import type { OfficeDaySchedule } from '../data/cibuburData';
import { getOfficeStatus, isStaffBreak, minutesNowInJakarta } from '../utils/schedule';

function partsInJakarta(d: Date): { hh: string; mm: string; ss: string } {
  const t = new Date(d.getTime() + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return { hh: p(t.getUTCHours()), mm: p(t.getUTCMinutes()), ss: p(t.getUTCSeconds()) };
}

/** Jam digital WIB + status kantor; pukul 12.00–13.00 menampilkan "Staf sedang istirahat". */
export const LiveClock: React.FC<{ weeklyHours: OfficeDaySchedule[] }> = ({ weeklyHours }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const { hh, mm, ss } = partsInJakarta(now);
  const status = getOfficeStatus(weeklyHours, now);
  const onBreak = isStaffBreak(status, minutesNowInJakarta(now));

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-slate-200">
      <p className="font-display text-3xl font-extrabold leading-none tracking-tight text-slate-950 tabular-nums" aria-live="off">
        <time dateTime={`${hh}:${mm}`}>
          {hh}
          <span className="animate-pulse motion-reduce:animate-none text-amber-500">:</span>
          {mm}
        </time>
        <span className="ml-1 align-top text-sm font-bold text-slate-400">{ss}</span>
      </p>
      <div className="border-l border-slate-200 pl-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">WIB</p>
        {onBreak ? (
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            Staf sedang istirahat
          </p>
        ) : (
          <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status.isOpen ? 'text-emerald-700' : 'text-slate-600'}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            Kantor {status.label.toLowerCase()}
          </p>
        )}
      </div>
    </div>
  );
};
