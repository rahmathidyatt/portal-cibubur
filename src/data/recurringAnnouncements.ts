/** Pengumuman berulang mingguan: label waktu relatif terhadap hari ini. */
export const WEEKDAY_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** ISO weekday (1 = Senin … 7 = Minggu) dari tanggal YYYY-MM-DD. */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** "Hari ini", "Besok", atau "Setiap Senin". */
export function repeatLabel(weekday: number, todayIso: string): { label: string; isToday: boolean } {
  const wd = isoWeekday(todayIso);
  if (wd === weekday) return { label: 'Hari ini', isToday: true };
  if ((wd % 7) + 1 === weekday) return { label: 'Besok', isToday: false };
  return { label: `Setiap ${WEEKDAY_NAMES[weekday]}`, isToday: false };
}

/** Pengumuman awal (mode demo; di Supabase diisi sekali lewat migrasi). */
export const CO_BROKING_DAY = {
  title: 'Co-Broking Day',
  body: 'Setiap hari Senin dilaksanakan Co-Broking Day di lantai 2.',
  repeatWeekday: 1
};
