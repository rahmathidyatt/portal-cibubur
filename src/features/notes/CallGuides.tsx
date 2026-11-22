import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_GUIDES, linesToText, segments, textToLines, type CallGuide, type GuideStep, type GuideTone } from './callGuide';
import { getGuides, saveGuides } from './callGuideStore';

const TONE: Record<GuideTone, string> = {
  gelap: 'bg-slate-900 text-white',
  biru: 'bg-sky-800 text-white',
  ungu: 'bg-violet-700 text-white'
};

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

/** Teks dengan [isian] sebagai kotak kuning dan **tebal**. */
const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {segments(text).map((s, i) =>
      s.kind === 'slot' ? (
        <mark key={i} className="mx-0.5 rounded bg-amber-200/80 px-1.5 py-0.5 font-semibold text-slate-900 [box-decoration-break:clone]">
          {s.text}
        </mark>
      ) : s.kind === 'bold' ? (
        <strong key={i} className="font-bold text-slate-950">
          {s.text}
        </strong>
      ) : (
        <React.Fragment key={i}>{s.text}</React.Fragment>
      )
    )}
  </>
);

/** Sub "Panduan Percakapan" di Notes: skrip menerima telepon/chat klien & calon agen. */
export const CallGuides: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [guides, setGuides] = useState<CallGuide[]>(DEFAULT_GUIDES);
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<CallGuide | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getGuides().then(setGuides);
  }, []);

  const guide = guides[Math.min(active, guides.length - 1)];

  const save = async () => {
    if (!draft) return;
    const next = guides.map((g, i) => (i === active ? draft : g));
    setSaving(true);
    try {
      await saveGuides(next, auth);
      setGuides(next);
      setDraft(null);
      toast('Panduan disimpan.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan panduan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pilih panduan">
          {guides.map((g, i) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              disabled={draft !== null}
              onClick={() => setActive(i)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                i === active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:text-slate-950'
              }`}
            >
              {g.subtitle || g.eyebrow.replace(/^Brighton\s*·\s*/i, '') || g.title}
            </button>
          ))}
        </div>
        {draft ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              <X className="h-4 w-4" /> Batal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-500 disabled:opacity-60 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDraft(structuredClone(guide))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <Pencil className="h-4 w-4" /> Edit panduan
          </button>
        )}
      </div>

      {draft ? <GuideEditor guide={draft} onChange={setDraft} /> : <GuideView guide={guide} />}
    </div>
  );
};

const GuideView: React.FC<{ guide: CallGuide }> = ({ guide }) => (
  <article className="overflow-hidden rounded-2xl bg-[#fffdf7] ring-1 ring-amber-200/70">
    <header className="bg-[#1e293b] px-6 py-6 sm:px-10">
      {guide.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">{guide.eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{guide.title}</h2>
      {guide.subtitle && <p className="mt-1 text-base font-semibold text-amber-400">{guide.subtitle}</p>}
    </header>
    <ol className="px-4 py-6 sm:px-10 sm:py-8">
      {guide.steps.map((s, i) => (
        <StepView key={i} step={s} n={i + 1} last={i === guide.steps.length - 1} />
      ))}
    </ol>
  </article>
);

const StepView: React.FC<{ step: GuideStep; n: number; last: boolean }> = ({ step, n, last }) => (
  <li className="relative flex gap-4 pb-7 last:pb-0 sm:gap-5">
    {!last && <span aria-hidden="true" className="absolute left-[19px] top-11 bottom-2 w-0.5 bg-amber-200" />}
    <span
      className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-extrabold ${
        last ? 'bg-[#1e293b] text-white' : 'bg-amber-400 text-slate-950'
      }`}
    >
      {n}
    </span>
    <div className="min-w-0 flex-1">
      <h3 className="pt-2 text-xs font-extrabold uppercase tracking-[0.1em] text-amber-800">
        {step.title}
        {step.note && <span className="ml-1.5 font-bold normal-case tracking-normal text-slate-500">({step.note})</span>}
      </h3>
      <div className={`mt-2.5 grid gap-3 ${step.blocks.length === 2 ? 'sm:grid-cols-2' : step.blocks.length >= 3 ? 'sm:grid-cols-3' : ''}`}>
        {step.blocks.map((b, bi) => (
          <div key={bi} className="rounded-xl bg-white px-4 py-3.5 ring-1 ring-amber-200/80">
            {b.tag && <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[b.tone]}`}>{b.tag}</span>}
            {b.lines.map((l, li) => (
              <p
                key={li}
                className={`whitespace-pre-line text-[15px] leading-relaxed text-slate-700 ${li > 0 ? 'mt-3 border-t border-dashed border-slate-300 pt-3' : ''}`}
              >
                <Rich text={l} />
              </p>
            ))}
            {bi === 0 && step.chips.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {step.chips.map((c) => (
                  <span key={c} className="rounded-lg bg-amber-200/70 px-3 py-2 text-center text-sm font-bold text-slate-900">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {step.followText && (
        <div className={`mt-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-300/70 ${step.blocks.length >= 3 ? 'sm:ml-[calc(33.333%+0.25rem)]' : ''}`}>
          {step.followLabel && <p className="text-xs font-bold text-slate-800">{step.followLabel}</p>}
          <p className="mt-0.5 text-[15px] leading-relaxed text-slate-700">
            <Rich text={step.followText} />
          </p>
        </div>
      )}
    </div>
  </li>
);

/** Editor sederhana: ubah teks tiap langkah tanpa mengubah susunannya. */
const GuideEditor: React.FC<{ guide: CallGuide; onChange: (g: CallGuide) => void }> = ({ guide, onChange }) => {
  const setStep = (i: number, patch: Partial<GuideStep>) =>
    onChange({ ...guide, steps: guide.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
      <p className="text-sm text-slate-600">
        Tulis <b>[isian]</b> untuk kotak kuning, <b>**teks**</b> untuk huruf tebal, dan baris <b>---</b> untuk garis pemisah dalam satu kotak.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['eyebrow', 'title', 'subtitle'] as const).map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">{k === 'eyebrow' ? 'Judul kecil' : k === 'title' ? 'Judul' : 'Subjudul'}</span>
            <input className={field} value={guide[k]} onChange={(e) => onChange({ ...guide, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {guide.steps.map((s, i) => (
        <fieldset key={i} className="rounded-xl bg-stone-50 p-4 ring-1 ring-slate-200">
          <legend className="px-1 text-sm font-bold text-slate-900">Langkah {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Judul langkah</span>
              <input className={field} value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Keterangan</span>
              <input className={field} value={s.note} placeholder="mis. A & B" onChange={(e) => setStep(i, { note: e.target.value })} />
            </label>
          </div>
          <div className={`mt-3 grid gap-3 ${s.blocks.length >= 2 ? 'lg:grid-cols-2' : ''}`}>
            {s.blocks.map((b, bi) => (
              <div key={bi} className="space-y-2">
                {(s.blocks.length > 1 || b.tag) && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Label pilihan</span>
                    <input
                      className={field}
                      value={b.tag}
                      onChange={(e) => setStep(i, { blocks: s.blocks.map((x, k) => (k === bi ? { ...x, tag: e.target.value } : x)) })}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Kalimat{s.blocks.length > 1 ? ` (${b.tag || `kotak ${bi + 1}`})` : ''}</span>
                  <textarea
                    className={`${field} min-h-[110px] leading-relaxed`}
                    defaultValue={linesToText(b.lines)}
                    onChange={(e) => setStep(i, { blocks: s.blocks.map((x, k) => (k === bi ? { ...x, lines: textToLines(e.target.value) } : x)) })}
                  />
                </label>
              </div>
            ))}
          </div>
          {(s.followText || s.followLabel) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Label lanjutan</span>
                <input className={field} value={s.followLabel} onChange={(e) => setStep(i, { followLabel: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Kalimat lanjutan</span>
                <textarea className={`${field} min-h-[70px]`} value={s.followText} onChange={(e) => setStep(i, { followText: e.target.value })} />
              </label>
            </div>
          )}
          {s.chips.length > 0 && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Daftar fasilitas (satu per baris)</span>
              <textarea
                className={`${field} min-h-[90px]`}
                defaultValue={s.chips.join('\n')}
                onChange={(e) => setStep(i, { chips: e.target.value.split('\n').map((c) => c.trim()).filter(Boolean) })}
              />
            </label>
          )}
        </fieldset>
      ))}
    </div>
  );
};
