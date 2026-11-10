/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MessageCircle, Menu, X, Phone } from 'lucide-react';
import {
  MORNING_INSPIRATIONS,
  OFFICE_STAFF_CONTACTS,
  OFFICE_IDENTITY,
  WEEKLY_OFFICE_HOURS,
  INITIAL_DEALING_ROOMS,
  INITIAL_FLOORTIME_SHIFTS
} from './data/cibuburData';
import { MorningInspirationHero } from './components/MorningInspirationHero';
import { StaffWhatsAppDirectory } from './components/StaffWhatsAppDirectory';
import {
  RoomAndFloortimeBooking,
  BookingPortalTab
} from './components/RoomAndFloortimeBooking';
import { buildWhatsAppChatUrl } from './utils/hubLogic';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isPortalOpen, setIsPortalOpen] = useState<boolean>(false);
  const [activePortalTab, setActivePortalTab] =
    useState<BookingPortalTab>('dealing-room-1');

  const opsStaff = OFFICE_STAFF_CONTACTS[0];
  const opsWhatsAppUrl = buildWhatsAppChatUrl(
    opsStaff.whatsappNumber,
    opsStaff.defaultMessage
  );

  const handleOpenPortal = (tab: BookingPortalTab = 'dealing-room-1') => {
    setActivePortalTab(tab);
    setIsPortalOpen(true);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar Contract — Vibrant White & Golden-Yellow Palette */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#FEF08A] via-[#FEF9C3] to-white border-b-2 border-amber-300 shadow-2xs">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 font-display"
          >
            Brighton HUB Cibubur
          </a>

          {/* Zone 2: 3 concise single-line navigation links matching the 3 main sub-sections */}
          <nav
            aria-label="Navigasi Utama Brighton HUB Cibubur"
            className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-900"
          >
            <a
              href="#inspirasi"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Inspirasi Pagi
            </a>
            <a
              href="#kontak-staf"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak Staf
            </a>
            <a
              href="#jam-operasional"
              className="hover:text-amber-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Jam & Lokasi
            </a>
          </nav>

          {/* Zone 3: 1 primary action (Direct WhatsApp to Rahmat Hidayat / Amat — Operations) */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={opsWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#FACC15] bg-slate-950 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#FACC15]" />
              Chat Operasional (Amat)
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Buka menu navigasi seluler"
              className="md:hidden p-2 text-slate-900 hover:text-slate-950 rounded-lg hover:bg-amber-200/70 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Disclosure */}
        {mobileMenuOpen && (
          <nav
            aria-label="Navigasi Seluler"
            className="md:hidden border-t border-amber-300 bg-[#FEF9C3] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold text-slate-900"
          >
            <a
              href="#inspirasi"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-amber-900 whitespace-nowrap"
            >
              Inspirasi Pagi
            </a>
            <a
              href="#kontak-staf"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-amber-900 whitespace-nowrap"
            >
              Kontak Staf
            </a>
            <a
              href="#jam-operasional"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-amber-900 whitespace-nowrap"
            >
              Jam & Lokasi
            </a>
            <button
              type="button"
              onClick={() => handleOpenPortal('dealing-room-1')}
              className="py-1 text-amber-950 underline underline-offset-4 whitespace-nowrap cursor-pointer"
            >
              Buka Menu Reservasi
            </button>
          </nav>
        )}
      </header>

      {/* Main Content — 3 Focused Sub-Sections */}
      <main className="flex-1">
        {/* Sub-Section 1: Inspirasi Pagi (Morning Inspiration) */}
        <MorningInspirationHero quotes={MORNING_INSPIRATIONS} />

        {/* Sub-Section 2: Kontak Staf Kantor (Operasional: Amat, Keuangan: Hania, Kurir: Apry) */}
        <StaffWhatsAppDirectory contacts={OFFICE_STAFF_CONTACTS} />

        {/* Sub-Section 3: Jam Operasional & Lokasi Kantor + Off-Screen Reservation Portal */}
        <RoomAndFloortimeBooking
          initialRooms={INITIAL_DEALING_ROOMS}
          initialShifts={INITIAL_FLOORTIME_SHIFTS}
          weeklyHours={WEEKLY_OFFICE_HOURS}
          opsContact={opsStaff}
          isPortalOpen={isPortalOpen}
          activeTab={activePortalTab}
          onOpenPortal={handleOpenPortal}
          onClosePortal={() => setIsPortalOpen(false)}
          onChangeTab={setActivePortalTab}
        />
      </main>

      {/* Vibrant Footer with Office Address & Phone Number 021 3873 9073 */}
      <footer className="bg-gradient-to-r from-[#FEF9C3] via-[#FEFCE8] to-white border-t-2 border-amber-300 py-8">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs text-slate-800">
          <div>
            <p className="font-display font-bold text-slate-950 text-sm">
              {OFFICE_IDENTITY.name} — Portal Informasi Operasional Kantor
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {OFFICE_IDENTITY.address} ·{' '}
              <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-950">
                <Phone className="w-3 h-3 text-amber-800" />
                Telepon: {OFFICE_IDENTITY.phoneDisplay}
              </span>
            </p>
            <p className="mt-1 text-slate-600">{OFFICE_IDENTITY.hoursSummary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-bold text-slate-900">
            <a href="#inspirasi" className="hover:text-amber-900">
              Inspirasi Pagi
            </a>
            <a href="#kontak-staf" className="hover:text-amber-900">
              Kontak WhatsApp Staf
            </a>
            <a href="#jam-operasional" className="hover:text-amber-900">
              Jam Operasional & Lokasi
            </a>
            <button
              type="button"
              onClick={() => handleOpenPortal('dealing-room-1')}
              className="text-amber-950 hover:text-slate-950 underline underline-offset-4 cursor-pointer"
            >
              Portal Reservasi Ruang
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
