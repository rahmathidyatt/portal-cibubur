import React, { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import type { OfficeDaySchedule } from '../data/cibuburData';
import { formatLongDateId, getOfficeStatus, isStaffBreak, minutesNowInJakarta, todayInJakarta } from '../utils/schedule';

function partsInJakarta(d: Date): { hh: string; mm: string; ss: string } {
  const t = new Date(d.getTime() + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return { hh: p(t.getUTCHours()), mm: p(t.getUTCMinutes()), ss: p(t.getUTCSeconds()) };
}

/** Baris status beranda: tanggal, jam besar berdetik (WIB) dan status kantor. */
export const DateClock: React.FC<{ weeklyHours: OfficeDaySchedule[] }> = ({ weeklyHours }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const { hh, mm, ss } = partsInJakarta(now);
  const status = getOfficeStatus(weeklyHours, now);
  const onBreak = isStaffBreak(status, minutesNowInJakarta(now));

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{formatLongDateId(todayInJakarta(now))}</p>
        <time dateTime={`${hh}:${mm}`} className="mt-1 block text-4xl font-bold tracking-tight tabular-nums text-slate-950 sm:text-5xl">
          {hh}:{mm}
          <span className="text-slate-300">:{ss}</span>
          <span className="ml-2 align-middle text-base font-semibold tracking-normal text-slate-500 sm:text-lg">WIB</span>
        </time>
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-1">
        {onBreak && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            Staf sedang istirahat
          </span>
        )}
        <OfficeStatusBadge weeklyHours={weeklyHours} large />
      </div>
    </div>
  );
};

/** Status kantor buka/tutup (dipakai di footer), diperbarui tiap menit. */
export const OfficeStatusBadge: React.FC<{ weeklyHours: OfficeDaySchedule[]; large?: boolean }> = ({ weeklyHours, large }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const status = getOfficeStatus(weeklyHours, now);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${large ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'} ${
        status.isOpen ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-stone-100 text-slate-700 ring-1 ring-slate-200'
      }`}
    >
      <span aria-hidden="true" className={`${large ? 'h-2 w-2' : 'h-1.5 w-1.5'} rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      Kantor {status.label.toLowerCase()}
    </span>
  );
};
