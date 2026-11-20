/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Menu, X, LogIn, LogOut, ShieldCheck, LayoutDashboard, StickyNote } from 'lucide-react';
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
import { Minbur } from './features/minbur/Minbur';
import { MinburAdminPage } from './features/minbur/MinburAdminPage';
import { BrightDayPage } from './features/brightday/BrightDayPage';
import { AttendancePage } from './features/brightday/AttendancePage';
import { ClosingAdminPage } from './features/closing/ClosingAdminPage';
import { WofPage } from './features/wof/WofPage';
import { TrackingPage } from './features/training/TrackingPage';
import { ClosingRecapPage } from './features/closing/ClosingRecapPage';
import { MedproRecapPage } from './features/medpro/MedproRecapPage';
import { ReservationPage } from './components/ReservationPage';
import { ReservationMenu, RESERVATION_LINKS } from './components/ReservationMenu';
import { AdminShell } from './components/AdminShell';
import { OfficeStatusBadge } from './components/LiveClock';
import { BrandMark } from './components/BrandMark';

// Alat staf dimuat terpisah agar halaman publik tetap ringan (PDF/ZIP/Excel hanya untuk staf).
const FloorTimeSchedulerPage = lazy(() =>
  import('./features/floortime/FloorTimeSchedulerPage').then((m) => ({ default: m.FloorTimeSchedulerPage }))
);
const PortalStatsPage = lazy(() => import('./features/admin/PortalStatsPage').then((m) => ({ default: m.PortalStatsPage })));
const TrainingPage = lazy(() => import('./features/training/TrainingPage').then((m) => ({ default: m.TrainingPage })));
const MedproPage = lazy(() => import('./features/medpro/MedproPage').then((m) => ({ default: m.MedproPage })));
const JinglePage = lazy(() => import('./features/admin/ContentPages').then((m) => ({ default: m.JinglePage })));
const BirthdayPage = lazy(() => import('./features/admin/ContentPages').then((m) => ({ default: m.BirthdayPage })));
const NotesPage = lazy(() => import('./features/notes/NotesPage').then((m) => ({ default: m.NotesPage })));
const NotaMessengerPage = lazy(() =>
  import('./features/nota/NotaMessengerPage').then((m) => ({ default: m.NotaMessengerPage }))
);
import { LoginDialog } from './components/LoginDialog';
import { LangProvider, LangToggle, useLang } from './i18n/lang';
import { useAutoTranslate } from './i18n/AutoTranslate';
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
        <LangProvider>
          <PortalApp />
        </LangProvider>
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
  const { lang } = useLang();
  const onStaffRoute = isStaffRoute(route);
  const onNotes = route === 'notes';
  // Terjemahan hanya untuk dashboard publik; area admin & Notes tetap Bahasa Indonesia.
  useAutoTranslate(lang === 'en' && !onStaffRoute && !onNotes);

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
            {isAdmin && (
              <a
                href="#notes"
                aria-current={onNotes ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                  onNotes ? 'bg-slate-950 text-white' : 'text-slate-700 ring-1 ring-slate-200 hover:text-slate-950'
                }`}
              >
                <StickyNote className={`w-4 h-4 ${onNotes ? 'text-amber-400' : 'text-amber-600'}`} />
                Notes
              </a>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {!onStaffRoute && !onNotes && <LangToggle />}
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
            ) : null}
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
            {RESERVATION_LINKS.length > 1 && <p className="pt-2 pb-1 text-xs font-semibold text-slate-500">Reservasi</p>}
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
            {isAdmin && (
              <a
                href="#notes"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 inline-flex items-center gap-2 hover:text-slate-950"
              >
                <StickyNote className="w-4 h-4 text-amber-600" />
                Notes
              </a>
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
              ) : null}
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
        ) : onNotes ? (
          isAdmin ? (
            <Suspense fallback={<div className="min-h-[60vh]" aria-label="Memuat" />}>
              <NotesPage />
            </Suspense>
          ) : (
            <StaffOnly onLogin={() => setLoginOpen(true)} />
          )
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
            <StaffOnly onLogin={() => setLoginOpen(true)} />
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

      <SiteFooter isAdmin={isAdmin} onLogin={() => setLoginOpen(true)} />
      <JinglePlayer />
      {!isStaffRoute(route) && !onNotes && <Minbur />}
    </div>
  );
}

/** Pesan untuk halaman khusus staf saat belum login. */
function StaffOnly({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="bg-stone-50 min-h-[60vh] py-16">
      <div className="max-w-md mx-auto px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-950">Khusus staf kantor</h1>
        <p className="mt-2 text-sm text-slate-600">Masuk sebagai admin untuk membuka halaman ini.</p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          Masuk staf
        </button>
      </div>
    </section>
  );
}

/** Halaman di area admin sesuai rute. */
function StaffPage({ route }: { route: PortalRoute }) {
  switch (route) {
    case 'staf-floor-time':
      return <FloorTimeSchedulerPage />;
    case 'staf-nota':
      return <NotaMessengerPage />;
    case 'staf-training':
      return <TrainingPage />;
    case 'staf-medpro':
      return <MedproPage />;
    case 'staf-jingle':
      return <JinglePage />;
    case 'staf-ulang-tahun':
      return <BirthdayPage />;
    case 'staf-minbur':
      return <MinburAdminPage />;
    case 'staf-bright-day':
      return <BrightDayPage />;
    case 'staf-bright-day-hadir':
      return <AttendancePage />;
    case 'staf-closing':
      return <ClosingAdminPage />;
    case 'staf-wof':
      return <WofPage />;
    case 'staf-training-tracking':
      return <TrackingPage />;
    case 'staf-closing-rekap':
      return <ClosingRecapPage />;
    case 'staf-medpro-rekap':
      return <MedproRecapPage />;
    default:
      return <PortalStatsPage />;
  }
}

/** Footer: identitas kantor + tanggal berdiri (ulang tahun kantor). */
function SiteFooter({ isAdmin, onLogin }: { isAdmin: boolean; onLogin: () => void }) {
  const today = todayInJakarta();
  const anniv = officeAnniversary(OFFICE_IDENTITY.foundedDate, today);
  return (
    <footer className="bg-white border-t border-slate-200 pt-6 pb-36 sm:pb-24">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            © {today.slice(0, 4)} {OFFICE_IDENTITY.name} · Centrum Cibubur
          </span>
          {!isAdmin && (
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-950 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Masuk staf
            </button>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <OfficeStatusBadge weeklyHours={WEEKLY_OFFICE_HOURS} />
        {/* Info ulang tahun kantor hanya tampil seminggu menjelang & pada harinya. */}
        {(anniv.isToday || anniv.daysUntil <= 7) && (
          <p className="inline-flex items-center gap-1.5">
            {anniv.isToday ? (
              <span className="font-semibold text-amber-800">{`Hari ini ulang tahun ke-${anniv.age} kantor`}</span>
            ) : (
              <span>
                {`Berdiri sejak 3 Mei 2023 · ulang tahun ke-${anniv.nextAge} ${
                  anniv.daysUntil === 1 ? 'besok' : `${anniv.daysUntil} hari lagi`
                }`}
              </span>
            )}
          </p>
        )}
        </div>
      </div>
    </footer>
  );
}
