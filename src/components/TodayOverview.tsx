import React from 'react';
import type { MorningQuote, OfficeDaySchedule } from '../data/cibuburData';
import { MorningInspirationCard } from './MorningInspirationCard';
import { AnnouncementsCard } from './AnnouncementsCard';
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
  quotes: MorningQuote[];
}

export const TodayOverview: React.FC<TodayOverviewProps> = ({ weeklyHours, quotes }) => {
  const now = useJakartaClock();
  const today = todayInJakarta(now);
  const greeting = greetingForMinutes(minutesNowInJakarta(now));
  const status = getOfficeStatus(weeklyHours, now);

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

        <div className="mt-8 flex flex-col lg:flex-row gap-6 items-start">
          <MorningInspirationCard quotes={quotes} />
          <AnnouncementsCard />
        </div>
      </div>
    </section>
  );
};
