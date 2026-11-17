import React, { useEffect, useState } from 'react';
import { Cake } from 'lucide-react';
import { getBirthdayStore } from '../services/birthdayStore';
import { birthdayReminders, type AgentBirthday } from '../features/birthdays/birthdays';

/**
 * Pengingat ulang tahun agen di bawah sapaan beranda: hari ini (H) dan besok (H-1).
 * Tidak tampil bila tidak ada yang berulang tahun.
 */
export const BirthdayReminder: React.FC<{ today: string }> = ({ today }) => {
  const [list, setList] = useState<AgentBirthday[]>([]);

  useEffect(() => {
    let alive = true;
    getBirthdayStore()
      .list()
      .then((rows) => alive && setList(rows))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, []);

  const { today: todayList, tomorrow } = birthdayReminders(list, today);
  if (todayList.length === 0 && tomorrow.length === 0) return null;

  return (
    <div
      role="note"
      aria-label="Ulang tahun agen"
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
        <Cake className="h-4 w-4 text-amber-600" aria-hidden="true" />
        Ulang tahun
      </span>
      {todayList.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Hari ini</span>
          {todayList.map((b) => (
            <span key={b.code} className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-slate-950">
              {b.name}
            </span>
          ))}
        </span>
      )}
      {todayList.length > 0 && tomorrow.length > 0 && (
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
      )}
      {tomorrow.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Besok</span>
          {tomorrow.map((b) => (
            <span
              key={b.code}
              className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-amber-200"
            >
              {b.name}
            </span>
          ))}
        </span>
      )}
    </div>
  );
};
