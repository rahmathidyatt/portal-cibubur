import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  MapPin,
  Phone,
  Copy,
  Check,
  X,
  Building2,
  ArrowUpRight
} from 'lucide-react';
import {
  DealingRoom,
  FloortimeSlot,
  OfficeStaffContact,
  OfficeDaySchedule,
  OFFICE_IDENTITY
} from '../data/cibuburData';
import {
  bookConsultationRoomSlot,
  bookFloortimeShift,
  buildWhatsAppChatUrl
} from '../utils/hubLogic';

export type BookingPortalTab = 'dealing-room-1' | 'dealing-room-2' | 'floortime';

interface RoomAndFloortimeBookingProps {
  initialRooms: DealingRoom[];
  initialShifts: FloortimeSlot[];
  weeklyHours: OfficeDaySchedule[];
  opsContact: OfficeStaffContact;
  isPortalOpen: boolean;
  activeTab: BookingPortalTab;
  onOpenPortal: (tab?: BookingPortalTab) => void;
  onClosePortal: () => void;
  onChangeTab: (tab: BookingPortalTab) => void;
}

export const RoomAndFloortimeBooking: React.FC<RoomAndFloortimeBookingProps> = ({
  initialRooms,
  initialShifts,
  weeklyHours,
  opsContact,
  isPortalOpen,
  activeTab,
  onOpenPortal,
  onClosePortal,
  onChangeTab
}) => {
  const [rooms, setRooms] = useState<DealingRoom[]>(initialRooms);
  const [shifts, setShifts] = useState<FloortimeSlot[]>(initialShifts);
  const [bookingDate, setBookingDate] = useState<string>('2026-11-10');
  const [copiedOfficePhone, setCopiedOfficePhone] = useState<boolean>(false);

  // Room booking form state
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('10:00 - 12:00');
  const [roomAdvisorName, setRoomAdvisorName] = useState<string>('');
  const [roomAgenda, setRoomAgenda] = useState<string>('');
  const [roomFeedback, setRoomFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    waUrl?: string;
  } | null>(null);

  // Floortime booking form state
  const [selectedShiftId, setSelectedShiftId] = useState<string>(
    initialShifts[0]?.id || 'ft-pagi'
  );
  const [ftAdvisorName, setFtAdvisorName] = useState<string>('');
  const [ftCorridor, setFtCorridor] = useState<string>('Kota Wisata');
  const [ftFeedback, setFtFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    waUrl?: string;
  } | null>(null);

  const activeRoomId: 'dealing-room-1' | 'dealing-room-2' =
    activeTab === 'dealing-room-2' ? 'dealing-room-2' : 'dealing-room-1';
  const currentRoom =
    rooms.find((r) => r.id === activeRoomId) || rooms[0];

  const handleCopyOfficePhone = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(OFFICE_IDENTITY.phoneDisplay).catch(() => {});
    }
    setCopiedOfficePhone(true);
    setTimeout(() => setCopiedOfficePhone(false), 2000);
  };

  const handleSelectRoomSlot = (time: string) => {
    setSelectedSlotTime(time);
    setRoomFeedback(null);
  };

  const handleBookRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const result = bookConsultationRoomSlot(
      rooms,
      activeRoomId,
      selectedSlotTime,
      roomAdvisorName,
      roomAgenda
    );

    if (!result.success) {
      setRoomFeedback({
        type: 'error',
        text: result.error || 'Gagal memesan ruang konsultasi.'
      });
      return;
    }

    setRooms(result.updatedRooms);
    const roomName = currentRoom?.tabLabel || 'Dealing Room';
    const waText = `Halo Mas Amat (${opsContact.staffName}), saya ${roomAdvisorName.trim()} telah melakukan reservasi ${roomName} pada tanggal ${bookingDate} jam ${selectedSlotTime} WIB untuk keperluan: ${roomAgenda.trim()}. Mohon konfirmasinya, terima kasih.`;
    const waUrl = buildWhatsAppChatUrl(opsContact.whatsappNumber, waText);

    setRoomFeedback({
      type: 'success',
      text: `Terjadwal: ${roomName} (${selectedSlotTime} WIB) berhasil dipesan atas nama ${roomAdvisorName.trim()}.`,
      waUrl
    });
    setRoomAgenda('');
  };

  const handleBookFloortime = (e: React.FormEvent) => {
    e.preventDefault();
    const result = bookFloortimeShift(
      shifts,
      selectedShiftId,
      ftAdvisorName,
      ftCorridor
    );

    if (!result.success) {
      setFtFeedback({
        type: 'error',
        text: result.error || 'Gagal mendaftar jadwal floortime.'
      });
      return;
    }

    setShifts(result.updatedShifts);
    const shiftObj = shifts.find((s) => s.id === selectedShiftId);
    const shiftTitle = shiftObj
      ? `${shiftObj.shiftName} (${shiftObj.timeWindow})`
      : 'Floortime Request';
    const waText = `Halo Mas Amat (${opsContact.staffName}), saya ${ftAdvisorName.trim()} mengajukan Floortime Request untuk ${shiftTitle} tanggal ${bookingDate} dengan fokus koridor ${ftCorridor.trim()}. Terima kasih.`;
    const waUrl = buildWhatsAppChatUrl(opsContact.whatsappNumber, waText);

    setFtFeedback({
      type: 'success',
      text: `Terdaftar: ${ftAdvisorName.trim()} (${ftCorridor.trim()}) masuk dalam daftar ${shiftTitle}.`,
      waUrl
    });
    setFtAdvisorName('');
  };

  const totalOpenRoomSlots = rooms.reduce(
    (sum, r) => sum + r.slots.filter((s) => s.status === 'Tersedia').length,
    0
  );

  return (
    <>
      {/* Sub-Section 03 on Main Display: Weekly Operating Hours & Office Location + Phone 021 3873 9073 */}
      <section
        id="jam-operasional"
        className="py-12 sm:py-16 bg-gradient-to-br from-[#FEF9C3]/85 via-[#FEFCE8] to-white border-b-2 border-amber-300 scroll-mt-20"
      >
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-bold text-amber-900 tracking-wide mb-1.5">
                Sub-Bagian 03 · Jadwal Operasional Mingguan & Lokasi Kantor
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 text-balance">
                Jam Operasional & Informasi Kantor Brighton HUB Cibubur
              </h2>
              <p className="mt-2 text-base text-slate-700 max-w-2xl">
                Jadwal pelayanan kantor hari Minggu hingga Sabtu beserta nomor telepon resmi dan alamat lengkap kantor di Kota Wisata Cibubur.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenPortal('dealing-room-1')}
              className="inline-flex items-center gap-2 px-5 py-3 text-xs font-bold text-[#FACC15] bg-slate-950 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm self-start"
            >
              <Calendar className="w-4 h-4 text-[#FACC15]" />
              Buka Portal Reservasi Ruang & Jadwal
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: 7-Day Operating Schedule (Sunday - Saturday) */}
            <div className="lg:col-span-7 bg-white border-2 border-amber-300 rounded-2xl p-6 shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#FACC15] via-amber-400 to-[#EAB308]" />
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-amber-200 pt-1">
                <div>
                  <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    Jam Operasional Kantor (Minggu – Sabtu)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Waktu layanan administrasi operasional, keuangan, dan kurir dokumen kantor.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-950 whitespace-nowrap shrink-0">
                  Zona Waktu: WIB
                </span>
              </div>

              <div className="divide-y divide-amber-200/80 mt-2">
                {weeklyHours.map((item) => (
                  <div
                    key={item.dayId}
                    className={`py-3.5 px-3 rounded-xl my-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                      item.isClosed
                        ? 'bg-slate-100/90 text-slate-600'
                        : 'bg-[#FEFCE8]/70 hover:bg-[#FEF9C3]/80 text-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-950">
                          {item.dayNameId}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({item.dayNameEn})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{item.note}</p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      {item.isClosed ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-red-700 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                          Closed · Tutup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-slate-950 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          {item.hours}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Office Address, Phone Number (021 3873 9073) & Off-Screen Portal Launcher */}
            <div className="lg:col-span-5 space-y-6">
              {/* Office Address & Phone Card */}
              <div className="bg-white border-2 border-amber-300 rounded-2xl p-6 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#FACC15] to-amber-500" />
                <div className="pt-1">
                  <p className="text-xs font-mono font-bold text-amber-900">
                    ALAMAT & TELEPON RESMI KANTOR
                  </p>
                  <h3 className="text-xl font-bold text-slate-950 mt-1 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-700 shrink-0" />
                    {OFFICE_IDENTITY.name}
                  </h3>

                  <div className="mt-4 pt-4 border-t border-amber-200 space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-amber-800 shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-slate-600">
                          Alamat Kantor:
                        </p>
                        <p className="text-sm font-semibold text-slate-950 mt-0.5 leading-snug">
                          {OFFICE_IDENTITY.address}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FEF08A] border-2 border-amber-400 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 shrink-0">
                        <Phone className="w-4 h-4 text-slate-950 shrink-0 mt-1" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">
                            Nomor Telepon Kantor:
                          </p>
                          <p className="text-lg font-mono font-bold text-slate-950 tracking-tight whitespace-nowrap">
                            {OFFICE_IDENTITY.phoneDisplay}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyOfficePhone}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-950 bg-white hover:bg-amber-50 border border-amber-400 rounded-lg transition-colors cursor-pointer"
                        >
                          {copiedOfficePhone ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="text-emerald-800">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                        <a
                          href={OFFICE_IDENTITY.phoneHref}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#FACC15] bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Hubungi
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Drawer Launcher Card (keeps Dealing Room & Floortime tabs off main display) */}
              <div className="bg-gradient-to-br from-[#FEF08A] via-[#FEF9C3] to-white border-2 border-amber-400 rounded-2xl p-6 shadow-2xs">
                <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold text-amber-950 mb-2">
                  <span>PORTAL FASILITAS INTERNAL</span>
                  <span>{totalOpenRoomSlots} SLOT TERSEDIA</span>
                </div>
                <h3 className="text-lg font-bold text-slate-950">
                  Reservasi Ruang Diskusi & Jadwal Jaga Advisor
                </h3>
                <p className="text-xs text-slate-800 mt-1.5 leading-relaxed">
                  Untuk menjaga tampilan utama tetap ringkas, menu pemesanan ruang diskusi klien (Lantai 1 & Lantai 2) serta pendaftaran jadwal jaga harian agen ditempatkan pada panel khusus.
                </p>
                <div className="mt-4 pt-4 border-t border-amber-300 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-amber-950">
                    PIC Operasional: {opsContact.staffName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenPortal('dealing-room-1')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] border border-amber-500 rounded-xl transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Buka Menu Reservasi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Off-Screen Modal / Drawer containing the 2 "Dealing Room" tabs & "Floortime Request" tab */}
      {isPortalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-reservasi-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-4xl bg-white border-2 border-amber-400 rounded-2xl shadow-xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#FEF08A] via-[#FEF9C3] to-white px-6 py-4 border-b-2 border-amber-300 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono font-bold text-amber-900">
                  PORTAL RESERVASI INTERNAL · BRIGHTON HUB CIBUBUR
                </p>
                <h2
                  id="portal-reservasi-title"
                  className="text-lg sm:text-xl font-bold text-slate-950"
                >
                  Jadwal Dealing Room & Floortime Request
                </h2>
              </div>
              <button
                type="button"
                onClick={onClosePortal}
                aria-label="Tutup panel reservasi"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                Tutup Panel
              </button>
            </div>

            {/* Modal Sub-Header: 3 Tabs (Dealing Room 1, Dealing Room 2, Floortime Request) + Date Picker */}
            <div className="px-6 py-3.5 bg-[#FEFCE8] border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div
                role="tablist"
                aria-label="Pilih tab Dealing Room atau Floortime Request"
                className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FEF08A] border border-amber-300 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'dealing-room-1'}
                  onClick={() => {
                    onChangeTab('dealing-room-1');
                    setRoomFeedback(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'dealing-room-1'
                      ? 'bg-slate-950 text-[#FACC15] shadow-2xs'
                      : 'text-slate-900 hover:bg-white/70'
                  }`}
                >
                  Dealing Room 1
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'dealing-room-2'}
                  onClick={() => {
                    onChangeTab('dealing-room-2');
                    setRoomFeedback(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'dealing-room-2'
                      ? 'bg-slate-950 text-[#FACC15] shadow-2xs'
                      : 'text-slate-900 hover:bg-white/70'
                  }`}
                >
                  Dealing Room 2
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'floortime'}
                  onClick={() => {
                    onChangeTab('floortime');
                    setFtFeedback(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'floortime'
                      ? 'bg-slate-950 text-[#FACC15] shadow-2xs'
                      : 'text-slate-900 hover:bg-white/70'
                  }`}
                >
                  Floortime Request
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-4 h-4 text-amber-800 shrink-0" />
                <label
                  htmlFor="booking-date-picker"
                  className="font-bold text-slate-800 whitespace-nowrap"
                >
                  Tanggal:
                </label>
                <input
                  id="booking-date-picker"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="text-xs font-mono font-bold text-slate-900 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {activeTab === 'dealing-room-1' || activeTab === 'dealing-room-2' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Room Schedule Slots */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="p-4 rounded-xl bg-[#FEF9C3]/70 border border-amber-300">
                      <span className="text-xs font-mono font-bold text-amber-900">
                        FASILITAS RUANG DISKUSI KLIEN
                      </span>
                      <h3 className="text-lg font-bold text-slate-950 mt-0.5">
                        {currentRoom.name}
                      </h3>
                      <p className="text-xs text-slate-700 mt-1">
                        {currentRoom.floorAndLocation} · Kapasitas{' '}
                        <strong className="font-mono">{currentRoom.capacityPax}</strong> orang ·{' '}
                        {currentRoom.facilities}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentRoom.slots.map((slot) => {
                        const isBooked = slot.status === 'Terisi';
                        const isSelected =
                          selectedSlotTime === slot.time && !isBooked;

                        return (
                          <div
                            key={slot.time}
                            className={`p-3.5 rounded-xl border-2 text-xs transition-colors ${
                              isBooked
                                ? 'bg-slate-50 border-slate-200 text-slate-500'
                                : isSelected
                                ? 'bg-[#FEF08A] border-amber-500 text-slate-950'
                                : 'bg-white border-amber-200 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold">{slot.time} WIB</span>
                              {isBooked ? (
                                <span className="text-slate-500 font-semibold">Terisi</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectRoomSlot(slot.time)}
                                  className="text-amber-950 hover:text-slate-950 font-bold underline cursor-pointer"
                                >
                                  {isSelected ? 'Dipilih' : 'Pilih Jam'}
                                </button>
                              )}
                            </div>
                            {isBooked ? (
                              <p className="mt-1.5 text-[11px] text-slate-600 truncate">
                                {slot.bookedBy} — {slot.agenda}
                              </p>
                            ) : (
                              <p className="mt-1.5 text-[11px] text-emerald-800 font-semibold">
                                Tersedia untuk dipesan
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dealing Room Booking Form */}
                  <form
                    onSubmit={handleBookRoom}
                    className="lg:col-span-5 p-5 rounded-xl bg-[#FEFCE8] border-2 border-amber-300 space-y-4"
                    noValidate
                  >
                    <h4 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-800" />
                      Formulir Reservasi {currentRoom.tabLabel}
                    </h4>

                    <div>
                      <label
                        htmlFor="select-room-slot"
                        className="block text-xs font-bold text-slate-800 mb-1"
                      >
                        Jam Sesi (WIB)
                      </label>
                      <select
                        id="select-room-slot"
                        value={selectedSlotTime}
                        onChange={(e) => setSelectedSlotTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {currentRoom.slots.map((s) => (
                          <option key={s.time} value={s.time}>
                            {s.time} WIB ({s.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="room-advisor-name"
                        className="block text-xs font-bold text-slate-800 mb-1"
                      >
                        Nama Advisor / Pemesan *
                      </label>
                      <input
                        id="room-advisor-name"
                        type="text"
                        value={roomAdvisorName}
                        onChange={(e) => setRoomAdvisorName(e.target.value)}
                        placeholder="Contoh: Hendra Wijaya"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="room-agenda-input"
                        className="block text-xs font-bold text-slate-800 mb-1"
                      >
                        Agenda / Keperluan Diskusi *
                      </label>
                      <input
                        id="room-agenda-input"
                        type="text"
                        value={roomAgenda}
                        onChange={(e) => setRoomAgenda(e.target.value)}
                        placeholder="Contoh: Negosiasi KPR Klien Kota Wisata"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {roomFeedback && (
                      <div
                        role="status"
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          roomFeedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : 'bg-red-50 border-red-300 text-red-800'
                        }`}
                      >
                        <p className="font-bold flex items-center gap-1.5">
                          {roomFeedback.type === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          )}
                          {roomFeedback.text}
                        </p>
                        {roomFeedback.waUrl && (
                          <a
                            href={roomFeedback.waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Kirim Konfirmasi ke WhatsApp Amat
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] border border-amber-400 rounded-xl transition-colors cursor-pointer"
                    >
                      Simpan Reservasi {currentRoom.tabLabel}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Floortime Shifts List */}
                  <div className="lg:col-span-7 space-y-3">
                    {shifts.map((shift) => {
                      const count = shift.registeredAdvisors.length;
                      const isFull = count >= shift.quotaMax;
                      const isSelected = selectedShiftId === shift.id;

                      return (
                        <div
                          key={shift.id}
                          className={`p-4 rounded-xl border-2 transition-colors ${
                            isSelected
                              ? 'bg-[#FEF08A]/75 border-amber-500'
                              : 'bg-white border-amber-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-950">
                                {shift.shiftName}
                              </h4>
                              <p className="text-xs font-mono text-slate-700">
                                {shift.dayLabel} · {shift.timeWindow}
                              </p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`text-xs font-mono font-bold ${
                                  isFull ? 'text-amber-900' : 'text-emerald-800'
                                }`}
                              >
                                Kuota {count}/{shift.quotaMax} Advisor
                              </span>
                              {!isFull && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedShiftId(shift.id);
                                    setFtFeedback(null);
                                  }}
                                  className="block ml-auto mt-0.5 text-xs font-bold text-amber-950 hover:text-slate-950 underline cursor-pointer"
                                >
                                  {isSelected ? 'Sesi Dipilih' : 'Pilih Sesi'}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-amber-200/80 space-y-1">
                            <p className="text-[11px] font-bold text-slate-700">
                              Advisor Terdaftar:
                            </p>
                            {shift.registeredAdvisors.map((adv, idx) => (
                              <div
                                key={`${shift.id}-${idx}`}
                                className="flex items-center justify-between text-xs text-slate-900"
                              >
                                <span className="font-semibold">
                                  {idx + 1}. {adv.advisorName}
                                </span>
                                <span className="text-slate-700">{adv.corridorFocus}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Floortime Request Form */}
                  <form
                    onSubmit={handleBookFloortime}
                    className="lg:col-span-5 p-5 rounded-xl bg-[#FEFCE8] border-2 border-amber-300 space-y-4"
                    noValidate
                  >
                    <h4 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-800" />
                      Formulir Floortime Request
                    </h4>

                    <div>
                      <label
                        htmlFor="select-floortime-shift"
                        className="block text-xs font-bold text-slate-800 mb-1"
                      >
                        Pilih Sesi Floortime
                      </label>
                      <select
                        id="select-floortime-shift"
                        value={selectedShiftId}
                        onChange={(e) => setSelectedShiftId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shiftName} ({s.timeWindow}) — Terisi {s.registeredAdvisors.length}/{s.quotaMax}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="floortime-advisor-name"
                        className="block text-xs font-bold text-slate-800 mb-1"
                      >
                        Nama Property Advisor *
                      </label>
                      <input
                        id="floortime-advisor-name"
                        type="text"
                        value={ftAdvisorName}
                        onChange={(e) => setFtAdvisorName(e.target.value)}
                        placeholder="Contoh: Clarissa Tanoto"
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="floortime-corridor-select"
                        className="block text-xs font-bold text-slate-800 mb-1"
                      >
                        Fokus Koridor *
                      </label>
                      <select
                        id="floortime-corridor-select"
                        value={ftCorridor}
                        onChange={(e) => setFtCorridor(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Kota Wisata">Kota Wisata</option>
                        <option value="CitraGran & Ruko">CitraGran & Ruko</option>
                        <option value="Legenda Wisata">Legenda Wisata</option>
                        <option value="Komersial & Kavling">Komersial & Kavling</option>
                      </select>
                    </div>

                    {ftFeedback && (
                      <div
                        role="status"
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          ftFeedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : 'bg-red-50 border-red-300 text-red-800'
                        }`}
                      >
                        <p className="font-bold flex items-center gap-1.5">
                          {ftFeedback.type === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          )}
                          {ftFeedback.text}
                        </p>
                        {ftFeedback.waUrl && (
                          <a
                            href={ftFeedback.waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Konfirmasi Floortime ke WhatsApp Amat
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] border border-amber-400 rounded-xl transition-colors cursor-pointer"
                    >
                      Kirim Floortime Request
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
