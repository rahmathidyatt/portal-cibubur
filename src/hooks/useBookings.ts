import { useCallback, useEffect, useState } from 'react';
import { getBookingStore } from '../services/bookingStore';
import type { FloortimeRegistration, RoomBooking } from '../utils/schedule';

/** Memuat reservasi ruang & floortime untuk satu tanggal. Ganti `refreshKey` untuk memuat ulang. */
export function useBookings(date: string, refreshKey: number = 0) {
  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([]);
  const [registrations, setRegistrations] = useState<FloortimeRegistration[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const store = getBookingStore();
    setIsLoading(true);
    setError(null);
    try {
      const [rooms, floortime] = await Promise.all([
        store.listRoomBookings(date),
        store.listFloortimeRegistrations(date)
      ]);
      setRoomBookings(rooms);
      setRegistrations(floortime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat agenda.');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { roomBookings, registrations, isLoading, error, reload };
}
