import type { AdminAuth } from '../../services/bookingStore';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  writeLocal,
  type SupabaseConfig
} from '../../services/supabaseClient';
import type { TrainingAgent, TrainingBatch } from './training';

/** Rekap Training Brighton (khusus admin). */
export interface TrainingStore {
  list(auth: AdminAuth): Promise<TrainingAgent[]>;
  add(name: string, auth: AdminAuth): Promise<TrainingAgent>;
  save(agent: TrainingAgent, auth: AdminAuth): Promise<void>;
  saveMany(agents: TrainingAgent[], auth: AdminAuth): Promise<void>;
  remove(id: string, auth: AdminAuth): Promise<void>;
  /** Impor rekap: agen dengan nama sama diperbarui, sisanya ditambahkan. */
  importMany(agents: Omit<TrainingAgent, 'id'>[], auth: AdminAuth): Promise<void>;
  /** Batch training berikutnya (diatur admin). */
  getBatch(auth: AdminAuth): Promise<TrainingBatch | null>;
  setBatch(batch: TrainingBatch, auth: AdminAuth): Promise<void>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat membuka rekap training.');
}

const KEY = 'portal-cibubur:training-agents';
const BATCH_KEY = 'portal-cibubur:training-batch';

function readAll(): TrainingAgent[] {
  const list = readLocal<TrainingAgent[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

function createLocalStore(): TrainingStore {
  const store: TrainingStore = {
    async list(auth) {
      requireAdmin(auth);
      return readAll();
    },
    async add(name, auth) {
      requireAdmin(auth);
      if (readAll().some((a) => a.name === name)) throw new Error(`${name} sudah ada di rekap.`);
      const agent: TrainingAgent = { id: randomId(), name, scores: {}, pending: {} };
      writeLocal(KEY, [...readAll(), agent]);
      return agent;
    },
    async save(agent, auth) {
      requireAdmin(auth);
      writeLocal(KEY, readAll().map((a) => (a.id === agent.id ? agent : a)));
    },
    async saveMany(agents, auth) {
      requireAdmin(auth);
      const map = new Map(agents.map((a) => [a.id, a]));
      writeLocal(KEY, readAll().map((a) => map.get(a.id) ?? a));
    },
    async remove(id, auth) {
      requireAdmin(auth);
      writeLocal(KEY, readAll().filter((a) => a.id !== id));
    },
    async importMany(agents, auth) {
      requireAdmin(auth);
      const all = readAll();
      for (const a of agents) {
        const i = all.findIndex((x) => x.name === a.name);
        if (i >= 0) all[i] = { ...all[i], ...a };
        else all.push({ ...a, id: randomId() });
      }
      writeLocal(KEY, all);
    },
    async getBatch(auth) {
      requireAdmin(auth);
      return readLocal<TrainingBatch | null>(BATCH_KEY, null);
    },
    async setBatch(batch, auth) {
      requireAdmin(auth);
      writeLocal(BATCH_KEY, batch);
    }
  };
  return store;
}

interface Row {
  id: string;
  name: string;
  scores: Record<string, number> | null;
  pending: Record<string, string> | null;
  graduated: boolean | null;
  note: string | null;
  gender: 'L' | 'P' | null;
  scored_batch?: Record<string, string> | null;
  to_enter?: Record<string, number> | null;
}

const toAgent = (r: Row): TrainingAgent => ({
  id: r.id,
  name: r.name,
  scores: r.scores ?? {},
  pending: r.pending ?? {},
  graduated: r.graduated ?? false,
  gender: r.gender ?? null,
  ...(r.note ? { note: r.note } : {}),
  ...(r.scored_batch && Object.keys(r.scored_batch).length ? { scoredBatch: r.scored_batch } : {}),
  ...(r.to_enter && Object.keys(r.to_enter).length ? { toEnter: r.to_enter } : {})
});

const toRow = (a: Omit<TrainingAgent, 'id'>) => ({
  name: a.name,
  scores: a.scores,
  pending: a.pending,
  graduated: a.graduated ?? false,
  note: a.note ?? null,
  updated_at: new Date().toISOString()
});
/** Simpan agen yang sudah ada (ikut L/P). Impor Excel tidak menyentuh L/P. */
const toFullRow = (a: Omit<TrainingAgent, 'id'>) => ({ ...toRow(a), gender: a.gender ?? null, scored_batch: a.scoredBatch ?? {}, to_enter: a.toEnter ?? {} });

function createSupabaseStore(config: SupabaseConfig): TrainingStore {
  return {
    async list(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(
        config,
        'rest/v1/training_agents?select=id,name,scores,pending,graduated,note,gender,scored_batch,to_enter&order=created_at.asc',
        { accessToken: auth.accessToken }
      );
      return ((await res.json()) as Row[]).map(toAgent);
    },
    async add(name, auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(config, 'rest/v1/training_agents?select=id,name,scores,pending,graduated,note,gender', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(toRow({ name, scores: {}, pending: {} }))
      }).catch((err: unknown) => {
        if (/23505|duplicate/i.test(String(err) + String((err as { detail?: string }).detail ?? ''))) {
          throw new Error(`${name} sudah ada di rekap.`);
        }
        throw err;
      });
      return toAgent(((await res.json()) as Row[])[0]);
    },
    async save(agent, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/training_agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: 'PATCH',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(toFullRow(agent))
      });
    },
    async saveMany(agents, auth) {
      requireAdmin(auth);
      if (agents.length === 0) return;
      await supabaseFetch(config, 'rest/v1/training_agents?on_conflict=id', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(agents.map((a) => ({ id: a.id, ...toFullRow(a) })))
      });
    },
    async remove(id, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/training_agents?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    },
    async importMany(agents, auth) {
      requireAdmin(auth);
      if (agents.length === 0) return;
      await supabaseFetch(config, 'rest/v1/training_agents?on_conflict=name', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(agents.map(toRow))
      });
    },
    async getBatch(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(config, 'rest/v1/training_batch?select=start_date,end_date&id=eq.1', { accessToken: auth.accessToken });
      const [row] = (await res.json()) as { start_date: string; end_date: string }[];
      return row ? { start: row.start_date, end: row.end_date } : null;
    },
    async setBatch(batch, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, 'rest/v1/training_batch?on_conflict=id', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: 1, start_date: batch.start, end_date: batch.end, updated_at: new Date().toISOString() })
      });
    }
  };
}

let cached: TrainingStore | null = null;
export function getTrainingStore(): TrainingStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
