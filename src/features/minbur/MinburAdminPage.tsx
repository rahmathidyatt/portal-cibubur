import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Plus } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import {
  getMinburStore,
  MINBUR_FAQ_CHANGED,
  validateFaq,
  type MinburFaq,
  type MinburQuestion
} from '../../services/minburStore';
import { detectIntent, matchTaughtFaq, normalize } from './minburFaq';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'bg-white border border-slate-200 rounded-2xl p-5 sm:p-6';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';

const STOPWORDS = new Set(
  'yang untuk dengan dari pada saya kami kita apakah bagaimana gimana dimana kapan berapa siapa ini itu ada bisa mau minta tolong dong kak min mas mbak juga atau dan di ke'.split(' ')
);

/** Saran kata kunci dari pertanyaan pengunjung (kata yang cukup bermakna). */
export function suggestKeywords(question: string): string {
  return normalize(question)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 3)
    .join(', ');
}

const EMPTY = { keywords: '', answer: '', linkLabel: '', linkUrl: '' };

function formatWib(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

/** Menu admin: mengajari Minbur tanya-jawab baru & meninjau pertanyaan yang belum terjawab. */
export const MinburAdminPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getMinburStore();
  const [faqs, setFaqs] = useState<MinburFaq[]>([]);
  const [questions, setQuestions] = useState<MinburQuestion[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [fromQuestion, setFromQuestion] = useState<MinburQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    try {
      const [f, q] = await Promise.all([store.listFaq(), store.listUnanswered(auth)]);
      setFaqs(f);
      setQuestions(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data Minbur.');
    }
  }, [store, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY);
    setEditId(null);
    setFromQuestion(null);
    setError(null);
  };

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 300);
  };

  const teach = (q: MinburQuestion) => {
    setEditId(null);
    setFromQuestion(q);
    setForm({ ...EMPTY, keywords: suggestKeywords(q.question) });
    setError(null);
    focusForm();
  };

  const edit = (f: MinburFaq) => {
    setEditId(f.id);
    setFromQuestion(null);
    setForm({ keywords: f.keywords, answer: f.answer, linkLabel: f.linkLabel ?? '', linkUrl: f.linkUrl ?? '' });
    setError(null);
    focusForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateFaq(form);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await store.saveFaq({ ...form, id: editId ?? undefined }, auth);
      if (fromQuestion) await store.deleteUnanswered(fromQuestion.id, auth).catch(() => undefined);
      window.dispatchEvent(new Event(MINBUR_FAQ_CHANGED));
      toast(editId ? 'Jawaban Minbur diperbarui.' : 'Minbur sudah belajar jawaban baru.');
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const probeResult = (() => {
    if (!probe.trim()) return null;
    const taught = matchTaughtFaq(probe, faqs);
    if (taught) return { ok: true, text: `Dijawab dari ajaran admin (kata kunci: ${taught.keywords}).` };
    const intent = detectIntent(probe);
    if (intent) return { ok: true, text: `Dijawab otomatis dari data portal (topik: ${intent}).` };
    return { ok: false, text: 'Belum bisa dijawab — ajari Minbur lewat formulir di atas.' };
  })();

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Konten portal</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950">
          <MessageCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
          Minbur
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ajari Minbur menjawab pertanyaan tim. Jawaban ajaran admin diutamakan di atas jawaban otomatis dari data portal.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <form ref={formRef} onSubmit={submit} className={`${card} scroll-mt-24 space-y-3`}>
              <h2 className="text-base font-bold text-slate-950">{editId ? 'Ubah jawaban' : 'Ajari jawaban baru'}</h2>
              {fromQuestion && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  Menjawab pertanyaan: “{fromQuestion.question}”
                </p>
              )}
              <label className="block text-xs font-semibold text-slate-700">
                Kata kunci
                <input
                  className={`${input} mt-1`}
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="parkir, parkiran, parkir motor"
                  aria-label="Kata kunci"
                />
                <span className="mt-1 block font-normal text-slate-500">
                  Pisahkan dengan koma. Satu kata kunci boleh beberapa kata — Minbur menjawab jika semua katanya ada di pertanyaan.
                </span>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Jawaban
                <textarea
                  className={`${input} mt-1 min-h-28`}
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  placeholder="Parkir mobil tersedia di depan kantor; motor di sisi kanan gedung."
                  aria-label="Jawaban"
                  maxLength={1500}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Teks tombol (opsional)
                  <input
                    className={`${input} mt-1`}
                    value={form.linkLabel}
                    onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                    placeholder="Buka formulir"
                    aria-label="Teks tombol"
                    maxLength={60}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Link (opsional)
                  <input
                    className={`${input} mt-1`}
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    placeholder="https://… atau #floortime"
                    aria-label="Link"
                  />
                </label>
              </div>
              {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
              <div className="flex justify-end gap-2">
                {(editId || fromQuestion || form.keywords || form.answer) && (
                  <button type="button" onClick={resetForm} className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
                    Batal
                  </button>
                )}
                <button type="submit" disabled={busy} className={primaryBtn}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {editId ? 'Simpan perubahan' : 'Simpan jawaban'}
                </button>
              </div>
            </form>

            <div className={card}>
              <h2 className="text-base font-bold text-slate-950">Uji pertanyaan</h2>
              <input
                className={`${input} mt-3`}
                value={probe}
                onChange={(e) => setProbe(e.target.value)}
                placeholder="Ketik pertanyaan, mis. di mana parkir motor?"
                aria-label="Uji pertanyaan"
              />
              {probeResult && (
                <p className={`mt-2 text-xs font-semibold ${probeResult.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{probeResult.text}</p>
              )}
            </div>

            <div className={card}>
              <h2 className="text-base font-bold text-slate-950">Pengetahuan Minbur ({faqs.length})</h2>
              {faqs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Belum ada jawaban ajaran admin.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {faqs.map((f) => (
                    <li key={f.id} className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {f.keywords.split(',').map((k) => (
                          <span key={k} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                            {k.trim()}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800">{f.answer}</p>
                      {f.linkUrl && (
                        <p className="mt-1 truncate text-xs text-amber-800">
                          {f.linkLabel} → {f.linkUrl}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <button type="button" onClick={() => edit(f)} className="text-xs font-bold text-slate-700 hover:text-slate-950">
                          Ubah
                        </button>
                        <ConfirmCancelButton
                          label="Hapus"
                          confirmLabel="Ya, hapus"
                          onConfirm={async () => {
                            await store.deleteFaq(f.id, auth);
                            window.dispatchEvent(new Event(MINBUR_FAQ_CHANGED));
                            toast('Jawaban dihapus.');
                            await load();
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={`${card} self-start`}>
            <h2 className="text-base font-bold text-slate-950">Belum terjawab ({questions.length})</h2>
            <p className="mt-1 text-xs text-slate-500">Pertanyaan pengunjung yang belum bisa dijawab Minbur. Klik Ajari untuk menambahkan jawabannya.</p>
            {questions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Semua pertanyaan sudah terjawab. 👍</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {questions.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900">{q.question}</p>
                      <p className="text-[11px] text-slate-500">{formatWib(q.askedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => teach(q)}
                        className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-500"
                      >
                        Ajari
                      </button>
                      <ConfirmCancelButton
                        label="Hapus"
                        confirmLabel="Ya, hapus"
                        onConfirm={async () => {
                          await store.deleteUnanswered(q.id, auth);
                          await load();
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
