import React, { useState } from 'react';
import { Clock, MapPin, Phone, Copy, Check, ExternalLink } from 'lucide-react';
import { OFFICE_IDENTITY, type OfficeDaySchedule } from '../data/cibuburData';
import { getScheduleForDate, todayInJakarta } from '../utils/schedule';
import { useJakartaClock } from '../hooks/useJakartaClock';
import { SectionHeading } from './SectionHeading';

const DISPLAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface OfficeHoursLocationProps {
  weeklyHours: OfficeDaySchedule[];
}

export const OfficeHoursLocation: React.FC<OfficeHoursLocationProps> = ({ weeklyHours }) => {
  const now = useJakartaClock();
  const todayId = getScheduleForDate(todayInJakarta(now), weeklyHours)?.dayId;
  const [copied, setCopied] = useState<boolean>(false);

  const days = DISPLAY_ORDER.map((id) => weeklyHours.find((d) => d.dayId === id)).filter(
    (d): d is OfficeDaySchedule => Boolean(d)
  );

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(OFFICE_IDENTITY.phoneDisplay).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Hari berurutan dengan jam sama digabung: "Senin – Jumat 08:00–17:00".
  const groups: { from: OfficeDaySchedule; to: OfficeDaySchedule; ids: string[] }[] = [];
  for (const day of days) {
    const last = groups[groups.length - 1];
    if (last && last.to.hours === day.hours && last.to.isClosed === day.isClosed) {
      last.to = day;
      last.ids.push(day.dayId);
    } else {
      groups.push({ from: day, to: day, ids: [day.dayId] });
    }
  }

  return (
    <section id="jam-operasional" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <SectionHeading overline="Kunjungi kami" title="Jam operasional & lokasi" />

        {/* Satu kartu: jam layanan di kiri, alamat di kanan. */}
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:grid-cols-2">
          <div className="p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <Clock className="w-4 h-4 text-slate-500" />
              Jam layanan kantor
              <span className="ml-auto text-[11px] font-medium text-slate-500">WIB</span>
            </h3>
            <ul className="mt-3 space-y-0.5">
              {groups.map((g) => {
                const isToday = todayId !== undefined && g.ids.includes(todayId);
                const label =
                  g.from.dayId === g.to.dayId ? g.from.dayNameId : `${g.from.dayNameId} – ${g.to.dayNameId}`;
                return (
                  <li
                    key={g.from.dayId}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm ${
                      isToday ? 'bg-amber-50 ring-1 ring-amber-200' : ''
                    }`}
                  >
                    <span className={isToday ? 'font-bold text-slate-950' : 'text-slate-700'}>
                      {label}
                    </span>
                    <span
                      className={`tabular-nums whitespace-nowrap ${g.from.isClosed ? 'text-slate-500' : 'font-semibold text-slate-900'}`}
                    >
                      {g.from.isClosed ? 'Tutup' : g.from.hours.replace(' - ', '–')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-stone-50/60 p-5 sm:p-6 md:border-l md:border-t-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <MapPin className="w-4 h-4 text-slate-500" />
              Alamat kantor
            </h3>
            <p className="text-sm leading-relaxed text-slate-700">{OFFICE_IDENTITY.address}</p>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <a
                href={OFFICE_IDENTITY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                Google Maps
              </a>
              <a
                href={OFFICE_IDENTITY.phoneHref}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg"
              >
                <Phone className="w-3.5 h-3.5" />
                {OFFICE_IDENTITY.phoneDisplay}
              </a>
              <button
                type="button"
                onClick={handleCopyPhone}
                aria-label="Salin nomor telepon kantor"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
