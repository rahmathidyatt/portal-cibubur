import React from 'react';
import type { OfficeDaySchedule } from '../data/cibuburData';
import { Cake, CalendarPlus } from 'lucide-react';
import { FloorTimeTodayCard } from './dashboard/FloorTimeTodayCard';
import { DealingRoomTodayCard } from './dashboard/DealingRoomTodayCard';
import { FEATURES } from '../data/features';
import { OFFICE_IDENTITY } from '../data/cibuburData';
import { AnnouncementsCard } from './AnnouncementsCard';
import { BirthdayReminder } from './BirthdayReminder';
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

  const minutesNow = minutesNowInJakarta(now);

  return (
    <section id="beranda" className="scroll-mt-20 border-b border-slate-200 bg-stone-50">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{formatLongDateId(today)}</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 text-balance">
              {greeting}, tim Brighton HUB Cibubur
            </h1>
            <BirthdayReminder today={today} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                status.isOpen
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              Kantor {status.label.toLowerCase()}
            </p>
            {FEATURES.dealingRoom && (
            <a
              href="#dealing-room"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Pesan Dealing Room
            </a>
            )}
          </div>
        </div>

        {anniv.isToday && (
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"
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

        <div className={`mt-6 grid gap-4 ${FEATURES.dealingRoom ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'}`}>
          <FloorTimeTodayCard today={today} minutesNow={minutesNow} />
          {FEATURES.dealingRoom && <DealingRoomTodayCard today={today} minutesNow={minutesNow} />}
          <AnnouncementsCard />
        </div>
      </div>
    </section>
  );
};
