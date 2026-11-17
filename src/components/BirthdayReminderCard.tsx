import React, { useEffect, useState } from 'react';
import { Cake, Gift } from 'lucide-react';
import { getBirthdayStore } from '../services/birthdayStore';
import { birthdayReminders, type AgentBirthday } from '../features/birthdays/birthdays';
import { CardSkeleton, DashCard, EmptyNote } from './dashboard/DashCard';

/** Pengingat beranda: agen yang berulang tahun hari ini (H) dan besok (H-1). */
export const BirthdayReminderCard: React.FC<{ today: string }> = ({ today }) => {
  const [list, setList] = useState<AgentBirthday[] | null>(null);

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

  let body: React.ReactNode;
  if (!list) {
    body = <CardSkeleton lines={2} />;
  } else {
    const { today: todayList, tomorrow } = birthdayReminders(list, today);
    body =
      todayList.length === 0 && tomorrow.length === 0 ? (
        <EmptyNote>Tidak ada yang berulang tahun hari ini atau besok.</EmptyNote>
      ) : (
        <div className="space-y-4">
          {todayList.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Hari ini</p>
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
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Besok</p>
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
      );
  }

  return (
    <DashCard id="ulang-tahun-title" title="Ulang tahun agen" Icon={Cake}>
      {body}
    </DashCard>
  );
};
