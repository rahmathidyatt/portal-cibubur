import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, readLocal, supabaseFetch, writeLocal } from '../../services/supabaseClient';
import type { RewardClaim } from './closingReward';

/** Catatan klaim Closing Reward Booster (khusus admin). */
export interface RewardStore {
  list(auth: AdminAuth): Promise<RewardClaim[]>;
  claim(c: RewardClaim, auth: AdminAuth): Promise<void>;
  unclaim(closingId: string, agentKey: string, auth: AdminAuth): Promise<void>;
}

const KEY = 'portal-cibubur:closing-reward-claims';

function requireAdmin(auth: AdminAuth) {
  if (!auth.isAdmin) throw new Error('Closing reward khusus admin.');
}

export function validateClaimer(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Isi nama yang mengklaim.';
  if (n.length > 120) return 'Nama maksimal 120 karakter.';
  return null;
}

let cached: RewardStore | null = null;

export function getRewardStore(): RewardStore {
  if (cached) return cached;
  const config = getSupabaseConfig();
  if (!config) {
    const all = () => readLocal<RewardClaim[]>(KEY, []);
    cached = {
      async list(auth) {
        requireAdmin(auth);
        return all();
      },
      async claim(c, auth) {
        requireAdmin(auth);
        writeLocal(KEY, [...all().filter((x) => !(x.closingId === c.closingId && x.agentKey === c.agentKey)), c]);
      },
      async unclaim(closingId, agentKey, auth) {
        requireAdmin(auth);
        writeLocal(KEY, all().filter((x) => !(x.closingId === closingId && x.agentKey === agentKey)));
      }
    };
    return cached;
  }
  cached = {
    async list(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(config, 'rest/v1/closing_reward_claims?select=closing_id,agent_key,claimed_by,claimed_at&limit=5000', {
        accessToken: auth.accessToken
      });
      const rows = (await res.json()) as { closing_id: string; agent_key: string; claimed_by: string; claimed_at: string }[];
      return rows.map((r) => ({ closingId: r.closing_id, agentKey: r.agent_key, claimedBy: r.claimed_by, claimedAt: r.claimed_at }));
    },
    async claim(c, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, 'rest/v1/closing_reward_claims?on_conflict=closing_id,agent_key', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ closing_id: c.closingId, agent_key: c.agentKey, claimed_by: c.claimedBy.trim(), claimed_at: c.claimedAt })
      });
    },
    async unclaim(closingId, agentKey, auth) {
      requireAdmin(auth);
      await supabaseFetch(
        config,
        `rest/v1/closing_reward_claims?closing_id=eq.${encodeURIComponent(closingId)}&agent_key=eq.${encodeURIComponent(agentKey)}`,
        { method: 'DELETE', accessToken: auth.accessToken }
      );
    }
  };
  return cached;
}
