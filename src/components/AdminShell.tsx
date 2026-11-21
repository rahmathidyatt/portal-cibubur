import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck, ChevronDown, GraduationCap, TrendingUp, ChevronLeft, ChevronRight, LogOut, ShieldCheck } from 'lucide-react';
import type { PortalRoute } from '../hooks/useHashRoute';
import { STAFF_LINKS } from './ReservationMenu';

interface AdminShellProps {
  route: PortalRoute;
  email: string | null;
  onSignOut: () => void;
  children: React.ReactNode;
}

const GROUPS = [...new Set(STAFF_LINKS.map((l) => l.group))];

type StaffLink = (typeof STAFF_LINKS)[number];

const PARENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'Bright Day': CalendarCheck,
  'Training Brighton': GraduationCap,
  Analisis: TrendingUp
};

const ParentIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const Icon = PARENT_ICONS[name] ?? CalendarCheck;
  return <Icon className={className} aria-hidden="true" />;
};

const SidebarLink: React.FC<{ link: StaffLink; route: PortalRoute }> = ({ link, route }) => {
  const { href, route: r, label, hint, Icon } = link;
  const active = r === route;
  return (
    <li>
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
};

const COLLAPSE_KEY = 'portal-cibubur:admin-sidebar-collapsed';

const BACKUP_KEY = 'portal-cibubur:backup-reminder-dismissed';

function currentMonthKey(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
}

function readBackupDismissed(): boolean {
  try {
    return window.localStorage.getItem(BACKUP_KEY) === currentMonthKey();
  } catch {
    return false;
  }
}

/** Pengingat ringan (tidak wajib) untuk mengunduh cadangan data, muncul sekali per bulan. */
const BackupReminder: React.FC = () => {
  const [hidden, setHidden] = useState<boolean>(readBackupDismissed);
  // Hanya di awal bulan (tanggal 1–3).
  const dayOfMonth = new Date(Date.now() + 7 * 3_600_000).getUTCDate();
  if (hidden || dayOfMonth > 3) return null;
  return (
    <div className="mx-4 mt-4 sm:mx-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
      <span>Pengingat sesekali unduh data sebagai cadangan</span>
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem(BACKUP_KEY, currentMonthKey());
          } catch {
            /* penyimpanan tidak tersedia */
          }
        }}
        className="ml-auto font-bold text-amber-800 hover:text-amber-950 cursor-pointer"
      >
        Tutup
      </button>
    </div>
  );
};

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Tata letak area admin: sidebar di desktop (bisa disembunyikan), tab menu geser di HP. */
export const AdminShell: React.FC<AdminShellProps> = ({ route, email, onSignOut, children }) => {
  const [collapsed, setCollapsedState] = useState<boolean>(readCollapsed);
  const [openParents, setOpenParents] = useState<Set<string>>(new Set());
  const toggleParent = (name: string) =>
    setOpenParents((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch {
      /* penyimpanan tidak tersedia */
    }
  };
  // Tombol jingle (kiri bawah) digeser ke kanan sidebar agar tidak menutupi menu "Keluar".
  useEffect(() => {
    document.documentElement.classList.toggle('admin-sidebar-open', !collapsed);
    return () => document.documentElement.classList.remove('admin-sidebar-open');
  }, [collapsed]);

  return (
  <div className="bg-stone-50 lg:flex lg:min-h-[calc(100vh-57px)]">
    {collapsed && (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Tampilkan menu admin"
        title="Tampilkan menu admin"
        className="hidden lg:grid fixed left-0 top-[73px] z-30 h-10 w-7 place-items-center rounded-r-xl bg-slate-950 text-amber-400 shadow-lg hover:w-8 transition-all cursor-pointer"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    )}
    <aside
      aria-label="Menu admin"
      className={`${collapsed ? 'hidden' : 'hidden lg:flex'} lg:flex-col w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]`}
    >
      <div className="relative px-5 pt-6 pb-4 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Sembunyikan menu admin"
          title="Sembunyikan menu"
          className="absolute right-3 top-5 grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
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
            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
            <ul className="space-y-0.5">
              {STAFF_LINKS.filter((l) => l.group === group).map((link, i, list) => {
                if (!link.parent) return <SidebarLink key={link.href} link={link} route={route} />;
                if (list.findIndex((l) => l.parent === link.parent) !== i) return null;
                const children = list.filter((l) => l.parent === link.parent);
                const childActive = children.some((c) => c.route === route);
                const open = childActive || openParents.has(link.parent);
                return (
                  <li key={`parent-${link.parent}`}>
                    <button
                      type="button"
                      onClick={() => toggleParent(link.parent!)}
                      aria-expanded={open}
                      className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors cursor-pointer ${
                        childActive ? 'text-slate-950' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                      }`}
                    >
                      <ParentIcon
                        name={link.parent!}
                        className={`h-4 w-4 shrink-0 ${childActive ? 'text-amber-600' : 'text-slate-400 group-hover:text-amber-600'}`}
                      />
                      <span className="min-w-0 flex-1 text-sm font-semibold">{link.parent}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    {open && (
                      <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                        {children.map((c) => (
                          <SidebarLink key={c.href} link={c} route={route} />
                        ))}
                      </ul>
                    )}
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
      {STAFF_LINKS.map(({ href, route: r, label: base, parent, Icon }) => {
        const label = parent ? `${parent} · ${base}` : base;
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

    <div className="min-w-0 flex-1">
      <BackupReminder />
      {children}
    </div>
  </div>
  );
};
