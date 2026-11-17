/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Menu, X, LogIn, LogOut, ShieldCheck, Cake } from 'lucide-react';
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
import { ReservationPage } from './components/ReservationPage';
import { NavMenu, ReservationMenu, RESERVATION_LINKS, STAFF_LINKS } from './components/ReservationMenu';

// Alat staf dimuat terpisah agar halaman publik tetap ringan (PDF/ZIP/Excel hanya untuk staf).
const FloorTimeSchedulerPage = lazy(() =>
  import('./features/floortime/FloorTimeSchedulerPage').then((m) => ({ default: m.FloorTimeSchedulerPage }))
);
const AdminPanelPage = lazy(() => import('./features/admin/AdminPanelPage').then((m) => ({ default: m.AdminPanelPage })));
const NotaMessengerPage = lazy(() =>
  import('./features/nota/NotaMessengerPage').then((m) => ({ default: m.NotaMessengerPage }))
);
import { LoginDialog } from './components/LoginDialog';
import { AdminProvider, useAdmin } from './hooks/useAdmin';
import { useHashRoute } from './hooks/useHashRoute';

const NAV_LINKS = [
  { href: '#beranda', label: 'Beranda' },
  { href: '#business-manager', label: 'Business Manager' },
  { href: '#kontak-staf', label: 'Kontak staf' },
  { href: '#jam-operasional', label: 'Jam & lokasi' }
];

export default function App() {
  return (
    <AdminProvider>
      <PortalApp />
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

  // Catat satu kunjungan per sesi browser (untuk statistik di Panel admin).
  useEffect(() => {
    void recordVisit(window.location.hash.replace(/^#/, '') || 'beranda');
  }, []);

  const opsStaff = OFFICE_STAFF_CONTACTS[0];

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <a href="#beranda" className="flex items-center gap-2.5 shrink-0">
            <span
              aria-hidden="true"
              className="grid place-items-center w-8 h-8 rounded-lg bg-amber-400 text-sm font-bold text-slate-950 font-display"
            >
              B
            </span>
            <span className="text-base font-bold tracking-tight text-slate-950 font-display whitespace-nowrap">
              Brighton HUB Cibubur
            </span>
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
            {isAdmin && <NavMenu label="Alat staf" links={STAFF_LINKS} route={route} />}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
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
            <p className="pt-2 pb-1 text-xs font-semibold text-slate-400">Reservasi</p>
            {RESERVATION_LINKS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 pl-3 inline-flex items-center gap-2 hover:text-slate-950"
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
              <>
                <p className="pt-2 pb-1 text-xs font-semibold text-slate-400">Alat staf</p>
                {STAFF_LINKS.map(({ href, label, Icon }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2 pl-3 inline-flex items-center gap-2 hover:text-slate-950"
                  >
                    <Icon className="w-4 h-4 text-amber-600" />
                    {label}
                  </a>
                ))}
              </>
            )}
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col">
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
        ) : route === 'staf-floor-time' || route === 'staf-nota' || route === 'staf-admin' ? (
          isAdmin ? (
            <Suspense fallback={<p className="max-w-[1140px] mx-auto px-6 py-12 text-sm text-slate-500">Memuat alat staf…</p>}>
              {route === 'staf-floor-time' ? (
                <FloorTimeSchedulerPage />
              ) : route === 'staf-admin' ? (
                <AdminPanelPage />
              ) : (
                <NotaMessengerPage />
              )}
            </Suspense>
          ) : (
            <section className="bg-stone-50 min-h-[60vh] py-16">
              <div className="max-w-md mx-auto px-6 text-center">
                <h1 className="text-2xl font-bold text-slate-950">Khusus staf kantor</h1>
                <p className="mt-2 text-sm text-slate-600">Masuk sebagai admin untuk membuka alat staf.</p>
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
    </div>
  );
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
