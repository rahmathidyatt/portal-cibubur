import type { AdminAuth } from '../../services/bookingStore';
import { getSupabaseConfig, randomId, readLocal, supabaseFetch, writeLocal, type SupabaseConfig } from '../../services/supabaseClient';
import { nextOccurrence, trainingSchedules, type BcDraft, type BcSchedule, type BcStatus, type BcTarget } from './bc';

export interface BcStore {
  list(auth: AdminAuth): Promise<BcSchedule[]>;
  create(draft: BcDraft, auth: AdminAuth): Promise<void>;
  update(id: string, patch: Partial<BcDraft> & { status?: BcStatus }, auth: AdminAuth): Promise<void>;
  /** Tandai terkirim: BC sekali kirim selesai, BC berulang maju ke jadwal berikutnya. */
  markSent(s: BcSchedule, auth: AdminAuth): Promise<void>;
  /** Buat BC training otomatis untuk batch (yang sudah ada tidak diubah). */
  syncTraining(batchStart: string, auth: AdminAuth): Promise<void>;
  listTargets(auth: AdminAuth): Promise<BcTarget[]>;
  addTarget(t: Omit<BcTarget, 'id'>, auth: AdminAuth): Promise<void>;
  removeTarget(id: string, auth: AdminAuth): Promise<void>;
  savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, auth: AdminAuth): Promise<void>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('BC terjadwal khusus admin.');
}

function sentPatch(s: BcSchedule, now: Date): { status: BcStatus; nextAt: string; lastSentAt: string } {
  const next = nextOccurrence(s.nextAt, s.repeat, now);
  return { status: next ? 'active' : 'done', nextAt: next ?? s.nextAt, lastSentAt: now.toISOString() };
}

/* ------------------------------------------------------------- lokal (demo) */

const KEY = 'portal-cibubur:bc-schedules';
const TARGETS_KEY = 'portal-cibubur:bc-targets';

