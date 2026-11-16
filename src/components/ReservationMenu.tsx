import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Calendar, Users } from 'lucide-react';
import type { PortalRoute } from '../hooks/useHashRoute';

export const RESERVATION_LINKS = [
  {
    href: '#dealing-room',
    route: 'dealing-room' as PortalRoute,
    label: 'Dealing Room',
    hint: 'Pesan ruang diskusi klien',
    Icon: Calendar
  },
  {
    href: '#floortime',
    route: 'floortime' as PortalRoute,
    label: 'Floortime',
    hint: 'Daftar jaga kantor',
    Icon: Users
  }
];

/** Menu "Reservasi" di header dengan sub menu Dealing Room & Floortime. */
export const ReservationMenu: React.FC<{ route: PortalRoute }> = ({ route }) => {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = route === 'dealing-room' || route === 'floortime';

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
          isActive ? 'text-slate-950' : 'hover:text-slate-950'
        }`}
      >
        Reservasi
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {RESERVATION_LINKS.map(({ href, route: r, label, hint, Icon }) => (
            <a
              key={href}
              role="menuitem"
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-stone-50 ${
                route === r ? 'bg-amber-50' : ''
              }`}
            >
              <Icon className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{label}</span>
                <span className="block text-xs font-normal text-slate-500">{hint}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
