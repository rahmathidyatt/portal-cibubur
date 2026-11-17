import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Users, CheckCircle2, MessageCircle, ExternalLink } from 'lucide-react';
import {
  DealingRoom,
  FloortimeSlot,
  OfficeStaffContact,
  OfficeDaySchedule
} from '../data/cibuburData';
import {
  bookConsultationRoomSlot,
  bookFloortimeShift,
  buildWhatsAppChatUrl
} from '../utils/hubLogic';
import {
  buildRoomsForDate,
  buildShiftsForDate,
  getScheduleForDate,
  isShiftActiveOnDate,
  todayInJakarta,
  minutesNowInJakarta,
  validateBookingDate,
  type FloortimeRegistration,
  type RoomBooking
} from '../utils/schedule';
import { BookingConflictError, getBookingStore, isOwnBooking } from '../services/bookingStore';
import { useAdmin } from '../hooks/useAdmin';
import { ConfirmCancelButton } from './ConfirmCancelButton';

type BookingTab = 'dealing-room-1' | 'dealing-room-2' | 'floortime';

export type ReservationView = 'dealing-room' | 'floortime';

interface ReservationPageProps {
  view: ReservationView;
  initialRooms: DealingRoom[];
  initialShifts: FloortimeSlot[];
  weeklyHours: OfficeDaySchedule[];
  opsContact: OfficeStaffContact;
}

