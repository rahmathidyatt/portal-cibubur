/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Menu, X, LogIn, LogOut, ShieldCheck, Cake, LayoutDashboard } from 'lucide-react';
import { officeAnniversary } from './utils/anniversary';
import { recordVisit } from './services/analytics';
import { todayInJakarta } from './utils/schedule';
import {
  OFFICE_STAFF_CONTACTS,
  OFFICE_IDENTITY,
  WEEKLY_OFFICE_HOURS,
  INITIAL_DEALING_ROOMS,
  INITIAL_FLOORTIME_SHIFTS
} from './data/cibuburData';
import { TodayOverview } from './components/TodayOverview';
import { BusinessManagers } from './components/BusinessManagers';
import { StaffWhatsAppDirectory } from './components/StaffWhatsAppDirectory';
import { OfficeHoursLocation } from './components/OfficeHoursLocation';
import { JinglePlayer } from './components/JinglePlayer';
import { ReservationPage } from './components/ReservationPage';
import { ReservationMenu, RESERVATION_LINKS } from './components/ReservationMenu';
import { AdminShell } from './components/AdminShell';
import { BrandMark } from './components/BrandMark';
import { InstallAppButton } from './components/InstallAppButton';

// Alat staf dimuat terpisah agar halaman publik tetap ringan (PDF/ZIP/Excel hanya untuk staf).
const FloorTimeSchedulerPage = lazy(() =>
  import('./features/floortime/FloorTimeSchedulerPage').then((m) => ({ default: m.FloorTimeSchedulerPage }))
);
const PortalStatsPage = lazy(() => import('./features/admin/PortalStatsPage').then((m) => ({ default: m.PortalStatsPage })));
const JinglePage = lazy(() => import('./features/admin/ContentPages').then((m) => ({ default: m.JinglePage })));
const BirthdayPage = lazy(() => import('./features/admin/ContentPages').then((m) => ({ default: m.BirthdayPage })));
const NotaMessengerPage = lazy(() =>
  import('./features/nota/NotaMessengerPage').then((m) => ({ default: m.NotaMessengerPage }))
);
import { LoginDialog } from './components/LoginDialog';
import { AdminProvider, useAdmin } from './hooks/useAdmin';
import { ToastProvider } from './hooks/useToast';
import { isStaffRoute, useHashRoute, type PortalRoute } from './hooks/useHashRoute';

const NAV_LINKS = [
  { href: '#beranda', label: 'Beranda' },
  { href: '#business-manager', label: 'Business Manager' },
  { href: '#kontak-staf', label: 'Kontak staf' },
  { href: '#jam-operasional', label: 'Jam & lokasi' }
];

export default function App() {
  return (
    <AdminProvider>
      <ToastProvider>
        <PortalApp />
      </ToastProvider>
    </AdminProvider>
  );
}

