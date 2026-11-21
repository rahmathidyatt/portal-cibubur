import type { Closing, ClosingAgent } from './closing';

/** Event Closing Reward Booster: closing 1 Agustus – 31 Desember 2026. */
export const REWARD_EVENT = { start: '2026-08-01', end: '2026-12-31' } as const;
/** Batas klaim: 6 hari setelah tanggal closing (closing 21 → batas 27, 28 expired). */
export const CLAIM_DAYS = 6;

export interface RewardClaim {
  closingId: string;
  agentKey: string;
  claimedBy: string;
  claimedAt: string;
}

export type RewardStatus = 'open' | 'claimed' | 'expired';

export interface RewardEntry {
  key: string;
  closing: Closing;
  agent: ClosingAgent;
  agentKey: string;
  deadline: string;
  status: RewardStatus;
  daysLeft: number;
  claim?: RewardClaim;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Hanya agen dari Cibubur, Bogor yang ikut event. */
export function isCibuburAgent(a: Pick<ClosingAgent, 'area'>): boolean {
  return /cibubur/i.test(a.area);
}

export function agentKey(a: Pick<ClosingAgent, 'name' | 'code'>): string {
  return `${a.name.trim().toLowerCase()}|${a.code.trim().toUpperCase()}`;
}

/** Daftar hak reward: setiap agen Cibubur (termasuk PL) di setiap closing dalam periode event. */
export function rewardEntries(closings: Closing[], claims: RewardClaim[], today: string): RewardEntry[] {
  const byKey = new Map(claims.map((c) => [`${c.closingId}#${c.agentKey}`, c]));
  const out: RewardEntry[] = [];
  for (const closing of closings) {
    if (closing.date < REWARD_EVENT.start || closing.date > REWARD_EVENT.end) continue;
    const deadline = addDaysIso(closing.date, CLAIM_DAYS);
    const seen = new Set<string>();
    for (const agent of closing.agents) {
      if (!agent.name.trim() || !isCibuburAgent(agent)) continue;
      const k = agentKey(agent);
      if (seen.has(k)) continue;
      seen.add(k);
      const claim = byKey.get(`${closing.id}#${k}`);
      const status: RewardStatus = claim ? 'claimed' : today > deadline ? 'expired' : 'open';
      out.push({ key: `${closing.id}#${k}`, closing, agent, agentKey: k, deadline, status, daysLeft: dayDiff(today, deadline), claim });
    }
  }
  const rank: Record<RewardStatus, number> = { open: 0, claimed: 1, expired: 2 };
  return out.sort(
    (a, b) => rank[a.status] - rank[b.status] || (a.status === 'open' ? a.deadline.localeCompare(b.deadline) : b.closing.date.localeCompare(a.closing.date))
  );
}
