import type { AdminAuth } from '../../services/bookingStore';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  SupabaseRequestError,
  writeLocal,
  type SupabaseConfig
} from '../../services/supabaseClient';
import type { ScheduleData } from './engine';
import {
  isRequestOpen,
  validateChangeRequest,
  type ChangeRequest,
  type ChangeRequestStatus,
  type NewChangeRequest,
  type PublishedSchedule
} from './requests';

/**
 * Penyimpanan jadwal Floor Time yang diterbitkan beserta request perubahan.
 * Supabase bila tersambung, localStorage bila mode demo.
 */
export interface ScheduleStore {
  /** Jadwal terbit untuk bulan tertentu (null bila belum ada). */
  getSchedule(year: number, month: number): Promise<PublishedSchedule | null>;
  /** Daftar bulan yang sudah terbit, terbaru dulu. */
  listSchedules(): Promise<{ id: string; year: number; month: number; requestDeadline: string }[]>;
  publish(data: ScheduleData, requestDeadline: string, auth: AdminAuth): Promise<void>;
  updateSchedule(id: string, patch: { data?: ScheduleData; requestDeadline?: string }, auth: AdminAuth): Promise<void>;
  deleteSchedule(id: string, auth: AdminAuth): Promise<void>;
  listRequests(scheduleId: string, auth: AdminAuth): Promise<ChangeRequest[]>;
  submitRequest(schedule: PublishedSchedule, input: NewChangeRequest): Promise<void>;
  setRequestStatus(id: string, status: ChangeRequestStatus, auth: AdminAuth): Promise<void>;
}

function requireAdmin(auth: AdminAuth) {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah jadwal.');
}

/* ----------------------------- localStorage ----------------------------- */

const SCHEDULE_KEY = 'portal-cibubur:floortime-schedules';
const REQUEST_KEY = 'portal-cibubur:floortime-change-requests';

function readSchedules(): PublishedSchedule[] {
  const list = readLocal<PublishedSchedule[]>(SCHEDULE_KEY, []);
  return Array.isArray(list) ? list : [];
}
function readRequests(): ChangeRequest[] {
  const list = readLocal<ChangeRequest[]>(REQUEST_KEY, []);
  return Array.isArray(list) ? list : [];
}

