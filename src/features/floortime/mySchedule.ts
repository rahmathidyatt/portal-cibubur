import type { ScheduleData, ShiftSlot } from './engine';

/** Kode agen yang dipilih pengunjung di "Jadwal saya" (disimpan di browser). */
export const MY_AGENT_KEY = 'portal-cibubur:my-agent-code';

export function readMyAgentCode(): string {
  try {
    return window.localStorage.getItem(MY_AGENT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveMyAgentCode(code: string): void {
  try {
    if (code) window.localStorage.setItem(MY_AGENT_KEY, code);
    else window.localStorage.removeItem(MY_AGENT_KEY);
  } catch {
    // diabaikan
  }
}

/** Slot milik agen (berdasarkan kode), urut tanggal & shift. */
export function slotsForAgentCode(data: ScheduleData, code: string): ShiftSlot[] {
  const agent = data.agents.find((a) => a.code.toUpperCase() === code.toUpperCase());
  if (!agent) return [];
  return data.slots
    .filter((s) => (data.assignments[s.key] ?? []).some((e) => e.agentId === agent.id))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** "08.00-12.30" → menit mulai & selesai. */
export function slotMinutes(timeLabel: string): { start: number; end: number } {
  const [a, b] = timeLabel.split('-').map((t) => {
    const [h, m] = t.trim().split(/[.:]/).map(Number);
    return h * 60 + (m || 0);
  });
  return { start: a, end: b };
}

/** Slot berikutnya yang belum selesai (hari ini setelah jam sekarang, atau setelahnya). */
export function nextSlot(slots: ShiftSlot[], todayIso: string, minutesNow: number): ShiftSlot | null {
  return (
    slots.find((s) => s.date > todayIso || (s.date === todayIso && slotMinutes(s.timeLabel).end > minutesNow)) ?? null
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Waktu WIB (UTC+7) → format UTC iCalendar "YYYYMMDDTHHMMSSZ". */
function icsUtc(dateIso: string, minutes: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 0, minutes - 7 * 60));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** File kalender (.ics) berisi jadwal floor time seorang agen. */
export function buildIcs(
  slots: ShiftSlot[],
  opts: { agentName: string; location: string; stamp?: Date }
): string {
  const stamp = (opts.stamp ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Brighton HUB Cibubur//Portal//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Floor Time ${opts.agentName}`)}`
  ];
  for (const s of slots) {
    const { start, end } = slotMinutes(s.timeLabel);
    lines.push(
      'BEGIN:VEVENT',
      `UID:floortime-${s.key.replace(/[^0-9A-Za-z_-]/g, '')}-${opts.agentName.replace(/[^0-9A-Za-z]/g, '')}@portal-cibubur`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsUtc(s.date, start)}`,
      `DTEND:${icsUtc(s.date, end)}`,
      `SUMMARY:${escapeText(`Floor Time ${s.shiftName} · Brighton HUB Cibubur`)}`,
      `LOCATION:${escapeText(opts.location)}`,
      `DESCRIPTION:${escapeText(`Jadwal floor time ${opts.agentName}, shift ${s.shiftName} ${s.timeLabel} WIB.`)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Floor time 1 jam lagi',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
