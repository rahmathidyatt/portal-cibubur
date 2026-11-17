import {
  addDaysIso,
  displayName,
  formatDateId,
  weekdayOf,
  type ScheduleData
} from './engine';

/**
 * Request perubahan jadwal Floor Time yang sudah diterbitkan.
 * Advisor dapat mengajukan "pindah" (dari salah satu jadwalnya ke slot lain) atau
 * "tambah" (slot tambahan) sampai batas waktu request. Admin menyetujui/menolak.
 */

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChangeRequest {
  id: string;
  scheduleId: string;
  agentId: string;
  agentName: string;
  /** Slot asal untuk permintaan pindah; null = tambah jadwal. */
  fromSlot: string | null;
  toSlot: string;
  reason: string;
  status: ChangeRequestStatus;
  createdAt: string;
  decidedAt?: string | null;
}

export interface NewChangeRequest {
  agentId: string;
  fromSlot: string | null;
  toSlot: string;
  reason: string;
}

/** Jadwal yang sudah diterbitkan ke portal. */
export interface PublishedSchedule {
  id: string;
  publishedAt: string;
  /** Batas pengajuan request (ISO dengan zona waktu). */
  requestDeadline: string;
  data: ScheduleData;
}

/**
 * Batas request bawaan: hari Minggu pada minggu yang sama dengan tanggal tayang,
 * pukul 23:59 WIB. Contoh: tayang Senin 2 Nov → batas Minggu 8 Nov 23:59 WIB.
 */
export function defaultRequestDeadline(publishDateIso: string): string {
  const sunday = addDaysIso(publishDateIso, 6 - weekdayOf(publishDateIso));
  return `${sunday}T23:59:00+07:00`;
}

export function isRequestOpen(deadlineIso: string, now: Date = new Date()): boolean {
  const deadline = new Date(deadlineIso).getTime();
  return Number.isFinite(deadline) && now.getTime() <= deadline;
}

export function formatDeadlineWib(deadlineIso: string): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(deadlineIso)) + ' WIB'
  );
}

export function slotLabel(data: ScheduleData, key: string): string {
  const slot = data.slots.find((s) => s.key === key);
  if (!slot) return key;
  return `${formatDateId(slot.date, true)} · ${slot.shiftName} ${slot.timeLabel}`;
}

/** Slot milik agen pada jadwal (untuk pilihan "pindah dari"). */
export function agentSlots(data: ScheduleData, agentId: string): string[] {
  return data.slots
    .filter((s) => (data.assignments[s.key] ?? []).some((e) => e.agentId === agentId))
    .map((s) => s.key);
}

/** Validasi isi request terhadap jadwal (dipakai di browser dan penyimpanan lokal). */
export function validateChangeRequest(data: ScheduleData, input: NewChangeRequest): string | null {
  const agent = data.agents.find((a) => a.id === input.agentId);
  if (!agent) return 'Pilih nama agen yang ada di jadwal.';
  const to = data.slots.find((s) => s.key === input.toSlot);
  if (!to) return 'Pilih tanggal & shift tujuan.';
  if (input.fromSlot) {
    if (input.fromSlot === input.toSlot) return 'Slot tujuan sama dengan jadwal asal.';
    const inFrom = (data.assignments[input.fromSlot] ?? []).some((e) => e.agentId === agent.id);
    if (!inFrom) return 'Jadwal asal tidak ditemukan untuk agen ini.';
  }
  const fromDate = input.fromSlot ? input.fromSlot.split('__')[0] : null;
  const busy = data.slots.some(
    (s) =>
      s.date === to.date &&
      s.key !== input.fromSlot &&
      (data.assignments[s.key] ?? []).some((e) => e.agentId === agent.id)
  );
  if (busy && fromDate !== to.date) {
    return `${displayName(agent)} sudah terjadwal pada ${formatDateId(to.date, true)}.`;
  }
  if (input.reason.trim().length < 3) return 'Isi alasan request minimal 3 karakter.';
  if (input.reason.trim().length > 200) return 'Alasan request maksimal 200 karakter.';
  return null;
}

/** Terapkan request yang disetujui ke data jadwal (mengembalikan salinan baru). */
export function applyChangeRequest(
  data: ScheduleData,
  req: Pick<ChangeRequest, 'agentId' | 'fromSlot' | 'toSlot'>
): { data?: ScheduleData; error?: string } {
  const agent = data.agents.find((a) => a.id === req.agentId);
  if (!agent) return { error: 'Agen tidak ada di jadwal.' };
  const to = data.slots.find((s) => s.key === req.toSlot);
  if (!to) return { error: 'Slot tujuan tidak ada di jadwal.' };

  const assignments: ScheduleData['assignments'] = {};
  for (const [key, list] of Object.entries(data.assignments)) assignments[key] = [...list];

  if (req.fromSlot) {
    const before = assignments[req.fromSlot] ?? [];
    if (!before.some((e) => e.agentId === agent.id)) {
      return { error: 'Agen sudah tidak ada di jadwal asal (mungkin sudah dipindahkan).' };
    }
    assignments[req.fromSlot] = before.filter((e) => e.agentId !== agent.id);
  }
  const busy = data.slots.some(
    (s) => s.date === to.date && (assignments[s.key] ?? []).some((e) => e.agentId === agent.id)
  );
  if (busy) return { error: `${displayName(agent)} sudah terjadwal pada ${formatDateId(to.date, true)}.` };

  assignments[to.key] = [
    ...(assignments[to.key] ?? []),
    { agentId: agent.id, displayName: displayName(agent), isUrgent: true }
  ];
  return { data: { ...data, assignments } };
}
