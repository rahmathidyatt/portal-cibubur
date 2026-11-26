import type { AdminAuth } from '../../services/bookingStore';
import {
  getSupabaseConfig,
  randomId,
  readLocal,
  supabaseFetch,
  writeLocal,
  type SupabaseConfig
} from '../../services/supabaseClient';
import { normalizeInvoice, type MedproDrop, type MedproNota } from './medpro';

/** Nota medpro & drop banner (khusus admin). */
export interface MedproStore {
  listNotas(auth: AdminAuth): Promise<MedproNota[]>;
  addNota(nota: Omit<MedproNota, 'id'>, auth: AdminAuth): Promise<void>;
  updateNota(id: string, patch: Partial<Omit<MedproNota, 'id'>>, auth: AdminAuth): Promise<void>;
  removeNota(id: string, auth: AdminAuth): Promise<void>;
  /** Tandai beberapa nota sudah dibayar (atau batalkan dengan paidOn null). */
  setNotasPaid(ids: string[], paidOn: string | null, auth: AdminAuth): Promise<void>;
  importNotas(notas: Omit<MedproNota, 'id'>[], auth: AdminAuth): Promise<number>;

  listDrops(auth: AdminAuth): Promise<MedproDrop[]>;
  addDrop(drop: Omit<MedproDrop, 'id'>, auth: AdminAuth): Promise<void>;
  updateDrop(id: string, patch: Partial<Omit<MedproDrop, 'id'>>, auth: AdminAuth): Promise<void>;
  removeDrop(id: string, auth: AdminAuth): Promise<void>;
  setDropsPaid(ids: string[], paidOn: string | null, auth: AdminAuth): Promise<void>;
  importDrops(drops: Omit<MedproDrop, 'id'>[], auth: AdminAuth): Promise<number>;
}

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat membuka nota medpro.');
}

const DUPLICATE = (invoice: string) => new Error(`Nomor INVOICE ${invoice} sudah tercatat.`);

/* ------------------------------ lokal ------------------------------ */

const NOTA_KEY = 'portal-cibubur:medpro-notas';
const DROP_KEY = 'portal-cibubur:medpro-drops';

function readList<T>(key: string): T[] {
  const list = readLocal<T[]>(key, []);
  return Array.isArray(list) ? list : [];
}