function createLocalStore(): BcStore {
  const all = () => readLocal<BcSchedule[]>(KEY, []);
  const targets = () => readLocal<BcTarget[]>(TARGETS_KEY, []);
  const save = (list: BcSchedule[]) => writeLocal(KEY, list);
  return {
    async list(auth) {
      requireAdmin(auth);
      return all();
    },
    async create(d, auth) {
      requireAdmin(auth);
      save([
        ...all(),
        { id: randomId(), ...d, title: d.title.trim(), kind: 'manual', status: 'active', sourceKey: null, lastSentAt: null }
      ]);
    },
    async update(id, patch, auth) {
      requireAdmin(auth);
      save(all().map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    async markSent(s, auth) {
      requireAdmin(auth);
      const p = sentPatch(s, new Date());
      save(all().map((x) => (x.id === s.id ? { ...x, ...p } : x)));
    },
    async syncTraining(batchStart, auth) {
      requireAdmin(auth);
      const list = all();
      const now = new Date();
      const add = trainingSchedules(batchStart)
        .filter((t) => new Date(t.nextAt) > now && !list.some((s) => s.sourceKey === t.sourceKey))
        .map(
          (t): BcSchedule => ({
            id: randomId(),
            title: t.title,
            message: '',
            kind: t.kind,
            targetId: null,
            nextAt: t.nextAt,
            repeat: 'none',
            status: 'active',
            sourceKey: t.sourceKey,
            lastSentAt: null
          })
        );
      if (add.length) save([...list, ...add]);
    },
    async listTargets(auth) {
      requireAdmin(auth);
      return targets();
    },
    async addTarget(t, auth) {
      requireAdmin(auth);
      if (targets().some((x) => x.name.toLowerCase() === t.name.trim().toLowerCase())) throw new Error('Nama tujuan itu sudah ada.');
      writeLocal(TARGETS_KEY, [...targets(), { id: randomId(), name: t.name.trim(), phone: t.phone }]);
    },
    async removeTarget(id, auth) {
      requireAdmin(auth);
      writeLocal(TARGETS_KEY, targets().filter((t) => t.id !== id));
      save(all().map((s) => (s.targetId === id ? { ...s, targetId: null } : s)));
    },
    async savePushSubscription() {
      throw new Error('Notifikasi hanya aktif di portal online.');
    }
  };
}

/* ---------------------------------------------------------------- Supabase */

interface Row {
  id: string;
  title: string;
  message: string;
  kind: BcSchedule['kind'];
  target_id: string | null;
  next_at: string;
  repeat: BcSchedule['repeat'];
  status: BcStatus;
  source_key: string | null;
  last_sent_at: string | null;
}

const fromRow = (r: Row): BcSchedule => ({
  id: r.id,
  title: r.title,
  message: r.message,
  kind: r.kind,
  targetId: r.target_id,
  nextAt: r.next_at,
  repeat: r.repeat,
  status: r.status,
  sourceKey: r.source_key,
  lastSentAt: r.last_sent_at
});

function createSupabaseStore(config: SupabaseConfig): BcStore {
  const call = (path: string, auth: AdminAuth, init: RequestInit = {}) =>
    supabaseFetch(config, path, { ...init, accessToken: auth.accessToken });
  const patch = (id: string, body: Record<string, unknown>, auth: AdminAuth) =>
    call(`rest/v1/bc_schedules?id=eq.${encodeURIComponent(id)}`, auth, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() })
    });
  return {
    async list(auth) {
      requireAdmin(auth);
      const res = await call(
        'rest/v1/bc_schedules?select=id,title,message,kind,target_id,next_at,repeat,status,source_key,last_sent_at&status=neq.cancelled&order=next_at.asc&limit=500',
        auth
      );
      return ((await res.json()) as Row[]).map(fromRow);
    },
    async create(d, auth) {
      requireAdmin(auth);
      await call('rest/v1/bc_schedules', auth, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ title: d.title.trim(), message: d.message, target_id: d.targetId, next_at: d.nextAt, repeat: d.repeat })
      });
    },
    async update(id, p, auth) {
      requireAdmin(auth);
      const body: Record<string, unknown> = {};
      if (p.title !== undefined) body.title = p.title.trim();
      if (p.message !== undefined) body.message = p.message;
      if (p.targetId !== undefined) body.target_id = p.targetId;
      if (p.nextAt !== undefined) {
        body.next_at = p.nextAt;
        body.notified_at = null; // waktu diganti → beri tahu lagi saat waktunya
      }
      if (p.repeat !== undefined) body.repeat = p.repeat;
      if (p.status !== undefined) body.status = p.status;
      await patch(id, body, auth);
    },
    async markSent(s, auth) {
      requireAdmin(auth);
      const p = sentPatch(s, new Date());
      await patch(s.id, { status: p.status, next_at: p.nextAt, last_sent_at: p.lastSentAt, notified_at: p.status === 'active' ? null : undefined }, auth);
    },
    async syncTraining(batchStart, auth) {
      requireAdmin(auth);
      const now = new Date();
      const rows = trainingSchedules(batchStart)
        .filter((t) => new Date(t.nextAt) > now)
        .map((t) => ({ title: t.title, kind: t.kind, next_at: t.nextAt, source_key: t.sourceKey }));
      if (rows.length === 0) return;
      await call('rest/v1/bc_schedules?on_conflict=source_key', auth, {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(rows)
      });
    },
    async listTargets(auth) {
      requireAdmin(auth);
      const res = await call('rest/v1/bc_targets?select=id,name,phone&order=name.asc', auth);
      return (await res.json()) as BcTarget[];
    },
    async addTarget(t, auth) {
      requireAdmin(auth);
      await call('rest/v1/bc_targets', auth, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ name: t.name.trim(), phone: t.phone || null })
      });
    },
    async removeTarget(id, auth) {
      requireAdmin(auth);
      await call(`rest/v1/bc_targets?id=eq.${encodeURIComponent(id)}`, auth, { method: 'DELETE' });
    },
    async savePushSubscription(sub, auth) {
      requireAdmin(auth);
      await call('rest/v1/push_subscriptions?on_conflict=endpoint', auth, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(sub)
      });
    }
  };
}

let cached: BcStore | null = null;

export function getBcStore(): BcStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