function createLocalStore(): ScheduleStore {
  return {
    async getSchedule(year, month) {
      return readSchedules().find((s) => s.data.year === year && s.data.month === month) ?? null;
    },
    async listSchedules() {
      return readSchedules()
        .map((s) => ({ id: s.id, year: s.data.year, month: s.data.month, requestDeadline: s.requestDeadline }))
        .sort((a, b) => b.year - a.year || b.month - a.month);
    },
    async publish(data, requestDeadline, auth) {
      requireAdmin(auth);
      const list = readSchedules();
      const existing = list.find((s) => s.data.year === data.year && s.data.month === data.month);
      const next: PublishedSchedule = {
        id: existing?.id ?? randomId(),
        publishedAt: new Date().toISOString(),
        requestDeadline,
        data
      };
      writeLocal(SCHEDULE_KEY, [...list.filter((s) => s.id !== next.id), next]);
    },
    async updateSchedule(id, patch, auth) {
      requireAdmin(auth);
      writeLocal(
        SCHEDULE_KEY,
        readSchedules().map((s) =>
          s.id === id
            ? { ...s, data: patch.data ?? s.data, requestDeadline: patch.requestDeadline ?? s.requestDeadline }
            : s
        )
      );
    },
    async deleteSchedule(id, auth) {
      requireAdmin(auth);
      writeLocal(SCHEDULE_KEY, readSchedules().filter((s) => s.id !== id));
      writeLocal(REQUEST_KEY, readRequests().filter((r) => r.scheduleId !== id));
    },
    async listRequests(scheduleId, auth) {
      return readRequests()
        .filter((r) => r.scheduleId === scheduleId)
        .map((r) => (auth.isAdmin ? r : { ...r, reason: '' }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async submitRequest(schedule, input) {
      if (!isRequestOpen(schedule.requestDeadline)) throw new Error('Batas waktu request sudah lewat.');
      const error = validateChangeRequest(schedule.data, input);
      if (error) throw new Error(error);
      const all = readRequests();
      if (
        all.some(
          (r) =>
            r.scheduleId === schedule.id &&
            r.agentId === input.agentId &&
            r.toSlot === input.toSlot &&
            r.status === 'pending'
        )
      ) {
        throw new Error('Request yang sama masih menunggu keputusan admin.');
      }
      const agent = schedule.data.agents.find((a) => a.id === input.agentId)!;
      all.push({
        id: randomId(),
        scheduleId: schedule.id,
        agentId: input.agentId,
        agentName: agent.code ? `${agent.name} (${agent.code})` : agent.name,
        fromSlot: input.fromSlot,
        toSlot: input.toSlot,
        reason: input.reason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        decidedAt: null
      });
      writeLocal(REQUEST_KEY, all);
    },
    async setRequestStatus(id, status, auth) {
      requireAdmin(auth);
      writeLocal(
        REQUEST_KEY,
        readRequests().map((r) => (r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r))
      );
    }
  };
}

/* ------------------------------- Supabase ------------------------------- */

interface ScheduleRow {
  id: string;
  year: number;
  month: number;
  data: ScheduleData;
  request_deadline: string;
  published_at: string;
}

interface RequestRow {
  id: string;
  schedule_id: string;
  agent_id: string;
  agent_name: string;
  from_slot: string | null;
  to_slot: string;
  reason?: string;
  status: ChangeRequestStatus;
  created_at: string;
  decided_at: string | null;
}

function toSchedule(r: ScheduleRow): PublishedSchedule {
  return { id: r.id, publishedAt: r.published_at, requestDeadline: r.request_deadline, data: r.data };
}

function translate(err: unknown): never {
  if (err instanceof SupabaseRequestError) {
    const match = err.detail.match(/"message"\s*:\s*"([^"]+)"/);
    if (match && /Batas|Jadwal|Agen|Slot|Request|sudah/.test(match[1])) throw new Error(match[1]);
  }
  throw err;
}

function createSupabaseStore(config: SupabaseConfig): ScheduleStore {
  const cols = 'id,year,month,data,request_deadline,published_at';
  return {
    async getSchedule(year, month) {
      const res = await supabaseFetch(
        config,
        `rest/v1/floortime_schedules?select=${cols}&year=eq.${year}&month=eq.${month}&limit=1`
      );
      const rows = (await res.json()) as ScheduleRow[];
      return rows[0] ? toSchedule(rows[0]) : null;
    },
    async listSchedules() {
      const res = await supabaseFetch(
        config,
        'rest/v1/floortime_schedules?select=id,year,month,request_deadline&order=year.desc,month.desc'
      );
      const rows = (await res.json()) as Omit<ScheduleRow, 'data' | 'published_at'>[];
      return rows.map((r) => ({ id: r.id, year: r.year, month: r.month, requestDeadline: r.request_deadline }));
    },
    async publish(data, requestDeadline, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, 'rest/v1/floortime_schedules?on_conflict=year,month', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          year: data.year,
          month: data.month,
          data,
          request_deadline: requestDeadline,
          published_at: new Date().toISOString()
        })
      });
    },
    async updateSchedule(id, patch, auth) {
      requireAdmin(auth);
      const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.data) body.data = patch.data;
      if (patch.requestDeadline) body.request_deadline = patch.requestDeadline;
      await supabaseFetch(config, `rest/v1/floortime_schedules?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      });
    },
    async deleteSchedule(id, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/floortime_schedules?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    },
    async listRequests(scheduleId, auth) {
      const fields = `id,schedule_id,agent_id,agent_name,from_slot,to_slot,status,created_at,decided_at${auth.isAdmin ? ',reason' : ''}`;
      const res = await supabaseFetch(
        config,
        `rest/v1/floortime_change_requests?select=${fields}&schedule_id=eq.${encodeURIComponent(scheduleId)}&order=created_at.desc`,
        { accessToken: auth.accessToken }
      );
      const rows = (await res.json()) as RequestRow[];
      return rows.map((r) => ({
        id: r.id,
        scheduleId: r.schedule_id,
        agentId: r.agent_id,
        agentName: r.agent_name,
        fromSlot: r.from_slot,
        toSlot: r.to_slot,
        reason: r.reason ?? '',
        status: r.status,
        createdAt: r.created_at,
        decidedAt: r.decided_at
      }));
    },
    async submitRequest(schedule, input) {
      const error = validateChangeRequest(schedule.data, input);
      if (error) throw new Error(error);
      try {
        await supabaseFetch(config, 'rest/v1/rpc/submit_floortime_request', {
          method: 'POST',
          body: JSON.stringify({
            p_schedule_id: schedule.id,
            p_agent_id: input.agentId,
            p_from_slot: input.fromSlot,
            p_to_slot: input.toSlot,
            p_reason: input.reason.trim()
          })
        });
      } catch (err) {
        translate(err);
      }
    },
    async setRequestStatus(id, status, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/floortime_change_requests?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status, decided_at: new Date().toISOString() })
      });
    }
  };
}

let cached: ScheduleStore | null = null;

export function getScheduleStore(): ScheduleStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
