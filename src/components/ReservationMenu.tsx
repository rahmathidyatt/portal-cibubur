import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Calendar, Users, CalendarRange, Receipt, LayoutDashboard, TrendingUp } from 'lucide-react';
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

/** Alat staf: hanya tampil setelah login admin. */
export const STAFF_LINKS = [
  {
    href: '#staf-statistik',
    route: 'staf-statistik' as PortalRoute,
    label: 'Statistik portal',
    hint: 'Jumlah kunjungan & grafik 14 hari',
    Icon: TrendingUp
  },
  {
    href: '#staf-admin',
    route: 'staf-admin' as PortalRoute,
    label: 'Panel admin',
    hint: 'Jingle Brighton & ulang tahun agen',
    Icon: LayoutDashboard
  },
  {
    href: '#staf-floor-time',
    route: 'staf-floor-time' as PortalRoute,
    label: 'Floor Time Scheduler',
    hint: 'Buat, terbitkan & kelola jadwal',
    Icon: CalendarRange
  },
  {
    href: '#staf-nota',
    route: 'staf-nota' as PortalRoute,
    label: 'Nota Smart Messenger',
    hint: 'Hitung & unduh nota messenger',
    Icon: Receipt
  }
];

type MenuLink = (typeof RESERVATION_LINKS)[number];

/** Menu "Reservasi" di header dengan sub menu Dealing Room & Floortime. */
export const ReservationMenu: React.FC<{ route: PortalRoute }> = ({ route }) => (
  <NavMenu label="Reservasi" links={RESERVATION_LINKS} route={route} />
);

/** Dropdown navigasi header dengan beberapa sub menu. */
export const NavMenu: React.FC<{ label: string; links: MenuLink[]; route: PortalRoute }> = ({
  label,
  links,
  route
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = links.some((l) => l.route === route);

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
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {links.map(({ href, route: r, label: itemLabel, hint, Icon }) => (
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
                <span className="block text-sm font-semibold text-slate-900">{itemLabel}</span>
                <span className="block text-xs font-normal text-slate-500">{hint}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
