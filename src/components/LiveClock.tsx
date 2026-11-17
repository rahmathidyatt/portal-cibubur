import React, { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import type { OfficeDaySchedule } from '../data/cibuburData';
import { formatLongDateId, getOfficeStatus, isStaffBreak, minutesNowInJakarta, todayInJakarta } from '../utils/schedule';

function partsInJakarta(d: Date): { hh: string; mm: string; ss: string } {
  const t = new Date(d.getTime() + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return { hh: p(t.getUTCHours()), mm: p(t.getUTCMinutes()), ss: p(t.getUTCSeconds()) };
}

/** Satu baris: hari & tanggal · jam berdetik WIB (+ "Staf sedang istirahat" pukul 12.00–13.00). */
export const DateClock: React.FC<{ weeklyHours: OfficeDaySchedule[] }> = ({ weeklyHours }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const { hh, mm, ss } = partsInJakarta(now);
  const onBreak = isStaffBreak(getOfficeStatus(weeklyHours, now), minutesNowInJakarta(now));

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-500">
      <span>{formatLongDateId(todayInJakarta(now))}</span>
      <span aria-hidden="true" className="text-slate-300">
        ·
      </span>
      <time dateTime={`${hh}:${mm}`} className="font-semibold tabular-nums text-slate-800">
        {hh}:{mm}
        <span className="text-slate-400">:{ss}</span> WIB
      </time>
      {onBreak && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
          Staf sedang istirahat
        </span>
      )}
    </p>
  );
};

/** Status kantor buka/tutup (dipakai di footer), diperbarui tiap menit. */
export const OfficeStatusBadge: React.FC<{ weeklyHours: OfficeDaySchedule[] }> = ({ weeklyHours }) => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const status = getOfficeStatus(weeklyHours, now);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        status.isOpen ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-stone-100 text-slate-700 ring-1 ring-slate-200'
      }`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      Kantor {status.label.toLowerCase()}
    </span>
  );
};
