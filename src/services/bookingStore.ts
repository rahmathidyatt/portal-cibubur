import type { FloortimeRegistration, RoomBooking } from '../utils/schedule';

/**
 * Penyimpanan reservasi.
 *
 * - Jika VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY diisi, data disimpan di Supabase
 *   sehingga semua pengguna melihat jadwal yang sama (lihat supabase/schema.sql).
 * - Jika tidak, data disimpan di localStorage browser (cukup untuk demo/pengembangan).
 */
export interface BookingStore {
  readonly mode: 'supabase' | 'local';
  listRoomBookings(date: string): Promise<RoomBooking[]>;
  addRoomBooking(booking: RoomBooking): Promise<void>;
  listFloortimeRegistrations(date: string): Promise<FloortimeRegistration[]>;
  addFloortimeRegistration(registration: FloortimeRegistration): Promise<void>;
}

export class BookingConflictError extends Error {}

/* ----------------------------- localStorage ----------------------------- */

const ROOM_KEY = 'portal-cibubur:room-bookings';
const FLOORTIME_KEY = 'portal-cibubur:floortime-registrations';

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Mode privat / kuota penuh: data tetap berlaku selama halaman terbuka.
  }
}

export function createLocalBookingStore(): BookingStore {
  return {
    mode: 'local',
    async listRoomBookings(date) {
      return readList<RoomBooking>(ROOM_KEY).filter((b) => b.date === date);
    },
    async addRoomBooking(booking) {
      const all = readList<RoomBooking>(ROOM_KEY);
      const taken = all.some(
        (b) =>
          b.roomId === booking.roomId &&
          b.date === booking.date &&
          b.slotTime === booking.slotTime
      );
      if (taken) {
        throw new BookingConflictError('Slot waktu ini sudah terisi.');
      }
      writeList(ROOM_KEY, [...all, booking]);
    },
    async listFloortimeRegistrations(date) {
      return readList<FloortimeRegistration>(FLOORTIME_KEY).filter(
        (r) => r.date === date
      );
    },
    async addFloortimeRegistration(registration) {
      const all = readList<FloortimeRegistration>(FLOORTIME_KEY);
      const duplicate = all.some(
        (r) =>
          r.shiftId === registration.shiftId &&
          r.date === registration.date &&
          r.advisorName.toLowerCase() === registration.advisorName.toLowerCase()
      );
      if (duplicate) {
        throw new BookingConflictError('Advisor tersebut sudah terdaftar pada sesi ini.');
      }
      writeList(FLOORTIME_KEY, [...all, registration]);
    }
  };
}

/* ------------------------------- Supabase ------------------------------- */

interface RoomBookingRow {
  room_id: RoomBooking['roomId'];
  booking_date: string;
  slot_time: string;
  booked_by: string;
  agenda: string;
}

interface FloortimeRow {
  shift_id: string;
  booking_date: string;
  advisor_name: string;
  corridor_focus: string;
}

export function createSupabaseBookingStore(url: string, anonKey: string): BookingStore {
  const baseUrl = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${baseUrl}/${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) }
    });
    if (res.status === 409) {
      throw new BookingConflictError('Data bentrok dengan reservasi lain.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Pesan dari trigger kuota (P0001) diteruskan agar mudah dipahami pengguna.
      if (detail.includes('Kuota')) {
        throw new BookingConflictError('Kuota sesi floortime ini sudah penuh.');
      }
      throw new Error(`Gagal menghubungi server (${res.status}). ${detail}`.trim());
    }
    return res;
  }

  return {
    mode: 'supabase',
    async listRoomBookings(date) {
      const res = await request(
        `room_bookings?select=room_id,booking_date,slot_time,booked_by,agenda&booking_date=eq.${encodeURIComponent(date)}`
      );
      const rows = (await res.json()) as RoomBookingRow[];
      return rows.map((r) => ({
        roomId: r.room_id,
        date: r.booking_date,
        slotTime: r.slot_time,
        bookedBy: r.booked_by,
        agenda: r.agenda
      }));
    },
    async addRoomBooking(b) {
      const row: RoomBookingRow = {
        room_id: b.roomId,
        booking_date: b.date,
        slot_time: b.slotTime,
        booked_by: b.bookedBy,
        agenda: b.agenda
      };
      await request('room_bookings', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      });
    },
    async listFloortimeRegistrations(date) {
      const res = await request(
        `floortime_registrations?select=shift_id,booking_date,advisor_name,corridor_focus&booking_date=eq.${encodeURIComponent(date)}&order=created_at.asc`
      );
      const rows = (await res.json()) as FloortimeRow[];
      return rows.map((r) => ({
        shiftId: r.shift_id,
        date: r.booking_date,
        advisorName: r.advisor_name,
        corridorFocus: r.corridor_focus
      }));
    },
    async addFloortimeRegistration(r) {
      const row: FloortimeRow = {
        shift_id: r.shiftId,
        booking_date: r.date,
        advisor_name: r.advisorName,
        corridor_focus: r.corridorFocus
      };
      await request('floortime_registrations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      });
    }
  };
}

/* ------------------------------ Pemilihan ------------------------------ */

let cachedStore: BookingStore | null = null;

export function getBookingStore(): BookingStore {
  if (cachedStore) return cachedStore;
  const env: Partial<ImportMetaEnv> = import.meta.env ?? {};
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  cachedStore =
    url && key ? createSupabaseBookingStore(url, key) : createLocalBookingStore();
  return cachedStore;
}
