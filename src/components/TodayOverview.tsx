import React, { useState } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import type { OfficeDaySchedule } from '../data/cibuburData';
import { Cake, CalendarPlus } from 'lucide-react';
import { FloorTimeTodayCard } from './dashboard/FloorTimeTodayCard';
import { DealingRoomTodayCard } from './dashboard/DealingRoomTodayCard';
import { FEATURES } from '../data/features';
import { OFFICE_IDENTITY } from '../data/cibuburData';
import { AnnouncementsCard } from './AnnouncementsCard';
import { BirthdayReminder } from './BirthdayReminder';
import { DateClock } from './LiveClock';
import { ClosingShowcase } from '../features/closing/ClosingShowcase';
import { officeAnniversary } from '../utils/anniversary';
import { useJakartaClock } from '../hooks/useJakartaClock';
import {
  minutesNowInJakarta,
  todayInJakarta
} from '../utils/schedule';

interface TodayOverviewProps {
  weeklyHours: OfficeDaySchedule[];
}

export const TodayOverview: React.FC<TodayOverviewProps> = ({ weeklyHours }) => {
  const now = useJakartaClock();
  const today = todayInJakarta(now);
  const anniv = officeAnniversary(OFFICE_IDENTITY.foundedDate, today);

  const minutesNow = minutesNowInJakarta(now);
  const { isAdmin } = useAdmin();
  const [announcementCount, setAnnouncementCount] = useState<number>(0);
  const showAnnouncements = isAdmin || announcementCount > 0;
  const cards = 1 + (FEATURES.dealingRoom ? 1 : 0) + (showAnnouncements ? 1 : 0);

  return (
    <section id="beranda" className="scroll-mt-20 border-b border-slate-200 bg-stone-50">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div>
          <DateClock weeklyHours={weeklyHours} />
          <h1 className="sr-only">Brighton HUB Cibubur</h1>
          <BirthdayReminder today={today} />
          {FEATURES.dealingRoom && (
            <a
              href="#dealing-room"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Pesan Dealing Room
            </a>
          )}
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
                Berdiri sejak 3 Mei 2023. Terima kasih untuk seluruh tim yang sudah tumbuh bersama.
              </p>
            </div>
          </div>
        )}

        {/* Kartu utama: sama tinggi dalam satu baris. */}
        <div
          className={`mt-6 grid gap-4 items-stretch ${cards >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : cards === 2 ? 'md:grid-cols-2' : ''}`}
        >
          <div className="flex flex-col gap-3">
            <FloorTimeTodayCard today={today} minutesNow={minutesNow} />
            <a
              href={OFFICE_IDENTITY.smartMessengerOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block cursor-pointer rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-slate-200/70 backdrop-blur transition duration-150 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-2 hover:ring-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:translate-y-0"
            >
              <span className="block text-sm font-bold text-slate-950 group-hover:text-amber-700">Order Smart Messenger</span>
              <span className="block text-xs text-slate-500">Isi formulir order untuk kebutuhan smart messenger</span>
            </a>
          </div>
          {FEATURES.dealingRoom && <DealingRoomTodayCard today={today} minutesNow={minutesNow} />}
          <AnnouncementsCard onLoaded={setAnnouncementCount} />
        </div>

        <ClosingShowcase />
      </div>
    </section>
  );
};
