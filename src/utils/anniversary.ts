/** Ulang tahun kantor: usia, apakah hari ini, dan hitung mundur ke ulang tahun berikutnya. */
export interface AnniversaryInfo {
  /** Usia kantor dalam tahun penuh per tanggal `today`. */
  age: number;
  /** True bila `today` jatuh tepat pada tanggal & bulan berdiri (dan sudah lewat tahun berdiri). */
  isToday: boolean;
  /** Tanggal ulang tahun berikutnya (YYYY-MM-DD); hari ini bila isToday. */
  nextDate: string;
  /** Ulang tahun ke berapa pada nextDate. */
  nextAge: number;
  daysUntil: number;
}

const MS_DAY = 86_400_000;

function utc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function officeAnniversary(foundedIso: string, todayIso: string): AnniversaryInfo {
  const [fy, fm, fd] = foundedIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const passedThisYear = tm > fm || (tm === fm && td >= fd);
  const age = Math.max(0, ty - fy - (passedThisYear ? 0 : 1));
  const isToday = tm === fm && td === fd && ty > fy;
  const nextYear = passedThisYear && !isToday ? ty + 1 : ty;
  const nextDate = `${nextYear}-${pad(fm)}-${pad(fd)}`;
  return {
    age,
    isToday,
    nextDate,
    nextAge: nextYear - fy,
    daysUntil: Math.round((utc(nextDate) - utc(todayIso)) / MS_DAY)
  };
}