/** Halaman reservasi: Dealing Room (2 ruang) atau pendaftaran Floortime. */
export const ReservationPage: React.FC<ReservationPageProps> = ({
  view,
  initialRooms,
  initialShifts,
  weeklyHours,
  opsContact
}) => {
  const [activeRoomTab, setActiveRoomTab] = useState<'dealing-room-1' | 'dealing-room-2'>(
    'dealing-room-1'
  );
  const activeTab: BookingTab = view === 'floortime' ? 'floortime' : activeRoomTab;
  const onChangeTab = (tab: BookingTab) => {
    if (tab !== 'floortime') setActiveRoomTab(tab);
  };
  const store = getBookingStore();
  const { auth, isAdmin } = useAdmin();
  const today = todayInJakarta();

  const [bookingDate, setBookingDate] = useState<string>(today);
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [registrations, setRegistrations] = useState<FloortimeRegistration[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Room booking form state
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('');
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

  const dateError = validateBookingDate(bookingDate, today, weeklyHours);
  const daySchedule = getScheduleForDate(bookingDate, weeklyHours);

  const loadBookings = useCallback(
    async (date: string) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [roomList, ftList] = await Promise.all([
          store.listRoomBookings(date),
          store.listFloortimeRegistrations(date)
        ]);
        setRoomBookings(roomList);
        setRegistrations(ftList);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Gagal memuat data reservasi.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [store]
  );

  useEffect(() => {
    void loadBookings(bookingDate);
  }, [bookingDate, loadBookings]);

  const rooms = useMemo(
    () =>
      buildRoomsForDate(
        initialRooms,
        roomBookings,
        bookingDate,
        weeklyHours,
        bookingDate === today ? minutesNowInJakarta() : undefined
      ),
    [initialRooms, roomBookings, bookingDate, weeklyHours, today]
  );
  const shifts = useMemo(
    () => buildShiftsForDate(initialShifts, registrations, bookingDate),
    [initialShifts, registrations, bookingDate]
  );

  const activeRoomId: 'dealing-room-1' | 'dealing-room-2' =
    activeTab === 'dealing-room-2' ? 'dealing-room-2' : 'dealing-room-1';
  const currentRoom =
    rooms.find((r) => r.id === activeRoomId) || rooms[0];

  // Pastikan slot yang dipilih selalu slot yang masih tersedia
  // (misalnya setelah pindah tab ruang, ganti tanggal, atau slot baru saja dipesan).
  useEffect(() => {
    if (!currentRoom) return;
    const stillAvailable = currentRoom.slots.some(
      (s) => s.time === selectedSlotTime && s.status === 'Tersedia'
    );
    if (!stillAvailable) {
      const firstOpen = currentRoom.slots.find((s) => s.status === 'Tersedia');
      setSelectedSlotTime(firstOpen ? firstOpen.time : '');
    }
  }, [currentRoom, selectedSlotTime]);

  // Jika sesi floortime terpilih tidak berlaku di tanggal ini (mis. Sesi Sore di hari Sabtu),
  // pindahkan pilihan ke sesi pertama yang berlaku.
  useEffect(() => {
    const selected = shifts.find((s) => s.id === selectedShiftId);
    if (selected && isShiftActiveOnDate(selected, bookingDate)) return;
    const firstActive = shifts.find((s) => isShiftActiveOnDate(s, bookingDate));
    if (firstActive && firstActive.id !== selectedShiftId) {
      setSelectedShiftId(firstActive.id);
    }
  }, [shifts, selectedShiftId, bookingDate]);


  const handleSelectRoomSlot = (time: string) => {
    setSelectedSlotTime(time);
    setRoomFeedback(null);
  };

  const handleChangeDate = (value: string) => {
    setBookingDate(value);
    setRoomFeedback(null);
    setFtFeedback(null);
  };

  const handleCancelRoom = async (bookingId: string, label: string) => {
    try {
      await store.cancelRoomBooking(bookingId, auth);
      setRoomFeedback({ type: 'success', text: `Reservasi ${label} dibatalkan.` });
      } catch (err) {
      setRoomFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Pembatalan gagal.'
      });
    }
    await loadBookings(bookingDate);
  };

  const handleCancelFloortime = async (registrationId: string, label: string) => {
    try {
      await store.cancelFloortimeRegistration(registrationId, auth);
      setFtFeedback({ type: 'success', text: `Pendaftaran floortime ${label} dibatalkan.` });
      } catch (err) {
      setFtFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Pembatalan gagal.'
      });
    }
    await loadBookings(bookingDate);
  };

  const describeSaveError = (err: unknown, fallback: string): string => {
    if (err instanceof BookingConflictError) return err.message;
    if (err instanceof Error) return `${fallback} ${err.message}`;
    return fallback;
  };

  const handleBookRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (dateError) {
      setRoomFeedback({ type: 'error', text: dateError });
      return;
    }
    if (!selectedSlotTime) {
      setRoomFeedback({
        type: 'error',
        text: 'Tidak ada jam sesi yang tersedia pada tanggal ini. Silakan pilih tanggal lain.'
      });
      return;
    }

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

    const roomName = currentRoom?.tabLabel || 'Dealing Room';
    const advisor = roomAdvisorName.trim();
    const agenda = roomAgenda.trim();
    const slotTime = selectedSlotTime;

    setIsSaving(true);
    try {
      await store.addRoomBooking({
        roomId: activeRoomId,
        date: bookingDate,
        slotTime,
        bookedBy: advisor,
        agenda
      });
    } catch (err) {
      setRoomFeedback({
        type: 'error',
        text: describeSaveError(err, 'Reservasi gagal disimpan.')
      });
      await loadBookings(bookingDate);
      setIsSaving(false);
      return;
    }
    await loadBookings(bookingDate);
    setIsSaving(false);

    const waText = `Halo Mas Amat (${opsContact.staffName}), saya ${advisor} telah melakukan reservasi ${roomName} pada tanggal ${bookingDate} jam ${slotTime} WIB untuk keperluan: ${agenda}. Mohon konfirmasinya, terima kasih.`;
    const waUrl = buildWhatsAppChatUrl(opsContact.whatsappNumber, waText);

    setRoomFeedback({
      type: 'success',
      text: `Terjadwal: ${roomName} (${bookingDate}, ${slotTime} WIB) berhasil dipesan atas nama ${advisor}.`,
      waUrl
    });
    setRoomAgenda('');
  };

  const handleBookFloortime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (dateError) {
      setFtFeedback({ type: 'error', text: dateError });
      return;
    }

    const shiftObj = shifts.find((s) => s.id === selectedShiftId);
    if (shiftObj && !isShiftActiveOnDate(shiftObj, bookingDate)) {
      setFtFeedback({
        type: 'error',
        text: `${shiftObj.shiftName} hanya tersedia ${shiftObj.dayLabel}. Silakan pilih sesi atau tanggal lain.`
      });
      return;
    }

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

    const advisor = ftAdvisorName.trim();
    const corridor = ftCorridor.trim();
    const shiftTitle = shiftObj
      ? `${shiftObj.shiftName} (${shiftObj.timeWindow})`
      : 'Floortime Request';

    setIsSaving(true);
    try {
      await store.addFloortimeRegistration({
        shiftId: selectedShiftId,
        date: bookingDate,
        advisorName: advisor,
        corridorFocus: corridor
      });
    } catch (err) {
      setFtFeedback({
        type: 'error',
        text: describeSaveError(err, 'Pendaftaran floortime gagal disimpan.')
      });
      await loadBookings(bookingDate);
      setIsSaving(false);
      return;
    }
    await loadBookings(bookingDate);
    setIsSaving(false);

    const waText = `Halo Mas Amat (${opsContact.staffName}), saya ${advisor} mengajukan Floortime Request untuk ${shiftTitle} tanggal ${bookingDate} dengan fokus koridor ${corridor}. Terima kasih.`;
    const waUrl = buildWhatsAppChatUrl(opsContact.whatsappNumber, waText);

    setFtFeedback({
      type: 'success',
      text: `Terdaftar: ${advisor} (${corridor}) masuk dalam daftar ${shiftTitle} tanggal ${bookingDate}.`,
      waUrl
    });
    setFtAdvisorName('');
  };

  const pageTitle = view === 'floortime' ? 'Daftar Floortime' : 'Reservasi Dealing Room';
  const pageIntro =
    view === 'floortime'
      ? 'Daftarkan diri untuk jaga kantor. Maksimal 3 advisor per sesi.'
      : 'Pesan ruang diskusi klien per sesi 2 jam.';

  return (
    <section className="bg-stone-50 min-h-[70vh] py-8 sm:py-12">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <a href="#beranda" className="hover:text-slate-900">
            Beranda
          </a>
          <span className="mx-1.5">/</span>
          <span>Reservasi</span>
          <span className="mx-1.5">/</span>
          <span className="font-semibold text-slate-700">
            {view === 'floortime' ? 'Floortime' : 'Dealing Room'}
          </span>
        </nav>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{pageIntro}</p>

        <div className="mt-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Modal Sub-Header: 3 Tabs (Dealing Room 1, Dealing Room 2, Floortime Request) + Date Picker */}
            <div className="px-6 py-3.5 bg-stone-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {view === 'floortime' ? (
                <p className="text-sm font-semibold text-slate-700">Pilih tanggal jaga</p>
              ) : (
              <div
                role="tablist"
                aria-label="Pilih Dealing Room"
                className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl"
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
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
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
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Dealing Room 2
                </button>
              </div>
              )}

              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
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
                  min={today}
                  onChange={(e) => handleChangeDate(e.target.value)}
                  className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6">
              {(dateError || loadError || isLoading || store.mode === 'local') && (
                <div className="mb-5 space-y-2" aria-live="polite">
                  {dateError && (
                    <p className="p-3 rounded-xl border border-red-300 bg-red-50 text-xs font-bold text-red-800">
                      {dateError}
                    </p>
                  )}
                  {loadError && (
                    <p className="p-3 rounded-xl border border-red-300 bg-red-50 text-xs font-bold text-red-800">
                      Gagal memuat data reservasi: {loadError}{' '}
                      <button
                        type="button"
                        onClick={() => void loadBookings(bookingDate)}
                        className="underline cursor-pointer"
                      >
                        Coba lagi
                      </button>
                    </p>
                  )}
                  {isLoading && !loadError && (
                    <p className="text-xs font-semibold text-slate-600">
                      Memuat jadwal tanggal {bookingDate}…
                    </p>
                  )}
                  {store.mode === 'local' && !dateError && (
                    <p className="p-3 rounded-xl border border-slate-200 bg-stone-50 text-[11px] text-slate-600">
                      Data reservasi saat ini hanya tersimpan di perangkat ini.
                      Konfirmasikan reservasi ke Operasional lewat WhatsApp setelah menyimpan.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'dealing-room-1' || activeTab === 'dealing-room-2' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Room Schedule Slots */}
                  <div className="lg:col-span-7 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        {currentRoom.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        {currentRoom.floorAndLocation} · Kapasitas{' '}
                        <strong className="font-mono">{currentRoom.capacityPax}</strong> orang ·{' '}
                        {currentRoom.facilities}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentRoom.slots.map((slot) => {
                        const isBooked = slot.status === 'Terisi';
                        const isUnavailable =
                          slot.status !== 'Tersedia' || Boolean(dateError);
                        const isSelected =
                          selectedSlotTime === slot.time && !isUnavailable;

                        return (
                          <div
                            key={slot.time}
                            // Seluruh kartu bisa diklik (tombol "Pilih Jam" tetap ada untuk keyboard).
                            onClick={isUnavailable ? undefined : () => handleSelectRoomSlot(slot.time)}
                            className={`p-3.5 rounded-xl border text-xs transition-colors ${
                              isUnavailable
                                ? 'bg-slate-50 border-slate-200 text-slate-400'
                                : isSelected
                                ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400 text-slate-950 cursor-pointer'
                                : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold">{slot.time} WIB</span>
                              {isUnavailable ? (
                                <span className="text-slate-500 font-semibold">
                                  {dateError && slot.status === 'Tersedia'
                                    ? 'Tutup'
                                    : slot.status}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectRoomSlot(slot.time)}
                                  className="text-slate-900 hover:text-amber-700 font-bold underline underline-offset-2 cursor-pointer"
                                >
                                  {isSelected ? 'Dipilih' : 'Pilih Jam'}
                                </button>
                              )}
                            </div>
                            {isBooked ? (
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <p className="text-[11px] text-slate-600 truncate">
                                  {slot.bookedBy} — {slot.agenda}
                                </p>
                                {slot.bookingId && (isAdmin || isOwnBooking(slot.bookingId)) && (
                                  <ConfirmCancelButton
                                    onConfirm={() =>
                                      handleCancelRoom(
                                        slot.bookingId as string,
                                        `${currentRoom.tabLabel} ${slot.time}`
                                      )
                                    }
                                  />
                                )}
                              </div>
                            ) : slot.status === 'Sudah Lewat' ? (
                              <p className="mt-1.5 text-[11px] text-slate-500">Jam sesi sudah lewat</p>
                            ) : isUnavailable ? (
                              <p className="mt-1.5 text-[11px] text-slate-500">
                                {daySchedule && !daySchedule.isClosed && !dateError
                                  ? `Kantor buka ${daySchedule.hours} WIB pada hari ${daySchedule.dayNameId}`
                                  : 'Tidak dapat dipesan pada tanggal ini'}
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
                    className="lg:col-span-5 p-5 rounded-xl bg-stone-50 border border-slate-200 space-y-4"
                    noValidate
                  >
                    <h4 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      Formulir reservasi
                    </h4>

                    <div>
                      <p className="block text-xs font-bold text-slate-800 mb-1">Jam sesi</p>
                      <p
                        aria-live="polite"
                        className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                      >
                        {selectedSlotTime ? `${selectedSlotTime} WIB` : 'Pilih jam yang tersedia di daftar'}
                      </p>
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors"
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
                      disabled={isSaving || isLoading || Boolean(dateError)}
                      className="w-full px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Menyimpan…' : `Simpan Reservasi ${currentRoom.tabLabel}`}
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
                      const isActiveDay = isShiftActiveOnDate(shift, bookingDate);
                      const isSelected = selectedShiftId === shift.id;

                      return (
                        <div
                          key={shift.id}
                          className={`p-4 rounded-xl border transition-colors ${
                            isSelected
                              ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-white border-slate-200'
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
                                  isFull ? 'text-amber-700' : 'text-emerald-700'
                                }`}
                              >
                                {isActiveDay
                                  ? `Kuota ${count}/${shift.quotaMax} Advisor`
                                  : 'Tidak ada sesi di tanggal ini'}
                              </span>
                              {!isFull && isActiveDay && !dateError && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedShiftId(shift.id);
                                    setFtFeedback(null);
                                  }}
                                  className="block ml-auto mt-0.5 text-xs font-bold text-slate-900 hover:text-amber-700 underline underline-offset-2 cursor-pointer"
                                >
                                  {isSelected ? 'Sesi Dipilih' : 'Pilih Sesi'}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-1">
                            <p className="text-[11px] font-bold text-slate-700">
                              Advisor Terdaftar:
                            </p>
                            {shift.registeredAdvisors.length === 0 && (
                              <p className="text-xs text-slate-500">Belum ada advisor terdaftar.</p>
                            )}
                            {shift.registeredAdvisors.map((adv, idx) => (
                              <div
                                key={`${shift.id}-${idx}`}
                                className="flex items-center justify-between text-xs text-slate-900"
                              >
                                <span className="font-semibold">
                                  {idx + 1}. {adv.advisorName}
                                </span>
                                <span className="flex items-center gap-3">
                                  <span className="text-slate-700">{adv.corridorFocus}</span>
                                  {adv.registrationId &&
                                    (isAdmin || isOwnBooking(adv.registrationId)) && (
                                      <ConfirmCancelButton
                                        onConfirm={() =>
                                          handleCancelFloortime(
                                            adv.registrationId as string,
                                            adv.advisorName
                                          )
                                        }
                                      />
                                    )}
                                </span>
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
                    className="lg:col-span-5 p-5 rounded-xl bg-stone-50 border border-slate-200 space-y-4"
                    noValidate
                  >
                    <h4 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      Formulir pendaftaran
                    </h4>

                    <div>
                      <p className="block text-xs font-bold text-slate-800 mb-1">Sesi</p>
                      <p
                        aria-live="polite"
                        className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      >
                        {(() => {
                          const sel = shifts.find((sh) => sh.id === selectedShiftId);
                          return sel && isShiftActiveOnDate(sel, bookingDate)
                            ? `${sel.shiftName} (${sel.timeWindow})`
                            : 'Pilih sesi di daftar';
                        })()}
                      </p>
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors"
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
                      disabled={isSaving || isLoading || Boolean(dateError)}
                      className="w-full px-4 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Menyimpan…' : 'Daftar floortime'}
                    </button>
                  </form>
                </div>
              )}
            </div>
        </div>
      </div>
    </section>
  );
};
