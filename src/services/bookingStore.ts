import type { FloortimeRegistration, RoomBooking } from '../utils/schedule';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  SupabaseRequestError,
  writeLocal,
  type SupabaseConfig
} from './supabaseClient';

/**
 * Penyimpanan reservasi.
 *
 * - Jika VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY diisi, data disimpan di Supabase
 *   sehingga semua pengguna melihat jadwal yang sama (lihat supabase/schema.sql).
 * - Jika tidak, data disimpan di localStorage browser (cukup untuk demo/pengembangan).
 *
 * Pembatalan: pemesan bisa membatalkan reservasinya sendiri dari perangkat yang sama
 * (memakai kode pembatalan yang disimpan di browser), admin bisa membatalkan semuanya.
 */

export type NewRoomBooking = Omit<RoomBooking, 'id'>;
export type NewFloortimeRegistration = Omit<FloortimeRegistration, 'id'>;

export interface AdminAuth {
  isAdmin: boolean;
  accessToken: string | null;
}

export interface BookingStore {
  readonly mode: 'supabase' | 'local';
  listRoomBookings(date: string): Promise<RoomBooking[]>;
  addRoomBooking(booking: NewRoomBooking): Promise<string>;
  cancelRoomBooking(id: string, auth: AdminAuth): Promise<void>;
  listFloortimeRegistrations(date: string): Promise<FloortimeRegistration[]>;
  addFloortimeRegistration(registration: NewFloortimeRegistration): Promise<string>;
  cancelFloortimeRegistration(id: string, auth: AdminAuth): Promise<void>;
}

export class BookingConflictError extends Error {}

/* --------------------- Kode pembatalan milik pemesan --------------------- */

const OWN_TOKENS_KEY = 'portal-cibubur:my-booking-tokens';

function readOwnTokens(): Record<string, string> {
  const tokens = readLocal<Record<string, string>>(OWN_TOKENS_KEY, {});
  return tokens && typeof tokens === 'object' ? tokens : {};
}

function rememberOwnToken(id: string, token: string): void {
  writeLocal(OWN_TOKENS_KEY, { ...readOwnTokens(), [id]: token });
}

function forgetOwnToken(id: string): void {
  const tokens = readOwnTokens();
  delete tokens[id];
  writeLocal(OWN_TOKENS_KEY, tokens);
}

/** True jika reservasi ini dibuat dari browser ini (pemesan boleh membatalkan). */
export function isOwnBooking(id: string): boolean {
  return Boolean(readOwnTokens()[id]);
}

function requireCancelPermission(id: string, auth: AdminAuth): string | null {
  if (auth.isAdmin) return null;
  const token = readOwnTokens()[id];
  if (!token) {
    throw new Error('Hanya pemesan atau admin yang bisa membatalkan reservasi ini.');
  }
  return token;
}

/* ----------------------------- localStorage ----------------------------- */

const ROOM_KEY = 'portal-cibubur:room-bookings';
const FLOORTIME_KEY = 'portal-cibubur:floortime-registrations';

type Stored<T> = T & { cancelToken: string };

function readList<T>(key: string): Stored<T>[] {
  const list = readLocal<unknown>(key, []);
  // Data lama (sebelum ada id) diberi id agar tetap bisa dibatalkan admin.
  return Array.isArray(list)
    ? (list as Stored<T & { id?: string }>[]).map((item) => ({
        ...item,
        id: item.id ?? randomId(),
        cancelToken: item.cancelToken ?? randomId()
      }))
    : [];
}

function strip<T extends { cancelToken: string }>(item: T): Omit<T, 'cancelToken'> {
  const { cancelToken: _ignored, ...rest } = item;
  return rest;
}

function cancelLocal<T extends { id: string; cancelToken: string }>(
  key: string,
  id: string,
  auth: AdminAuth
): void {
  const token = requireCancelPermission(id, auth);
  const all = readList<T>(key) as unknown as T[];
  const target = all.find((item) => item.id === id);
  if (!target) return;
  if (token && target.cancelToken !== token) {
    throw new Error('Kode pembatalan tidak cocok.');
  }
  writeLocal(
    key,
    all.filter((item) => item.id !== id)
  );
  forgetOwnToken(id);
}

export function createLocalBookingStore(): BookingStore {
  return {
    mode: 'local',
    async listRoomBookings(date) {
      return readList<RoomBooking>(ROOM_KEY)
        .filter((b) => b.date === date)
        .map(strip);
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
      const id = randomId();
      const cancelToken = randomId();
      writeLocal(ROOM_KEY, [...all, { ...booking, id, cancelToken }]);
      rememberOwnToken(id, cancelToken);
      return id;
    },
    async cancelRoomBooking(id, auth) {
      cancelLocal<Stored<RoomBooking>>(ROOM_KEY, id, auth);
    },
    async listFloortimeRegistrations(date) {
      return readList<FloortimeRegistration>(FLOORTIME_KEY)
        .filter((r) => r.date === date)
        .map(strip);
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
      const id = randomId();
      const cancelToken = randomId();
      writeLocal(FLOORTIME_KEY, [...all, { ...registration, id, cancelToken }]);
      rememberOwnToken(id, cancelToken);
      return id;
    },
    async cancelFloortimeRegistration(id, auth) {
      cancelLocal<Stored<FloortimeRegistration>>(FLOORTIME_KEY, id, auth);
    }
  };
}

