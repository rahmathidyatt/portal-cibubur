import React, { useEffect, useState } from 'react';
import { Cake, Gift } from 'lucide-react';
import { getBirthdayStore } from '../services/birthdayStore';
import { birthdayReminders, type AgentBirthday } from '../features/birthdays/birthdays';

/** Pengingat beranda: agen yang berulang tahun hari ini (H) dan besok (H-1). */
export const BirthdayReminderCard: React.FC<{ today: string }> = ({ today }) => {
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
    <section
      aria-labelledby="ulang-tahun-title"
      className="bg-white border border-amber-200 rounded-2xl p-5 sm:p-6"
    >
      <h2 id="ulang-tahun-title" className="flex items-center gap-2 text-base font-bold text-slate-950">
        <Cake className="w-4 h-4 text-amber-600" aria-hidden="true" />
        Ulang tahun agen
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {todayList.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Hari ini</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {todayList.map((b) => (
                <li
                  key={b.code}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-sm font-bold text-slate-950"
                >
                  <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                  {b.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Jangan lupa ucapkan selamat ulang tahun.</p>
          </div>
        )}
        {tomorrow.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Besok</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {tomorrow.map((b) => (
                <li
                  key={b.code}
                  className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-amber-200"
                >
                  {b.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
