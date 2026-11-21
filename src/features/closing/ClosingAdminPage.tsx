import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Plus, Trash2, Upload } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { randomId } from '../../services/supabaseClient';
import { todayInJakarta } from '../../utils/schedule';
import {
  CLOSING_ROLES,
  CLOSING_TYPES,
  MAX_PROJECT_LEADERS,
  applyType,
  emptyAgent,
  flyerCutoff,
  formatClosingDate,
  formatMonth,
  knownAgents,
  validateClosing,
  type Closing,
  type ClosingAgent,
  type ClosingRole,
  type ClosingType
} from './closing';
import { CLOSINGS_CHANGED, getClosingStore } from './closingStore';
import { parseClosingText, type ParsedClosing } from './closingPaste';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';

const BASE_UNITS = ['Brighton Warrior', 'Brighton Champion', 'Brighton Vision', 'Brighton Priority', 'Brighton Winner', 'Brighton Harmony', 'Brighton Max'];

function blank(): Closing {
  return {
    id: randomId(),
    date: todayInJakarta(),
    type: 'Jual Beli',
    location: '',
    agents: [emptyAgent()],
    flyers: [],
    createdAt: new Date().toISOString()
  };
}

/** Menu admin Operasional › Closing: input closing + flyer yang tampil di beranda. */
export const ClosingAdminPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getClosingStore();
  const [all, setAll] = useState<Closing[] | null>(null);
  const [draft, setDraft] = useState<Closing>(blank);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(todayInJakarta().slice(0, 7));
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedClosing[]>([]);
  const [usedIndex, setUsedIndex] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      // Flyer lebih dari 12 bulan dihapus otomatis untuk melegakan penyimpanan; data closing tetap.
      await store.purgeFlyers(flyerCutoff(todayInJakarta()), auth).catch(() => 0);
      setAll(await store.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data closing.');
      setAll([]);
    }
  }, [store, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const known = useMemo(() => knownAgents(all ?? []), [all]);
  const unitOptions = useMemo(
    () => [...new Set([...BASE_UNITS, ...[...known.values()].map((a) => a.unit.trim()).filter(Boolean)])],
    [known]
  );
  const months = useMemo(() => {
    const set = new Set<string>((all ?? []).map((c) => c.date.slice(0, 7)));
    set.add(todayInJakarta().slice(0, 7));
    return [...set].sort().reverse();
  }, [all]);
  const monthItems = (all ?? []).filter((c) => c.date.startsWith(month));
  const isPrimary = draft.type === 'Primary';
  const leaders = draft.agents.length - 1;

  const setAgent = (i: number, patch: Partial<ClosingAgent>) =>
    setDraft((d) => {
      const agents = d.agents.map((a, j) => {
        if (j !== i) return a;
        const next = { ...a, ...patch };
        // Nama yang pernah diinput: isi unit, area & kode otomatis.
        if (patch.name !== undefined) {
          const k = known.get(patch.name.trim().toLowerCase());
          if (k) Object.assign(next, { unit: k.unit, area: k.area, code: k.code });
          next.role = a.role;
        }
        return next;
      });
      return { ...d, agents };
    });

  const addFlyers = async (files: File[]) => {
    if (files.length === 0) return;
    const { compressPhoto } = await import('../../utils/image');
    for (const file of files) {
      try {
        const dataUrl = await compressPhoto(file, 1600, 0.88);
        const thumbDataUrl = await compressPhoto(file, 520, 0.8);
        setDraft((d) => ({ ...d, flyers: [...d.flyers, { id: randomId(), dataUrl, thumbDataUrl }] }));
      } catch (err) {
        toast(err instanceof Error ? err.message : `Flyer ${file.name} gagal dibaca.`, 'error');
      }
    }
  };

  /** Isi formulir dari teks yang ditempel (tanggal & flyer tetap diisi manual). */
  const fillFrom = (p: ParsedClosing, index: number) => {
    setDraft((d) => ({ ...d, type: p.type, location: p.location, agents: p.agents.length ? p.agents : [emptyAgent()] }));
    setUsedIndex(index);
    setError(null);
  };
  const readPaste = () => {
    const list = parseClosingText(pasteText);
    if (list.length === 0) {
      setParsed([]);
      return setError('Teks closing tidak terbaca. Pastikan ada baris "Jual Beli – LOKASI" lalu baris "- S: Nama Brighton Unit Area".');
    }
    setParsed(list);
    fillFrom(list[0], 0);
    toast(list.length === 1 ? 'Formulir terisi. Lengkapi tanggal & flyer.' : `${list.length} closing terbaca. Closing 1 sudah mengisi formulir.`);
  };

  const reset = () => {
    setDraft(blank());
    setEditing(false);
    setError(null);
  };

  const submit = async () => {
    const clean = { ...draft, location: draft.location.trim(), agents: draft.agents.filter((a) => a.name.trim()) };
    const problem = validateClosing(clean);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await store.save(clean, auth);
      window.dispatchEvent(new Event(CLOSINGS_CHANGED));
      toast(editing ? 'Closing diperbarui.' : 'Closing disimpan dan tampil di beranda.');
      setMonth(clean.date.slice(0, 7));
      const rest = usedIndex !== null ? parsed.filter((_, i) => i !== usedIndex) : parsed;
      reset();
      if (usedIndex !== null) {
        setParsed(rest);
        setUsedIndex(null);
        // Closing berikutnya dari teks yang ditempel langsung mengisi formulir.
        if (rest.length > 0) fillFrom(rest[0], 0);
        else setPasteText('');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan closing.');
    } finally {
      setBusy(false);
    }
  };

  const edit = (c: Closing) => {
    setDraft({ ...c, agents: c.agents.length ? c.agents : [emptyAgent()] });
    setEditing(true);
    setError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Operasional</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Closing</h1>

        <div className="mt-6 max-w-[900px]">
          <div ref={formRef} className={`${card} scroll-mt-24 space-y-4`}>
            <h2 className="text-base font-bold text-slate-950">{editing ? 'Ubah closing' : 'Tambah closing'}</h2>
            {!editing && (
              <details className="group rounded-xl bg-stone-50 ring-1 ring-slate-200" open={parsed.length > 0 || undefined}>
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-800">
                  <ClipboardPaste className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  Tempel teks closing (isi otomatis)
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  <textarea
                    rows={6}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'Jual Beli – AMAZING CIKEAS HILL\n- PL: Rudy Brighton Warrior Cibubur, Bogor @BM Warrior Rudy (AUFZ)\n- S: Vira Brighton Warrior Cibubur, Bogor @BM Warrior Vira (AUTU)'}
                    aria-label="Teks closing"
                    className={`${input} font-mono text-xs`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={readPaste} disabled={!pasteText.trim()} className={primaryBtn}>
                      Isi otomatis
                    </button>
                  </div>
                  {parsed.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {parsed.map((p, i) => (
                        <button
                          key={`${p.location}-${i}`}
                          type="button"
                          onClick={() => fillFrom(p, i)}
                          className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                            usedIndex === i ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {i + 1}. {p.type} – {p.location}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700">
                Tanggal closing
                <input
                  type="date"
                  className={`${input} mt-1`}
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  aria-label="Tanggal closing"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Jenis
                <select
                  className={`${input} mt-1`}
                  value={draft.type}
                  onChange={(e) => {
                    const type = e.target.value as ClosingType;
                    setDraft({ ...draft, type, agents: applyType(draft.agents, type) });
                  }}
                  aria-label="Jenis closing"
                >
                  {CLOSING_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Lokasi / properti
                <input
                  className={`${input} mt-1`}
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  aria-label="Lokasi properti"
                />
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700">Agen</p>
              <datalist id="closing-agent-names">
                {[...known.values()].map((a) => (
                  <option key={a.name} value={a.name} />
                ))}
              </datalist>
              <datalist id="closing-units">
                {unitOptions.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <ul className="mt-1 space-y-2">
                {draft.agents.map((a, i) => (
                  <li key={i} className="relative grid gap-2 rounded-xl bg-stone-50 p-2 pr-10 ring-1 ring-slate-200 grid-cols-2 sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_96px]">
                    {isPrimary ? (
                      <span
                        className="flex items-center rounded-lg bg-white px-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                        title={i === 0 ? 'Selling' : 'Project Leader'}
                        aria-label={`Peran agen ${i + 1}`}
                      >
                        {i === 0 ? 'S' : 'Project Leader'}
                      </span>
                    ) : (
                      <select
                        className={`${input} px-2`}
                        value={a.role}
                        onChange={(e) => setAgent(i, { role: e.target.value as ClosingRole })}
                        aria-label={`Peran agen ${i + 1}`}
                        title={CLOSING_ROLES.find((r) => r.value === a.role)?.label}
                      >
                        {CLOSING_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.value}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      className={`${input} sm:col-span-2`}
                      list="closing-agent-names"
                      value={a.name}
                      onChange={(e) => setAgent(i, { name: e.target.value })}
                      placeholder={isPrimary && i > 0 ? 'Nama Project Leader' : 'Nama'}
                      aria-label={`Nama agen ${i + 1}`}
                    />
                    <input
                      className={`${input} uppercase`}
                      value={a.code}
                      onChange={(e) => setAgent(i, { code: e.target.value.toUpperCase() })}
                      placeholder="Kode"
                      maxLength={8}
                      aria-label={`Kode agen ${i + 1}`}
                    />
                    <input
                      className={`${input} col-span-2 sm:col-span-2`}
                      list="closing-units"
                      value={a.unit}
                      onChange={(e) => setAgent(i, { unit: e.target.value })}
                      placeholder="Unit"
                      aria-label={`Unit agen ${i + 1}`}
                    />
                    <input
                      className={`${input} col-span-2 sm:col-span-2`}
                      value={a.area}
                      onChange={(e) => setAgent(i, { area: e.target.value })}
                      placeholder="Area"
                      aria-label={`Area agen ${i + 1}`}
                    />

                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, agents: d.agents.filter((_, j) => j !== i) }))}
                      disabled={draft.agents.length === 1}
                      aria-label={`Hapus agen ${i + 1}`}
                      className="absolute right-1 top-2 grid h-9 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, agents: [...d.agents, { ...emptyAgent(), role: isPrimary ? 'PL' : 'S' }] }))}
                disabled={isPrimary && leaders >= MAX_PROJECT_LEADERS}
                className={`${ghostBtn} mt-2`}
              >
                <Plus className="h-4 w-4" />
                {isPrimary ? 'Tambah Project Leader' : 'Tambah agen'}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">Flyer closing ({draft.flyers.length})</p>
                <button type="button" onClick={() => fileRef.current?.click()} className={ghostBtn}>
                  <Upload className="h-4 w-4" />
                  Unggah flyer
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  aria-label="Unggah flyer closing"
                  onChange={(e) => {
                    const files: File[] = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    void addFlyers(files);
                  }}
                />
              </div>
              {draft.flyers.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {draft.flyers.map((f) => (
                    <li key={f.id} className="relative w-28 overflow-hidden rounded-lg ring-1 ring-slate-200">
                      <img src={store.flyerSrc(f, true)} alt="Flyer" className="aspect-[4/5] w-full bg-stone-100 object-contain" />
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, flyers: d.flyers.filter((x) => x.id !== f.id) }))}
                        aria-label="Hapus flyer"
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-red-600 shadow hover:bg-white cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              {editing && (
                <button type="button" onClick={reset} className={ghostBtn}>
                  Batal
                </button>
              )}
              <button type="button" onClick={() => void submit()} disabled={busy} className={primaryBtn}>
                {busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan closing'}
              </button>
            </div>
          </div>

        </div>

        <div className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-950">
              Daftar closing {formatMonth(month)} ({monthItems.length})
            </h2>
            <select className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Bulan">
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </div>
          {all === null ? (
            <p className="mt-3 text-sm text-slate-500">Memuat…</p>
          ) : monthItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada closing di bulan ini.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {monthItems.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  {c.flyers[0] && (
                    <img src={store.flyerSrc(c.flyers[0], true)} alt="" className="h-16 w-14 shrink-0 rounded-md bg-stone-100 object-cover ring-1 ring-slate-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {c.type} – {c.location.toUpperCase()}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {c.flyersRemovedAt && <span className="mr-1 font-semibold text-slate-400">Flyer dihapus (&gt;12 bulan) ·</span>}
                      {formatClosingDate(c.date)} · {c.agents.map((a) => `${a.role === 'PL' ? 'Project Leader' : a.role}: ${a.name}`).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => edit(c)} className="text-xs font-bold text-slate-700 hover:text-slate-950 cursor-pointer">
                      Ubah
                    </button>
                    <ConfirmCancelButton
                      label="Hapus"
                      confirmLabel="Ya, hapus"
                      onConfirm={async () => {
                        await store.remove(c, auth);
                        window.dispatchEvent(new Event(CLOSINGS_CHANGED));
                        toast('Closing dihapus.');
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
    </section>
  );
};
