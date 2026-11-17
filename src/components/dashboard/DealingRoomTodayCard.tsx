import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { INITIAL_DEALING_ROOMS, WEEKLY_OFFICE_HOURS, type RoomSlotStatus } from '../../data/cibuburData';
import { getBookingStore } from '../../services/bookingStore';
import { buildRoomsForDate, getScheduleForDate, type RoomBooking } from '../../utils/schedule';
import { CardSkeleton, DashCard, EmptyNote } from './DashCard';

const STATUS_STYLE: Record<RoomSlotStatus, string> = {
  Tersedia: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Terisi: 'bg-amber-100 text-amber-900 ring-amber-300',
  'Sudah Lewat': 'bg-slate-50 text-slate-400 ring-slate-200 line-through',
  'Di Luar Jam': 'bg-slate-50 text-slate-400 ring-slate-200'
};

/** Sisa slot Dealing Room hari ini. */
export const DealingRoomTodayCard: React.FC<{ today: string; minutesNow: number }> = ({ today, minutesNow }) => {
  const [bookings, setBookings] = useState<RoomBooking[] | null>(null);

  useEffect(() => {
    let alive = true;
    getBookingStore()
      .listRoomBookings(today)
      .then((b) => alive && setBookings(b))
      .catch(() => alive && setBookings([]));
    return () => {
      alive = false;
    };
  }, [today]);

  const closed = getScheduleForDate(today, WEEKLY_OFFICE_HOURS)?.isClosed ?? true;
  let body: React.ReactNode;
  if (closed) {
    body = <EmptyNote>Kantor tutup hari ini.</EmptyNote>;
  } else if (!bookings) {
    body = <CardSkeleton />;
  } else {
    const rooms = buildRoomsForDate(INITIAL_DEALING_ROOMS, bookings, today, WEEKLY_OFFICE_HOURS, minutesNow);
    body = (
      <ul className="space-y-4">
        {rooms.map((room) => {
          const free = room.slots.filter((s) => s.status === 'Tersedia').length;
          return (
            <li key={room.id}>
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{room.tabLabel}</span>
                <span className={`text-xs font-semibold ${free > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {free > 0 ? `${free} slot tersedia` : 'Penuh / selesai'}
                </span>
              </p>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {room.slots.map((s) => (
                  <span
                    key={s.time}
                    title={s.status === 'Terisi' ? `${s.time} · ${s.bookedBy ?? 'Terisi'}` : `${s.time} · ${s.status}`}
                    className={`rounded-md px-1 py-1 text-center text-[11px] font-semibold tabular-nums ring-1 ${STATUS_STYLE[s.status]}`}
                  >
                    {s.time.split(' - ')[0]}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <DashCard id="dr-today" title="Dealing Room hari ini" Icon={Calendar} action={{ href: '#dealing-room', label: 'Pesan' }}>
      {body}
    </DashCard>
  );
};
