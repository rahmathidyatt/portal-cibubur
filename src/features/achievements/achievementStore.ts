import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, randomId, supabaseFetch } from '../../services/supabaseClient';
import { todayInJakarta } from '../../utils/schedule';
import { DEFAULT_ACHIEVEMENTS, normalizeRank, periodEndFrom, sortAchievements, type Achievement } from './achievementData';

const LOCAL_KEY = 'portal-cibubur:achievements';

interface Row {
  id: string;
  award: string;
  title: string;
  rank: string;
  period_label: string;
  period_end: string;
  photo_url: string | null;
}

const fromRow = (r: Row): Achievement => ({
  id: r.id,
  award: r.award,
  title: r.title,
  rank: r.rank,
  periodLabel: r.period_label,
  periodEnd: r.period_end,
  photoUrl: r.photo_url
});

function readLocal(): Achievement[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') as Achievement[] | null;
    return Array.isArray(v) ? v : DEFAULT_ACHIEVEMENTS;
  } catch {
    return DEFAULT_ACHIEVEMENTS;
  }
}
function writeLocal(list: Achievement[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    /* penyimpanan penuh/tidak tersedia */
  }
}

export async function listAchievements(): Promise<Achievement[]> {
  const config = getSupabaseConfig();
  if (!config) return sortAchievements(readLocal());
  const res = await supabaseFetch(config, 'rest/v1/achievements?select=id,award,title,rank,period_label,period_end,photo_url');
  return sortAchievements(((await res.json()) as Row[]).map(fromRow));
}

export type AchievementInput = Pick<Achievement, 'award' | 'title' | 'rank' | 'periodLabel' | 'photoUrl'>;

function clean(input: AchievementInput) {
  const periodLabel = input.periodLabel.trim();
  return {
    award: input.award.trim(),
    title: input.title.trim(),
    rank: normalizeRank(input.rank),
    periodLabel,
    periodEnd: periodEndFrom(periodLabel, todayInJakarta()),
    photoUrl: input.photoUrl
  };
}

const toRow = (c: ReturnType<typeof clean>) => ({
  award: c.award,
  title: c.title,
  rank: c.rank,
  period_label: c.periodLabel,
  period_end: c.periodEnd,
  photo_url: c.photoUrl
});

export async function addAchievement(input: AchievementInput, auth: AdminAuth): Promise<void> {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat menambah pencapaian.');
  const c = clean(input);
  const config = getSupabaseConfig();
  if (!config) {
    writeLocal([...readLocal(), { id: randomId(), ...c }]);
    return;
  }
  await supabaseFetch(config, 'rest/v1/achievements', {
    method: 'POST',
    accessToken: auth.accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(toRow(c))
  });
}

export async function updateAchievement(id: string, input: AchievementInput, auth: AdminAuth): Promise<void> {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah pencapaian.');
  const c = clean(input);
  const config = getSupabaseConfig();
  if (!config) {
    writeLocal(readLocal().map((a) => (a.id === id ? { id, ...c } : a)));
    return;
  }
  await supabaseFetch(config, `rest/v1/achievements?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    accessToken: auth.accessToken,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(toRow(c))
  });
}

export async function deleteAchievement(id: string, auth: AdminAuth): Promise<void> {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat menghapus pencapaian.');
  const config = getSupabaseConfig();
  if (!config) {
    writeLocal(readLocal().filter((a) => a.id !== id));
    return;
  }
  await supabaseFetch(config, `rest/v1/achievements?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', accessToken: auth.accessToken });
}
