import type { AdminAuth } from './bookingStore';
import { compareBirthday, type AgentBirthday } from '../features/birthdays/birthdays';
import { getSupabaseConfig, readLocal, supabaseFetch, writeLocal, type SupabaseConfig } from './supabaseClient';

/** Data ulang tahun agen: dibaca semua orang (pengingat beranda), diubah hanya oleh admin. */
export interface BirthdayStore {
  list(): Promise<AgentBirthday[]>;
  /** Tambah atau perbarui berdasarkan kode agen. */
  upsert(entries: AgentBirthday[], auth: AdminAuth): Promise<void>;
  remove(code: string, auth: AdminAuth): Promise<void>;
  removeMonth(month: number, auth: AdminAuth): Promise<void>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah data ulang tahun.');
}

const KEY = 'portal-cibubur:agent-birthdays';

function readAll(): AgentBirthday[] {
  const list = readLocal<AgentBirthday[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

function createLocalStore(): BirthdayStore {
  return {
    async list() {
      return readAll().sort(compareBirthday);
    },
    async upsert(entries, auth) {
      requireAdmin(auth);
      const map = new Map(readAll().map((b) => [b.code, b]));
      for (const e of entries) map.set(e.code, e);
      writeLocal(KEY, [...map.values()]);
    },
    async remove(code, auth) {
      requireAdmin(auth);
      writeLocal(KEY, readAll().filter((b) => b.code !== code));
    },
    async removeMonth(month, auth) {
      requireAdmin(auth);
      writeLocal(KEY, readAll().filter((b) => b.month !== month));
    }
  };
}

interface Row {
  code: string;
  name: string;
  birth_month: number;
  birth_day: number;
}

function createSupabaseStore(config: SupabaseConfig): BirthdayStore {
  return {
    async list() {
      const res = await supabaseFetch(
        config,
        'rest/v1/agent_birthdays?select=code,name,birth_month,birth_day&order=birth_month.asc,birth_day.asc,name.asc'
      );
      const rows = (await res.json()) as Row[];
      return rows.map((r) => ({ code: r.code, name: r.name, month: r.birth_month, day: r.birth_day }));
    },
    async upsert(entries, auth) {
      requireAdmin(auth);
      if (entries.length === 0) return;
      await supabaseFetch(config, 'rest/v1/agent_birthdays?on_conflict=code', {
        method: 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(
          entries.map((e) => ({ code: e.code, name: e.name, birth_month: e.month, birth_day: e.day }))
        )
      });
    },
    async remove(code, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/agent_birthdays?code=eq.${encodeURIComponent(code)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    },
    async removeMonth(month, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/agent_birthdays?birth_month=eq.${month}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    }
  };
}

let cached: BirthdayStore | null = null;

export function getBirthdayStore(): BirthdayStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