function PortalApp() {
  const { isAdmin, session, signOut } = useAdmin();
  const { route } = useHashRoute();
  const [loginOpen, setLoginOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const handleCloseLogin = useCallback(() => setLoginOpen(false), []);

  // Tutup menu HP setiap kali berpindah halaman.
  useEffect(() => setMobileMenuOpen(false), [route]);

  // Statistik: catat halaman yang dibuka (sekali per halaman per sesi browser).
  useEffect(() => {
    void recordVisit(route);
  }, [route]);

  const opsStaff = OFFICE_STAFF_CONTACTS[0];

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <a href="#beranda" aria-label="Brighton HUB Cibubur — beranda" className="shrink-0">
            <BrandMark />
          </a>

          <nav
            aria-label="Navigasi utama"
            className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600"
          >
            <a href={NAV_LINKS[0].href} className="hover:text-slate-950 transition-colors">
              {NAV_LINKS[0].label}
            </a>
            <ReservationMenu route={route} />
            {NAV_LINKS.slice(1).map((link) => (
              <a key={link.href} href={link.href} className="hover:text-slate-950 transition-colors">
                {link.label}
              </a>
            ))}
            {isAdmin && (
              <a
                href="#staf-statistik"
                aria-current={isStaffRoute(route) ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                  isStaffRoute(route) ? 'bg-slate-950 text-white' : 'text-slate-700 ring-1 ring-slate-200 hover:text-slate-950'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${isStaffRoute(route) ? 'text-amber-400' : 'text-amber-600'}`} />
                Area admin
              </a>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <InstallAppButton className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 rounded-lg ring-1 ring-slate-200 hover:bg-slate-100 cursor-pointer" />
            {isAdmin ? (
              <button
                type="button"
                onClick={() => void signOut()}
                title={`Masuk sebagai ${session?.email ?? 'admin'}`}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin · Keluar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk staf
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              className="lg:hidden p-2 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Navigasi seluler"
            className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col text-sm font-semibold text-slate-700"
          >
            <a href="#beranda" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-slate-950">
              Beranda
            </a>
            {RESERVATION_LINKS.length > 1 && <p className="pt-2 pb-1 text-xs font-semibold text-slate-400">Reservasi</p>}
            {RESERVATION_LINKS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2 inline-flex items-center gap-2 hover:text-slate-950 ${RESERVATION_LINKS.length > 1 ? 'pl-3' : ''}`}
              >
                <Icon className="w-4 h-4 text-amber-600" />
                {label}
              </a>
            ))}
            {NAV_LINKS.slice(1).map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-slate-950"
              >
                {link.label}
              </a>
            ))}
            {isAdmin && (
              <a
                href="#staf-statistik"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 inline-flex items-center gap-2 hover:text-slate-950"
              >
                <LayoutDashboard className="w-4 h-4 text-amber-600" />
                Area admin
              </a>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col">
              <InstallAppButton
                onDone={() => setMobileMenuOpen(false)}
                className="py-2 text-left hover:text-slate-950 inline-flex items-center gap-1.5 cursor-pointer"
              />
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void signOut();
                  }}
                  className="py-2 text-left text-emerald-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar dari mode admin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLoginOpen(true);
                  }}
                  className="py-2 text-left hover:text-slate-950 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Masuk staf
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {route === 'beranda' ? (
          <>
            <TodayOverview weeklyHours={WEEKLY_OFFICE_HOURS} />
            <BusinessManagers />
            <StaffWhatsAppDirectory contacts={OFFICE_STAFF_CONTACTS} />
            <OfficeHoursLocation weeklyHours={WEEKLY_OFFICE_HOURS} />
          </>
        ) : isStaffRoute(route) ? (
          isAdmin ? (
            <AdminShell route={route} email={session?.email ?? null} onSignOut={() => void signOut()}>
              <Suspense
                fallback={
                  <div className="max-w-[1140px] mx-auto px-6 py-12 space-y-3 animate-pulse" aria-label="Memuat">
                    <div className="h-7 w-56 rounded bg-slate-200" />
                    <div className="h-4 w-80 rounded bg-slate-200" />
                    <div className="h-48 rounded-2xl bg-slate-200/70" />
                  </div>
                }
              >
                <StaffPage route={route} />
              </Suspense>
            </AdminShell>
          ) : (
            <section className="bg-stone-50 min-h-[60vh] py-16">
              <div className="max-w-md mx-auto px-6 text-center">
                <h1 className="text-2xl font-bold text-slate-950">Khusus staf kantor</h1>
                <p className="mt-2 text-sm text-slate-600">Masuk sebagai admin untuk membuka area admin.</p>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Masuk staf
                </button>
              </div>
            </section>
          )
        ) : (
          <ReservationPage
            key={route}
            view={route}
            initialRooms={INITIAL_DEALING_ROOMS}
            initialShifts={INITIAL_FLOORTIME_SHIFTS}
            weeklyHours={WEEKLY_OFFICE_HOURS}
            opsContact={opsStaff}
          />
        )}
      </main>

      <LoginDialog open={loginOpen} onClose={handleCloseLogin} />

      <SiteFooter />
      <JinglePlayer />
    </div>
  );
}

/** Halaman di area admin sesuai rute. */
function StaffPage({ route }: { route: PortalRoute }) {
  switch (route) {
    case 'staf-floor-time':
      return <FloorTimeSchedulerPage />;
    case 'staf-nota':
      return <NotaMessengerPage />;
    case 'staf-jingle':
      return <JinglePage />;
    case 'staf-ulang-tahun':
      return <BirthdayPage />;
    default:
      return <PortalStatsPage />;
  }
}

/** Footer: identitas kantor + tanggal berdiri (ulang tahun kantor). */
function SiteFooter() {
  const today = todayInJakarta();
  const anniv = officeAnniversary(OFFICE_IDENTITY.foundedDate, today);
  return (
    <footer className="bg-white border-t border-slate-200 py-6">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
        <p>
          © {today.slice(0, 4)} {OFFICE_IDENTITY.name} · Portal operasional internal
        </p>
        <p className="inline-flex items-center gap-1.5">
          <Cake className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
          {anniv.isToday ? (
            <span className="font-semibold text-amber-800">Hari ini ulang tahun ke-{anniv.age} kantor</span>
          ) : (
            <span>
              Berdiri sejak 6 Mei 2023 · {anniv.age} tahun · ulang tahun ke-{anniv.nextAge} dalam {anniv.daysUntil} hari
            </span>
          )}
        </p>
      </div>
    </footer>
  );
}
