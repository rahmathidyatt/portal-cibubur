import React, { useMemo } from 'react';
import { Calendar, Users, MessageCircle, ArrowUpRight } from 'lucide-react';
import type {
  DealingRoom,
  FloortimeSlot,
  MorningQuote,
  OfficeDaySchedule
} from '../data/cibuburData';
import type { BookingPortalTab } from './BookingPortalModal';
import { MorningInspirationCard } from './MorningInspirationCard';
import { useBookings } from '../hooks/useBookings';
import { useJakartaClock } from '../hooks/useJakartaClock';
import {
  buildRoomsForDate,
  buildShiftsForDate,
  formatLongDateId,
  getOfficeStatus,
  getScheduleForDate,
  greetingForMinutes,
  isShiftActiveOnDate,
  minutesNowInJakarta,
  todayInJakarta
} from '../utils/schedule';

interface TodayOverviewProps {
  weeklyHours: OfficeDaySchedule[];
  roomTemplates: DealingRoom[];
  shiftTemplates: FloortimeSlot[];
  quotes: MorningQuote[];
  refreshKey: number;
  onOpenPortal: (tab?: BookingPortalTab) => void;
}

export const TodayOverview: React.FC<TodayOverviewProps> = ({
  weeklyHours,
  roomTemplates,
  shiftTemplates,
  quotes,
  refreshKey,
  onOpenPortal
}) => {
  const now = useJakartaClock();
  const today = todayInJakarta(now);
  const greeting = greetingForMinutes(minutesNowInJakarta(now));
  const status = getOfficeStatus(weeklyHours, now);
  const todaySchedule = getScheduleForDate(today, weeklyHours);
  const isClosedToday = !todaySchedule || todaySchedule.isClosed;

  const { roomBookings, registrations, isLoading, error } = useBookings(today, refreshKey);

  const rooms = useMemo(
    () => buildRoomsForDate(roomTemplates, roomBookings, today, weeklyHours),
    [roomTemplates, roomBookings, today, weeklyHours]
  );
  const shifts = useMemo(
    () =>
      buildShiftsForDate(shiftTemplates, registrations, today).filter((s) =>
        isShiftActiveOnDate(s, today)
      ),
    [shiftTemplates, registrations, today]
  );

  return (
    <section id="beranda" className="scroll-mt-20 border-b border-slate-200 bg-stone-50">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Kiri: sapaan, status kantor, aksi utama, inspirasi */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          <div>
            <p className="text-sm font-medium text-slate-500">{formatLongDateId(today)}</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 text-balance">
              {greeting}, tim Brighton HUB Cibubur
            </h1>
            <p className="mt-3 text-base text-slate-600 max-w-xl">
              Reservasi Dealing Room, daftar floortime, dan hubungi staf kantor dari satu tempat.
            </p>

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

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenPortal('dealing-room-1')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                Reservasi Dealing Room
              </button>
              <button
                type="button"
                onClick={() => onOpenPortal('floortime')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Daftar Floortime
              </button>
              <a
                href="#kontak-staf"
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Hubungi Staf
              </a>
            </div>
          </div>

          <MorningInspirationCard quotes={quotes} />
        </div>

        {/* Kanan: agenda hari ini */}
        <aside
          aria-labelledby="agenda-hari-ini"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 self-start"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="agenda-hari-ini" className="text-lg font-bold text-slate-950">
              Agenda hari ini
            </h2>
            {!isClosedToday && (
              <button
                type="button"
                onClick={() => onOpenPortal('dealing-room-1')}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-amber-700 cursor-pointer"
              >
                Pesan ruang
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isClosedToday ? (
            <p className="mt-4 text-sm text-slate-600">
              Kantor tutup hari ini. {status.label.replace(/^Tutup · /, 'Kantor ')}.
            </p>
          ) : error ? (
            <p className="mt-4 text-sm text-red-700">Agenda belum bisa dimuat: {error}</p>
          ) : (
            <div className={`mt-4 space-y-5 ${isLoading ? 'opacity-60' : ''}`}>
              {rooms.map((room) => (
                <div key={room.id}>
                  <p className="text-xs font-semibold text-slate-500">
                    {room.tabLabel} · {room.floorAndLocation.split(' · ')[0]}
                  </p>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {room.slots.map((slot) => (
                      <li
                        key={slot.time}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="font-mono text-xs text-slate-700 whitespace-nowrap">
                          {slot.time}
                        </span>
                        {slot.status === 'Terisi' ? (
                          <span className="truncate text-right text-slate-900 font-medium">
                            {slot.bookedBy}
                            <span className="text-slate-500 font-normal"> · {slot.agenda}</span>
                          </span>
                        ) : slot.status === 'Di Luar Jam' ? (
                          <span className="text-slate-400 text-xs">Di luar jam</span>
                        ) : (
                          <span className="text-emerald-700 text-xs font-semibold">Kosong</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <p className="text-xs font-semibold text-slate-500">Floortime</p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {shifts.map((shift) => (
                    <li key={shift.id} className="px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900">
                          {shift.shiftName.replace('Floortime ', '')}
                        </span>
                        <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
                          {shift.registeredAdvisors.length}/{shift.quotaMax}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {shift.registeredAdvisors.length > 0
                          ? shift.registeredAdvisors.map((a) => a.advisorName).join(', ')
                          : 'Belum ada advisor terdaftar'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
