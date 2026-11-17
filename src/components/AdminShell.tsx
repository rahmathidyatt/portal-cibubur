import React from 'react';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import type { PortalRoute } from '../hooks/useHashRoute';
import { STAFF_LINKS } from './ReservationMenu';

interface AdminShellProps {
  route: PortalRoute;
  email: string | null;
  onSignOut: () => void;
  children: React.ReactNode;
}

const GROUPS = [...new Set(STAFF_LINKS.map((l) => l.group))];

/** Tata letak area admin: sidebar di desktop, tab menu geser di HP. */
export const AdminShell: React.FC<AdminShellProps> = ({ route, email, onSignOut, children }) => (
  <div className="bg-stone-50 lg:flex lg:min-h-[calc(100vh-57px)]">
    <aside
      aria-label="Menu admin"
      className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]"
    >
      <div className="px-5 pt-6 pb-4 border-b border-slate-100">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Area admin
        </p>
        {email && (
          <p className="mt-2 truncate text-xs text-slate-500" title={email}>
            {email}
          </p>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
            <ul className="space-y-0.5">
              {STAFF_LINKS.filter((l) => l.group === group).map(({ href, route: r, label, hint, Icon }) => {
                const active = r === route;
                return (
                  <li key={href}>
                    <a
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors ${
                        active ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                      }`}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-600'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className={`block truncate text-[11px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>{hint}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3 space-y-0.5">
        <a
          href="#beranda"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke portal
        </a>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </button>
      </div>
    </aside>

    <nav
      aria-label="Menu admin"
      className="lg:hidden sticky top-[57px] z-30 flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2"
    >
      {STAFF_LINKS.map(({ href, route: r, label, Icon }) => {
        const active = r === route;
        return (
          <a
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              active ? 'bg-slate-950 text-white' : 'bg-stone-50 text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-amber-400' : 'text-slate-400'}`} aria-hidden="true" />
            {label}
          </a>
        );
      })}
    </nav>

    <div className="min-w-0 flex-1">{children}</div>
  </div>
);