function createLocalStore(): MedproStore {
  const notas = () => readList<MedproNota>(NOTA_KEY);
  const drops = () => readList<MedproDrop>(DROP_KEY);
  return {
    async listNotas(auth) {
      requireAdmin(auth);
      return notas();
    },
    async addNota(nota, auth) {
      requireAdmin(auth);
      const inv = normalizeInvoice(nota.invoice);
      if (notas().some((n) => n.invoice === inv)) throw DUPLICATE(inv);
      writeLocal(NOTA_KEY, [...notas(), { ...nota, invoice: inv, id: randomId() }]);
    },
    async updateNota(id, patch, auth) {
      requireAdmin(auth);
      if (patch.invoice) {
        const inv = normalizeInvoice(patch.invoice);
        if (notas().some((n) => n.invoice === inv && n.id !== id)) throw DUPLICATE(inv);
        patch = { ...patch, invoice: inv };
      }
      writeLocal(NOTA_KEY, notas().map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },
    async removeNota(id, auth) {
      requireAdmin(auth);
      writeLocal(NOTA_KEY, notas().filter((n) => n.id !== id));
    },
    async setNotasPaid(ids, paidOn, auth) {
      requireAdmin(auth);
      const set = new Set(ids);
      writeLocal(NOTA_KEY, notas().map((n) => (set.has(n.id) ? { ...n, paidOn } : n)));
    },
    async importNotas(list, auth) {
      requireAdmin(auth);
      const all = notas();
      const known = new Set(all.map((n) => n.invoice));
      const fresh = list.filter((n) => !known.has(n.invoice)).map((n) => ({ ...n, id: randomId() }));
      writeLocal(NOTA_KEY, [...all, ...fresh]);
      return fresh.length;
    },
    async listDrops(auth) {
      requireAdmin(auth);
      return drops();
    },
    async addDrop(drop, auth) {
      requireAdmin(auth);
      writeLocal(DROP_KEY, [...drops(), { ...drop, id: randomId() }]);
    },
    async updateDrop(id, patch, auth) {
      requireAdmin(auth);
      writeLocal(DROP_KEY, drops().map((d) => (d.id === id ? { ...d, ...patch } : d)));
    },
    async removeDrop(id, auth) {
      requireAdmin(auth);
      writeLocal(DROP_KEY, drops().filter((d) => d.id !== id));
    },
    async setDropsPaid(ids, paidOn, auth) {
      requireAdmin(auth);
      const set = new Set(ids);
      writeLocal(DROP_KEY, drops().map((d) => (set.has(d.id) ? { ...d, paidOn } : d)));
    },
    async importDrops(list, auth) {
      requireAdmin(auth);
      const all = drops();
      const key = (d: Omit<MedproDrop, 'id'>) => `${d.notaNo}|${d.date}`;
      const known = new Set(all.map(key));
      const fresh = list.filter((d) => !known.has(key(d))).map((d) => ({ ...d, id: randomId() }));
      writeLocal(DROP_KEY, [...all, ...fresh]);
      return fresh.length;
    }
  };
}

/* ------------------------------ Supabase ------------------------------ */

interface NotaRow {
  id: string;
  nota_date: string;
  invoice: string;
  banner: number;
  branding: number;
  checked: boolean;
  paid_on: string | null;
  note: string | null;
  items?: MedproNota['items'] | null;
}

interface DropRow {
  id: string;
  drop_date: string;
  office: string;
  nota_no: string;
  amount: number;
  checked: boolean;
  paid_on: string | null;
  note: string | null;
}

const toNota = (r: NotaRow): MedproNota => ({
  id: r.id,
  date: r.nota_date,
  invoice: r.invoice,
  banner: r.banner,
  branding: r.branding,
  checked: r.checked,
  paidOn: r.paid_on,
  ...(r.note ? { note: r.note } : {}),
  ...(r.items?.length ? { items: r.items } : {})
});

function notaRow(n: Partial<Omit<MedproNota, 'id'>>): Partial<Omit<NotaRow, 'id'>> {
  const row: Partial<Omit<NotaRow, 'id'>> = {};
  if (n.date !== undefined) row.nota_date = n.date;
  if (n.invoice !== undefined) row.invoice = normalizeInvoice(n.invoice);
  if (n.banner !== undefined) row.banner = n.banner;
  if (n.branding !== undefined) row.branding = n.branding;
  if (n.checked !== undefined) row.checked = n.checked;
  if (n.paidOn !== undefined) row.paid_on = n.paidOn;
  if (n.note !== undefined) row.note = n.note || null;
  if (n.items !== undefined) row.items = n.items.length ? n.items : null;
  return row;
}

/** Baris lengkap untuk impor massal: PostgREST menolak (400) jika kunci tiap baris berbeda. */
function fullNotaRow(n: Omit<MedproNota, 'id'>) {
  return {
    nota_date: n.date,
    invoice: normalizeInvoice(n.invoice),
    banner: Math.max(0, Math.round(n.banner || 0)),
    branding: Math.max(0, Math.round(n.branding || 0)),
    checked: !!n.checked,
    paid_on: n.paidOn ?? null,
    note: n.note ? n.note.slice(0, 200) : null
  };
}

function fullDropRow(d: Omit<MedproDrop, 'id'>) {
  return {
    drop_date: d.date,
    office: d.office.slice(0, 60),
    nota_no: d.notaNo.slice(0, 60),
    amount: Math.max(0, Math.round(d.amount || 0)),
    checked: !!d.checked,
    paid_on: d.paidOn ?? null,
    note: d.note ? d.note.slice(0, 200) : null
  };
}

const toDrop = (r: DropRow): MedproDrop => ({
  id: r.id,
  date: r.drop_date,
  office: r.office,
  notaNo: r.nota_no,
  amount: r.amount,
  checked: r.checked,
  paidOn: r.paid_on,
  ...(r.note ? { note: r.note } : {})
});

function dropRow(d: Partial<Omit<MedproDrop, 'id'>>): Partial<Omit<DropRow, 'id'>> {
  const row: Partial<Omit<DropRow, 'id'>> = {};
  if (d.date !== undefined) row.drop_date = d.date;
  if (d.office !== undefined) row.office = d.office;
  if (d.notaNo !== undefined) row.nota_no = normalizeInvoice(d.notaNo);
  if (d.amount !== undefined) row.amount = d.amount;
  if (d.checked !== undefined) row.checked = d.checked;
  if (d.paidOn !== undefined) row.paid_on = d.paidOn;
  if (d.note !== undefined) row.note = d.note || null;
  return row;
}

function idsFilter(ids: string[]): string {
  return `id=in.(${ids.map((i) => encodeURIComponent(i)).join(',')})`;
}

function createSupabaseStore(config: SupabaseConfig): MedproStore {
  const send = (path: string, method: string, auth: AdminAuth, body?: unknown, prefer = 'return=minimal') =>
    supabaseFetch(config, path, {
      method,
      accessToken: auth.accessToken,
      headers: { Prefer: prefer },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  const dup = (invoice: string) => (err: unknown) => {
    if (/23505|duplicate/i.test(String(err) + String((err as { detail?: string }).detail ?? ''))) throw DUPLICATE(invoice);
    throw err;
  };
  return {
    async listNotas(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(
        config,
        'rest/v1/medpro_notas?select=id,nota_date,invoice,banner,branding,checked,paid_on,note,items&order=nota_date.asc,created_at.asc',
        { accessToken: auth.accessToken }
      );
      return ((await res.json()) as NotaRow[]).map(toNota);
    },
    async addNota(nota, auth) {
      requireAdmin(auth);
      await send('rest/v1/medpro_notas', 'POST', auth, notaRow(nota)).catch(dup(normalizeInvoice(nota.invoice)));
    },
    async updateNota(id, patch, auth) {
      requireAdmin(auth);
      await send(`rest/v1/medpro_notas?id=eq.${encodeURIComponent(id)}`, 'PATCH', auth, notaRow(patch)).catch(
        dup(normalizeInvoice(patch.invoice ?? ''))
      );
    },
    async removeNota(id, auth) {
      requireAdmin(auth);
      await send(`rest/v1/medpro_notas?id=eq.${encodeURIComponent(id)}`, 'DELETE', auth);
    },
    async setNotasPaid(ids, paidOn, auth) {
      requireAdmin(auth);
      if (ids.length) await send(`rest/v1/medpro_notas?${idsFilter(ids)}`, 'PATCH', auth, { paid_on: paidOn });
    },
    async importNotas(list, auth) {
      requireAdmin(auth);
      if (list.length === 0) return 0;
      const res = await send(
        'rest/v1/medpro_notas?on_conflict=invoice&select=id',
        'POST',
        auth,
        list.map(fullNotaRow).filter((r) => r.invoice.length >= 5 && r.invoice.length <= 60),
        'resolution=ignore-duplicates,return=representation'
      );
      return ((await res.json()) as unknown[]).length;
    },
    async listDrops(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(
        config,
        'rest/v1/medpro_drops?select=id,drop_date,office,nota_no,amount,checked,paid_on,note&order=drop_date.asc,created_at.asc',
        { accessToken: auth.accessToken }
      );
      return ((await res.json()) as DropRow[]).map(toDrop);
    },
    async addDrop(drop, auth) {
      requireAdmin(auth);
      await send('rest/v1/medpro_drops', 'POST', auth, dropRow(drop));
    },
    async updateDrop(id, patch, auth) {
      requireAdmin(auth);
      await send(`rest/v1/medpro_drops?id=eq.${encodeURIComponent(id)}`, 'PATCH', auth, dropRow(patch));
    },
    async removeDrop(id, auth) {
      requireAdmin(auth);
      await send(`rest/v1/medpro_drops?id=eq.${encodeURIComponent(id)}`, 'DELETE', auth);
    },
    async setDropsPaid(ids, paidOn, auth) {
      requireAdmin(auth);
      if (ids.length) await send(`rest/v1/medpro_drops?${idsFilter(ids)}`, 'PATCH', auth, { paid_on: paidOn });
    },
    async importDrops(list, auth) {
      requireAdmin(auth);
      if (list.length === 0) return 0;
      const res = await send(
        'rest/v1/medpro_drops?on_conflict=nota_no,drop_date&select=id',
        'POST',
        auth,
        list.map(fullDropRow).filter((r) => r.office && r.nota_no),
        'resolution=ignore-duplicates,return=representation'
      );
      return ((await res.json()) as unknown[]).length;
    }
  };
}

let cached: MedproStore | null = null;
export function getMedproStore(): MedproStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
