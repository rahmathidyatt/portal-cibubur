import type { DealingRoom, FloortimeSlot } from '../data/cibuburData';

export function buildWhatsAppChatUrl(
  whatsappNumber: string,
  messageText: string
): string {
  const cleanDigits = whatsappNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(messageText.trim());
  return `https://wa.me/${cleanDigits}?text=${encodedText}`;
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
  let outsideHours = false;

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
        if (slot.status !== 'Tersedia') {
          outsideHours = true;
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

  if (outsideHours) {
    return {
      updatedRooms: rooms,
      success: false,
      error: 'Jam sesi ini tidak bisa dipesan (di luar jam operasional atau sudah lewat).'
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
