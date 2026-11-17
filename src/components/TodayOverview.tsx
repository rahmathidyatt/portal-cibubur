import React from 'react';
import type { OfficeDaySchedule } from '../data/cibuburData';
import { Cake } from 'lucide-react';
import { OFFICE_IDENTITY } from '../data/cibuburData';
import { AnnouncementsCard } from './AnnouncementsCard';
import { BirthdayReminderCard } from './BirthdayReminderCard';
import { officeAnniversary } from '../utils/anniversary';
import { useJakartaClock } from '../hooks/useJakartaClock';
import {
  formatLongDateId,
  getOfficeStatus,
  greetingForMinutes,
  minutesNowInJakarta,
  todayInJakarta
} from '../utils/schedule';

interface TodayOverviewProps {
  weeklyHours: OfficeDaySchedule[];
}

export const TodayOverview: React.FC<TodayOverviewProps> = ({ weeklyHours }) => {
  const now = useJakartaClock();
  const today = todayInJakarta(now);
  const greeting = greetingForMinutes(minutesNowInJakarta(now));
  const status = getOfficeStatus(weeklyHours, now);
  const anniv = officeAnniversary(OFFICE_IDENTITY.foundedDate, today);

  return (
    <section id="beranda" className="scroll-mt-20 border-b border-slate-200 bg-stone-50">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="text-sm font-medium text-slate-500">{formatLongDateId(today)}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 text-balance">
          {greeting}, tim Brighton HUB Cibubur
        </h1>
        <p
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
            status.isOpen
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`}
          />
          Kantor {status.label.toLowerCase()}
        </p>

        {anniv.isToday && (
          <div
            role="status"
            className="mt-6 max-w-3xl flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"
          >
            <Cake className="w-6 h-6 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="text-base font-bold text-slate-950">
                Selamat ulang tahun ke-{anniv.age}, {OFFICE_IDENTITY.name}!
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                Berdiri sejak 6 Mei 2023. Terima kasih untuk seluruh tim yang sudah tumbuh bersama.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 max-w-3xl space-y-4 empty:hidden">
          <BirthdayReminderCard today={today} />
          <AnnouncementsCard />
        </div>
      </div>
    </section>
  );
};
