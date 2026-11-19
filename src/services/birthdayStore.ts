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
  /** Tahun lahir per kode agen (khusus admin; disimpan terpisah dari data publik). */
  listYears(auth: AdminAuth): Promise<Map<string, number>>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah data ulang tahun.');
}

const KEY = 'portal-cibubur:agent-birthdays';
const YEAR_KEY = 'portal-cibubur:agent-birth-years';

/** Data publik tanpa tahun lahir. */
const publicOf = ({ code, name, month, day }: AgentBirthday): AgentBirthday => ({ code, name, month, day });

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
      for (const e of entries) map.set(e.code, publicOf(e));
      writeLocal(KEY, [...map.values()]);
      const years = readLocal<Record<string, number>>(YEAR_KEY, {});
      for (const e of entries) if (e.year) years[e.code] = e.year;
      writeLocal(YEAR_KEY, years);
    },
    async remove(code, auth) {
      requireAdmin(auth);
      writeLocal(KEY, readAll().filter((b) => b.code !== code));
      const years = readLocal<Record<string, number>>(YEAR_KEY, {});
      delete years[code];
      writeLocal(YEAR_KEY, years);
    },
    async removeMonth(month, auth) {
      requireAdmin(auth);
      const gone = readAll().filter((b) => b.month === month).map((b) => b.code);
      writeLocal(KEY, readAll().filter((b) => b.month !== month));
      const years = readLocal<Record<string, number>>(YEAR_KEY, {});
      for (const c of gone) delete years[c];
      writeLocal(YEAR_KEY, years);
    },
    async listYears(auth) {
      requireAdmin(auth);
      return new Map(Object.entries(readLocal<Record<string, number>>(YEAR_KEY, {})));
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
      const withYear = entries.filter((e) => e.year);
      if (withYear.length) {
        await supabaseFetch(config, 'rest/v1/agent_birth_years?on_conflict=code', {
          method: 'POST',
          accessToken: auth.accessToken,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(withYear.map((e) => ({ code: e.code, birth_year: e.year })))
        });
      }
    },
    async remove(code, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/agent_birthdays?code=eq.${encodeURIComponent(code)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
      await supabaseFetch(config, `rest/v1/agent_birth_years?code=eq.${encodeURIComponent(code)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      }).catch(() => undefined);
    },
    async removeMonth(month, auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(config, `rest/v1/agent_birthdays?select=code&birth_month=eq.${month}`);
      const codes = ((await res.json()) as { code: string }[]).map((r) => r.code);
      await supabaseFetch(config, `rest/v1/agent_birthdays?birth_month=eq.${month}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
      if (codes.length) {
        await supabaseFetch(config, `rest/v1/agent_birth_years?code=in.(${codes.map(encodeURIComponent).join(',')})`, {
          method: 'DELETE',
          accessToken: auth.accessToken
        }).catch(() => undefined);
      }
    },
    async listYears(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(config, 'rest/v1/agent_birth_years?select=code,birth_year', { accessToken: auth.accessToken });
      return new Map(((await res.json()) as { code: string; birth_year: number }[]).map((r) => [r.code, r.birth_year]));
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
