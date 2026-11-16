import { useEffect, useState } from 'react';

/** Waktu sekarang yang diperbarui tiap menit (untuk status buka/tutup & sapaan). */
export function useJakartaClock(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
