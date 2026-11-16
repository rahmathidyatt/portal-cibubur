import React, { useState } from 'react';
import { Clock, MapPin, Phone, Copy, Check } from 'lucide-react';
import { OFFICE_IDENTITY, type OfficeDaySchedule } from '../data/cibuburData';
import { getScheduleForDate, todayInJakarta } from '../utils/schedule';
import { useJakartaClock } from '../hooks/useJakartaClock';
// Di-import (bukan string path) agar Vite menyalin & meng-hash gambar saat `npm run build`.
import officePhoto from '../assets/images/hero-cibubur-office.webp';

const DISPLAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface OfficeHoursLocationProps {
  weeklyHours: OfficeDaySchedule[];
}

export const OfficeHoursLocation: React.FC<OfficeHoursLocationProps> = ({ weeklyHours }) => {
  const now = useJakartaClock();
  const todayId = getScheduleForDate(todayInJakarta(now), weeklyHours)?.dayId;
  const [copied, setCopied] = useState<boolean>(false);
  const [photoFailed, setPhotoFailed] = useState<boolean>(false);

  const days = DISPLAY_ORDER.map((id) => weeklyHours.find((d) => d.dayId === id)).filter(
    (d): d is OfficeDaySchedule => Boolean(d)
  );

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(OFFICE_IDENTITY.phoneDisplay).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="jam-operasional" className="scroll-mt-20 py-12 sm:py-16 bg-stone-50 border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Jam operasional & lokasi
        </h2>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Jadwal mingguan */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <Clock className="w-4 h-4 text-slate-500" />
              Jam layanan kantor
              <span className="ml-auto text-xs font-medium text-slate-500">WIB</span>
            </h3>
            <ul className="mt-4 divide-y divide-slate-100">
              {days.map((day) => {
                const isToday = day.dayId === todayId;
                return (
                  <li
                    key={day.dayId}
                    className={`flex items-start justify-between gap-4 py-2.5 px-2 -mx-2 rounded-lg ${
                      isToday ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div>
                      <span className={`text-sm ${isToday ? 'font-bold text-slate-950' : 'text-slate-800'}`}>
                        {day.dayNameId}
                      </span>
                      {isToday && (
                        <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                          Hari ini
                        </span>
                      )}
                      {day.note && <p className="text-xs text-slate-500 mt-0.5">{day.note}</p>}
                    </div>
                    <span
                      className={`font-mono text-sm whitespace-nowrap ${
                        day.isClosed ? 'text-slate-400' : 'text-slate-900 font-semibold'
                      }`}
                    >
                      {day.isClosed ? 'Tutup' : day.hours.replace(' - ', ' – ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Kantor */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {!photoFailed && (
              <img
                src={officePhoto}
                alt={`Ruang kantor ${OFFICE_IDENTITY.name}`}
                width={1376}
                height={768}
                loading="lazy"
                decoding="async"
                onError={() => setPhotoFailed(true)}
                className="w-full aspect-[16/8] object-cover"
              />
            )}
            <div className="p-5 sm:p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-950">{OFFICE_IDENTITY.name}</h3>
              <p className="flex items-start gap-2.5 text-sm text-slate-700">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                {OFFICE_IDENTITY.address}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 border border-slate-200 px-4 py-3">
                <p className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="font-mono text-base font-semibold text-slate-950">
                    {OFFICE_IDENTITY.phoneDisplay}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin
                      </>
                    )}
                  </button>
                  <a
                    href={OFFICE_IDENTITY.phoneHref}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Telepon
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
