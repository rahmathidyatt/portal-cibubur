import type { AdminAuth } from './bookingStore';
import { getSupabaseConfig, randomId, readLocal, supabaseFetch, writeLocal, type SupabaseConfig } from './supabaseClient';

/** Tanya-jawab yang diajarkan admin ke Minbur. */
export interface MinburFaq {
  id: string;
  /** Kata kunci dipisah koma, mis. "parkir, parkiran, motor". */
  keywords: string;
  answer: string;
  linkLabel?: string | null;
  linkUrl?: string | null;
  createdAt: string;
}

export interface MinburQuestion {
  id: string;
  question: string;
  askedAt: string;
}

export type NewMinburFaq = Pick<MinburFaq, 'keywords' | 'answer' | 'linkLabel' | 'linkUrl'>;

export interface MinburStore {
  listFaq(): Promise<MinburFaq[]>;
  saveFaq(input: NewMinburFaq & { id?: string }, auth: AdminAuth): Promise<void>;
  deleteFaq(id: string, auth: AdminAuth): Promise<void>;
  /** Dipanggil pengunjung saat Minbur belum bisa menjawab. */
  recordUnanswered(question: string): Promise<void>;
  listUnanswered(auth: AdminAuth): Promise<MinburQuestion[]>;
  deleteUnanswered(id: string, auth: AdminAuth): Promise<void>;
}

export const MINBUR_FAQ_CHANGED = 'minbur-faq-changed';

function requireAdmin(auth: AdminAuth): void {
  if (!auth.isAdmin) throw new Error('Hanya admin yang dapat mengubah pengetahuan Minbur.');
}

/** Validasi isian admin; mengembalikan pesan kesalahan atau null. */
export function validateFaq(input: NewMinburFaq): string | null {
  const keywords = input.keywords.trim();
  if (keywords.replace(/[,\s]/g, '').length < 2) return 'Isi minimal satu kata kunci.';
  if (keywords.length > 300) return 'Kata kunci terlalu panjang (maks. 300 karakter).';
  if (input.answer.trim().length < 2) return 'Jawaban wajib diisi.';
  if (input.answer.length > 1500) return 'Jawaban terlalu panjang (maks. 1500 karakter).';
  const url = (input.linkUrl ?? '').trim();
  if (url && !/^(https?:\/\/|#)/.test(url)) return 'Link harus diawali https:// atau # (halaman portal).';
  if (url && !(input.linkLabel ?? '').trim()) return 'Isi juga teks tombol untuk link.';
  return null;
}

function clean(input: NewMinburFaq) {
  const url = (input.linkUrl ?? '').trim();
  return {
    keywords: input.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .join(', '),
    answer: input.answer.trim(),
    linkLabel: url ? (input.linkLabel ?? '').trim().slice(0, 60) : null,
    linkUrl: url || null
  };
}

const FAQ_KEY = 'portal-cibubur:minbur-faq';
const Q_KEY = 'portal-cibubur:minbur-unanswered';

function createLocalStore(): MinburStore {
  const faqs = () => readLocal<MinburFaq[]>(FAQ_KEY, []);
  const questions = () => readLocal<MinburQuestion[]>(Q_KEY, []);
  return {
    async listFaq() {
      return [...faqs()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async saveFaq(input, auth) {
      requireAdmin(auth);
      const problem = validateFaq(input);
      if (problem) throw new Error(problem);
      const list = faqs();
      const data = clean(input);
      if (input.id) {
        writeLocal(FAQ_KEY, list.map((f) => (f.id === input.id ? { ...f, ...data } : f)));
      } else {
        writeLocal(FAQ_KEY, [...list, { id: randomId(), createdAt: new Date().toISOString(), ...data }]);
      }
    },
    async deleteFaq(id, auth) {
      requireAdmin(auth);
      writeLocal(FAQ_KEY, faqs().filter((f) => f.id !== id));
    },
    async recordUnanswered(question) {
      const q = question.trim().slice(0, 200);
      if (q.length < 2) return;
      const list = questions();
      if (list.some((x) => x.question.toLowerCase() === q.toLowerCase())) return;
      writeLocal(Q_KEY, [...list, { id: randomId(), question: q, askedAt: new Date().toISOString() }].slice(-300));
    },
    async listUnanswered(auth) {
      requireAdmin(auth);
      return [...questions()].sort((a, b) => b.askedAt.localeCompare(a.askedAt));
    },
    async deleteUnanswered(id, auth) {
      requireAdmin(auth);
      writeLocal(Q_KEY, questions().filter((q) => q.id !== id));
    }
  };
}

interface FaqRow {
  id: string;
  keywords: string;
  answer: string;
  link_label: string | null;
  link_url: string | null;
  created_at: string;
}

function createSupabaseStore(config: SupabaseConfig): MinburStore {
  return {
    async listFaq() {
      const res = await supabaseFetch(
        config,
        'rest/v1/minbur_faq?select=id,keywords,answer,link_label,link_url,created_at&order=created_at.desc'
      );
      const rows = (await res.json()) as FaqRow[];
      return rows.map((r) => ({
        id: r.id,
        keywords: r.keywords,
        answer: r.answer,
        linkLabel: r.link_label,
        linkUrl: r.link_url,
        createdAt: r.created_at
      }));
    },
    async saveFaq(input, auth) {
      requireAdmin(auth);
      const problem = validateFaq(input);
      if (problem) throw new Error(problem);
      const d = clean(input);
      const body = JSON.stringify({ keywords: d.keywords, answer: d.answer, link_label: d.linkLabel, link_url: d.linkUrl });
      await supabaseFetch(config, input.id ? `rest/v1/minbur_faq?id=eq.${encodeURIComponent(input.id)}` : 'rest/v1/minbur_faq', {
        method: input.id ? 'PATCH' : 'POST',
        accessToken: auth.accessToken,
        headers: { Prefer: 'return=minimal' },
        body
      });
    },
    async deleteFaq(id, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/minbur_faq?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    },
    async recordUnanswered(question) {
      await supabaseFetch(config, 'rest/v1/rpc/record_minbur_question', {
        method: 'POST',
        body: JSON.stringify({ p_question: question.slice(0, 200) })
      });
    },
    async listUnanswered(auth) {
      requireAdmin(auth);
      const res = await supabaseFetch(
        config,
        'rest/v1/minbur_unanswered?select=id,question,asked_at&order=asked_at.desc&limit=200',
        { accessToken: auth.accessToken }
      );
      const rows = (await res.json()) as { id: number; question: string; asked_at: string }[];
      return rows.map((r) => ({ id: String(r.id), question: r.question, askedAt: r.asked_at }));
    },
    async deleteUnanswered(id, auth) {
      requireAdmin(auth);
      await supabaseFetch(config, `rest/v1/minbur_unanswered?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        accessToken: auth.accessToken
      });
    }
  };
}

let cached: MinburStore | null = null;

export function getMinburStore(): MinburStore {
  if (!cached) {
    const config = getSupabaseConfig();
    cached = config ? createSupabaseStore(config) : createLocalStore();
  }
  return cached;
}
