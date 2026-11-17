/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Menu, X, Phone, LogIn, LogOut, ShieldCheck } from 'lucide-react';
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
import { ReservationMenu, RESERVATION_LINKS } from './components/ReservationMenu';
import { LoginDialog } from './components/LoginDialog';
import { AdminProvider, useAdmin } from './hooks/useAdmin';
import { useHashRoute } from './hooks/useHashRoute';
import { buildWhatsAppChatUrl } from './utils/hubLogic';
import { buildHoursSummary } from './utils/schedule';

const HOURS_SUMMARY = buildHoursSummary(WEEKLY_OFFICE_HOURS);

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

  const opsStaff = OFFICE_STAFF_CONTACTS[0];
  const opsWhatsAppUrl = buildWhatsAppChatUrl(opsStaff.whatsappNumber, opsStaff.defaultMessage);

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
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col">
              <a href={opsWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="py-2 hover:text-slate-950">
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

      <footer className="bg-white border-t border-slate-200 py-8">
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
            <a href="#beranda" className="hover:text-slate-950">
              Beranda
            </a>
            {RESERVATION_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="hover:text-slate-950">
                {label}
              </a>
            ))}
            {NAV_LINKS.slice(1).map((link) => (
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
