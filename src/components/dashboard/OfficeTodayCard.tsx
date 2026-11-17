import React from 'react';
import { Clock, MapPin, MessageCircle } from 'lucide-react';
import { OFFICE_IDENTITY, OFFICE_STAFF_CONTACTS, WEEKLY_OFFICE_HOURS } from '../../data/cibuburData';
import { buildWhatsAppChatUrl } from '../../utils/hubLogic';
import { getScheduleForDate, type OfficeStatus } from '../../utils/schedule';
import { DashCard } from './DashCard';

/** Jam kantor hari ini + akses cepat ke Operasional dan lokasi. */
export const OfficeTodayCard: React.FC<{ today: string; status: OfficeStatus }> = ({ today, status }) => {
  const schedule = getScheduleForDate(today, WEEKLY_OFFICE_HOURS);
  const ops = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'OPERASIONAL') ?? OFFICE_STAFF_CONTACTS[0];
  return (
    <DashCard id="office-today" title="Kantor hari ini" Icon={Clock} action={{ href: '#jam-operasional', label: 'Jadwal' }}>
      <p className="text-2xl font-bold tabular-nums text-slate-950">
        {schedule && !schedule.isClosed ? schedule.hours.replace(/\s*-\s*/, '–') : 'Tutup'}
      </p>
      <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${status.isOpen ? 'text-emerald-700' : 'text-slate-500'}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        {status.label}
      </p>
      <div className="mt-4 grid gap-2">
        {ops && (
          <a
            href={buildWhatsAppChatUrl(ops.whatsappNumber, ops.defaultMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Chat Operasional
          </a>
        )}
        <a
          href={OFFICE_IDENTITY.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Petunjuk arah
        </a>
      </div>
    </DashCard>
  );
};
