import {
  MorningQuote,
  OfficeStaffContact,
  StaffDivision,
  StaffAvailabilityStatus,
  DealingRoom,
  FloortimeSlot
} from '../data/cibuburData';

export function buildWhatsAppChatUrl(
  whatsappNumber: string,
  messageText: string
): string {
  const cleanDigits = whatsappNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(messageText.trim());
  return `https://wa.me/${cleanDigits}?text=${encodedText}`;
}

export function buildCustomStaffWhatsAppMessage(
  contact: OfficeStaffContact,
  selectedTopic?: string,
  senderName?: string
): string {
  const cleanSender = senderName?.trim();
  const intro = cleanSender
    ? `Halo ${contact.division} Brighton HUB Cibubur (${contact.staffName}), saya ${cleanSender}.`
    : `Halo ${contact.division} Brighton HUB Cibubur (${contact.staffName}).`;

  if (selectedTopic && selectedTopic.trim().length > 0) {
    return `${intro} Saya ingin menghubungi terkait keperluan: ${selectedTopic.trim()}. Terima kasih.`;
  }

  return contact.defaultMessage;
}

export function filterStaffByDivision(
  contacts: OfficeStaffContact[],
  division: 'Semua' | StaffDivision,
  searchQuery: string = ''
): OfficeStaffContact[] {
  const q = searchQuery.trim().toLowerCase();

  return contacts.filter((c) => {
    if (division !== 'Semua' && c.division !== division) {
      return false;
    }
    if (q.length > 0) {
      const haystack = [
        c.division,
        c.roleTitle,
        c.staffName,
        c.description,
        ...c.commonTasks
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    }
    return true;
  });
}

export function getNextMorningInspiration(
  quotes: MorningQuote[],
  currentIndex: number
): { nextIndex: number; quote: MorningQuote } {
  if (quotes.length === 0) {
    throw new Error('Quotes array must not be empty');
  }
  const nextIndex = (currentIndex + 1) % quotes.length;
  return {
    nextIndex,
    quote: quotes[nextIndex]
  };
}

const AVAILABILITY_ORDER: StaffAvailabilityStatus[] = [
  'Online',
  'Sibuk',
  'Di Luar Kantor'
];

export function cycleStaffAvailability(
  current: StaffAvailabilityStatus
): { status: StaffAvailabilityStatus; detail: string } {
  const idx = AVAILABILITY_ORDER.indexOf(current);
  const next = AVAILABILITY_ORDER[(idx + 1) % AVAILABILITY_ORDER.length];
  if (next === 'Online') {
    return { status: 'Online', detail: 'Siap melayani di meja kantor' };
  }
  if (next === 'Sibuk') {
    return { status: 'Sibuk', detail: 'Sedang melayani · Respon ~10 mnt' };
  }
  return {
    status: 'Di Luar Kantor',
    detail: 'Tugas luar / rute lapangan · Chat aktif'
  };
}

export function bookConsultationRoomSlot(
  rooms: DealingRoom[],
  roomId: string,
  slotTime: string,
  bookedBy: string,
  agenda: string
): { updatedRooms: DealingRoom[]; success: boolean; error?: string } {
  if (!bookedBy || bookedBy.trim().length < 2) {
    return {
      updatedRooms: rooms,
      success: false,
      error: 'Mohon isi nama Property Advisor atau pemesan ruang (minimal 2 karakter).'
    };
  }
  if (!agenda || agenda.trim().length < 3) {
    return {
      updatedRooms: rooms,
      success: false,
      error: 'Mohon isi keperluan diskusi atau nama klien (minimal 3 karakter).'
    };
  }

  let slotFound = false;
  let alreadyBooked = false;

  const updatedRooms = rooms.map((room) => {
    if (room.id !== roomId) return room;
    return {
      ...room,
      slots: room.slots.map((slot) => {
        if (slot.time !== slotTime) return slot;
        slotFound = true;
        if (slot.status === 'Terisi') {
          alreadyBooked = true;
          return slot;
        }
        return {
          ...slot,
          status: 'Terisi' as const,
          bookedBy: bookedBy.trim(),
          agenda: agenda.trim()
        };
      })
    };
  });

  if (!slotFound) {
    return {
      updatedRooms: rooms,
      success: false,
      error: 'Dealing Room atau jam sesi yang dipilih tidak ditemukan.'
    };
  }
  if (alreadyBooked) {
    return {
      updatedRooms: rooms,
      success: false,
      error: 'Slot waktu ini sudah terisi. Silakan pilih jam lain yang tersedia.'
    };
  }

  return { updatedRooms, success: true };
}

export function bookFloortimeShift(
  shifts: FloortimeSlot[],
  shiftId: string,
  advisorName: string,
  corridorFocus: string
): { updatedShifts: FloortimeSlot[]; success: boolean; error?: string } {
  const cleanName = advisorName.trim();
  const cleanCorridor = corridorFocus.trim();

  if (cleanName.length < 2) {
    return {
      updatedShifts: shifts,
      success: false,
      error: 'Mohon isi nama Property Advisor untuk jadwal floortime.'
    };
  }
  if (cleanCorridor.length < 2) {
    return {
      updatedShifts: shifts,
      success: false,
      error: 'Mohon isi fokus koridor atau spesialisasi properti.'
    };
  }

  const targetShift = shifts.find((s) => s.id === shiftId);
  if (!targetShift) {
    return {
      updatedShifts: shifts,
      success: false,
      error: 'Sesi floortime tidak ditemukan.'
    };
  }

  if (targetShift.registeredAdvisors.length >= targetShift.quotaMax) {
    return {
      updatedShifts: shifts,
      success: false,
      error: 'Kuota sesi floortime ini sudah penuh. Silakan pilih sesi lainnya.'
    };
  }

  const alreadyInShift = targetShift.registeredAdvisors.some(
    (a) => a.advisorName.toLowerCase() === cleanName.toLowerCase()
  );
  if (alreadyInShift) {
    return {
      updatedShifts: shifts,
      success: false,
      error: 'Advisor tersebut sudah terdaftar pada sesi floortime ini.'
    };
  }

  const updatedShifts = shifts.map((shift) => {
    if (shift.id !== shiftId) return shift;
    return {
      ...shift,
      registeredAdvisors: [
        ...shift.registeredAdvisors,
        { advisorName: cleanName, corridorFocus: cleanCorridor }
      ]
    };
  });

  return { updatedShifts, success: true };
}
