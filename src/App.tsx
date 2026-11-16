/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';
import { MessageCircle, Menu, X, Calendar, Phone, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import {
  MORNING_INSPIRATIONS,
  OFFICE_STAFF_CONTACTS,
  OFFICE_IDENTITY,
  WEEKLY_OFFICE_HOURS,
  INITIAL_DEALING_ROOMS,
  INITIAL_FLOORTIME_SHIFTS
} from './data/cibuburData';
import { TodayOverview } from './components/TodayOverview';
import { StaffWhatsAppDirectory } from './components/StaffWhatsAppDirectory';
import { OfficeHoursLocation } from './components/OfficeHoursLocation';
import { BookingPortalModal, type BookingPortalTab } from './components/BookingPortalModal';
import { PropertyCalculators } from './components/PropertyCalculators';
import { OfficeDocuments } from './components/OfficeDocuments';
import { LoginDialog } from './components/LoginDialog';
import { AdminProvider, useAdmin } from './hooks/useAdmin';
import { buildWhatsAppChatUrl } from './utils/hubLogic';
import { buildHoursSummary } from './utils/schedule';

const HOURS_SUMMARY = buildHoursSummary(WEEKLY_OFFICE_HOURS);

const NAV_LINKS = [
  { href: '#beranda', label: 'Hari ini' },
  { href: '#kontak-staf', label: 'Kontak staf' },
  { href: '#kalkulator', label: 'Kalkulator' },
  { href: '#dokumen', label: 'Dokumen' },
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
  const [loginOpen, setLoginOpen] = useState<boolean>(false);
  const handleCloseLogin = useCallback(() => setLoginOpen(false), []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isPortalOpen, setIsPortalOpen] = useState<boolean>(false);
  const [activePortalTab, setActivePortalTab] = useState<BookingPortalTab>('dealing-room-1');
  const [bookingRefreshKey, setBookingRefreshKey] = useState<number>(0);

  const opsStaff = OFFICE_STAFF_CONTACTS[0];
  const opsWhatsAppUrl = buildWhatsAppChatUrl(opsStaff.whatsappNumber, opsStaff.defaultMessage);

  const handleOpenPortal = useCallback((tab: BookingPortalTab = 'dealing-room-1') => {
    setActivePortalTab(tab);
    setIsPortalOpen(true);
    setMobileMenuOpen(false);
  }, []);
  const handleClosePortal = useCallback(() => setIsPortalOpen(false), []);
  const handleBookingSaved = useCallback(() => setBookingRefreshKey((k) => k + 1), []);

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

          <nav aria-label="Navigasi utama" className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-slate-950 transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={opsWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat Operasional
            </a>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => void signOut()}
                title={`Masuk sebagai ${session?.email ?? 'admin'}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin · Keluar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk staf
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenPortal('dealing-room-1')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              Reservasi
            </button>
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
          <nav aria-label="Navigasi seluler" className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1 text-sm font-semibold text-slate-700">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-slate-950"
              >
                {link.label}
              </a>
            ))}
            <a
              href={opsWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 hover:text-slate-950"
            >
              Chat Operasional (WhatsApp)
            </a>
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
            <button
              type="button"
              onClick={() => handleOpenPortal('dealing-room-1')}
              className="mt-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              Reservasi ruang & floortime
            </button>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <TodayOverview
          weeklyHours={WEEKLY_OFFICE_HOURS}
          roomTemplates={INITIAL_DEALING_ROOMS}
          shiftTemplates={INITIAL_FLOORTIME_SHIFTS}
          quotes={MORNING_INSPIRATIONS}
          refreshKey={bookingRefreshKey}
          onOpenPortal={handleOpenPortal}
        />
        <StaffWhatsAppDirectory contacts={OFFICE_STAFF_CONTACTS} />
        <PropertyCalculators />
        <OfficeDocuments />
        <OfficeHoursLocation weeklyHours={WEEKLY_OFFICE_HOURS} />
      </main>

      <BookingPortalModal
        initialRooms={INITIAL_DEALING_ROOMS}
        initialShifts={INITIAL_FLOORTIME_SHIFTS}
        weeklyHours={WEEKLY_OFFICE_HOURS}
        opsContact={opsStaff}
        isPortalOpen={isPortalOpen}
        activeTab={activePortalTab}
        onClosePortal={handleClosePortal}
        onChangeTab={setActivePortalTab}
        onBookingSaved={handleBookingSaved}
      />

      <LoginDialog open={loginOpen} onClose={handleCloseLogin} />

      <footer className="bg-white py-8">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-sm text-slate-600">
          <div>
            <p className="font-display font-bold text-slate-950">{OFFICE_IDENTITY.name}</p>
            <p className="mt-1">{OFFICE_IDENTITY.address}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1 font-mono text-slate-800">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {OFFICE_IDENTITY.phoneDisplay}
              </span>
              <span className="text-xs text-slate-500">{HOURS_SUMMARY}</span>
            </p>
          </div>
          <nav aria-label="Navigasi footer" className="flex flex-wrap items-center gap-5 font-semibold text-slate-700">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-slate-950">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