/* ------------------------------- Supabase ------------------------------- */

interface RoomBookingRow {
  id: string;
  room_id: RoomBooking['roomId'];
  booking_date: string;
  slot_time: string;
  booked_by: string;
  agenda: string;
}

interface FloortimeRow {
  id: string;
  shift_id: string;
  booking_date: string;
  advisor_name: string;
  corridor_focus: string;
}

function translateError(err: unknown): never {
  if (err instanceof SupabaseRequestError) {
    if (err.status === 409 || err.detail.includes('23505')) {
      throw new BookingConflictError('Data bentrok dengan reservasi lain. Muat ulang lalu pilih jadwal lain.');
    }
    if (err.detail.includes('Kuota')) {
      throw new BookingConflictError('Kuota sesi floortime ini sudah penuh.');
    }
    if (err.detail.includes('Tanggal')) {
      throw new BookingConflictError('Tanggal sudah lewat.');
    }
  }
  throw err;
}

async function cancelRemote(
  config: SupabaseConfig,
  table: 'room_bookings' | 'floortime_registrations',
  rpc: 'cancel_room_booking' | 'cancel_floortime_registration',
  id: string,
  auth: AdminAuth
): Promise<void> {
  if (auth.isAdmin && auth.accessToken) {
    await supabaseFetch(config, `rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      accessToken: auth.accessToken
    });
  } else {
    const token = requireCancelPermission(id, auth);
    const res = await supabaseFetch(config, `rest/v1/rpc/${rpc}`, {
      method: 'POST',
      body: JSON.stringify({ p_id: id, p_token: token })
    });
    const ok = (await res.json()) as boolean;
    if (!ok) throw new Error('Reservasi tidak ditemukan atau kode pembatalan tidak cocok.');
  }
  forgetOwnToken(id);
}

export function createSupabaseBookingStore(config: SupabaseConfig): BookingStore {
  return {
    mode: 'supabase',
    async listRoomBookings(date) {
      const res = await supabaseFetch(
        config,
        `rest/v1/room_bookings?select=id,room_id,booking_date,slot_time,booked_by,agenda&booking_date=eq.${encodeURIComponent(date)}`
      );
      const rows = (await res.json()) as RoomBookingRow[];
      return rows.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        date: r.booking_date,
        slotTime: r.slot_time,
        bookedBy: r.booked_by,
        agenda: r.agenda
      }));
    },
    async addRoomBooking(b) {
      try {
        const res = await supabaseFetch(config, 'rest/v1/rpc/create_room_booking', {
          method: 'POST',
          body: JSON.stringify({
            p_room_id: b.roomId,
            p_date: b.date,
            p_slot_time: b.slotTime,
            p_booked_by: b.bookedBy,
            p_agenda: b.agenda
          })
        });
        const data = (await res.json()) as { id: string; cancel_token: string };
        rememberOwnToken(data.id, data.cancel_token);
        return data.id;
      } catch (err) {
        translateError(err);
      }
    },
    async cancelRoomBooking(id, auth) {
      await cancelRemote(config, 'room_bookings', 'cancel_room_booking', id, auth);
    },
    async listFloortimeRegistrations(date) {
      const res = await supabaseFetch(
        config,
        `rest/v1/floortime_registrations?select=id,shift_id,booking_date,advisor_name,corridor_focus&booking_date=eq.${encodeURIComponent(date)}&order=created_at.asc`
      );
      const rows = (await res.json()) as FloortimeRow[];
      return rows.map((r) => ({
        id: r.id,
        shiftId: r.shift_id,
        date: r.booking_date,
        advisorName: r.advisor_name,
        corridorFocus: r.corridor_focus
      }));
    },
    async addFloortimeRegistration(r) {
      try {
        const res = await supabaseFetch(config, 'rest/v1/rpc/create_floortime_registration', {
          method: 'POST',
          body: JSON.stringify({
            p_shift_id: r.shiftId,
            p_date: r.date,
            p_advisor_name: r.advisorName,
            p_corridor_focus: r.corridorFocus
          })
        });
        const data = (await res.json()) as { id: string; cancel_token: string };
        rememberOwnToken(data.id, data.cancel_token);
        return data.id;
      } catch (err) {
        translateError(err);
      }
    },
    async cancelFloortimeRegistration(id, auth) {
      await cancelRemote(
        config,
        'floortime_registrations',
        'cancel_floortime_registration',
        id,
        auth
      );
    }
  };
}

/* ------------------------------ Pemilihan ------------------------------ */

let cachedStore: BookingStore | null = null;

export function getBookingStore(): BookingStore {
  if (!cachedStore) {
    const config = getSupabaseConfig();
    cachedStore = config ? createSupabaseBookingStore(config) : createLocalBookingStore();
  }
  return cachedStore;
}
