import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Plus, Trash2, Upload } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { randomId } from '../../services/supabaseClient';
import { downloadBytes } from '../floortime/posterRenderer';
import {
  BRIGHT_DAY_LOCATION,
  CHECK_ITEMS,
  RETENTION_DAYS,
  applyChoice,
  daysLeft,
  expiresAt,
  formatEventDate,
  missingFields,
  newReport,
  pdfFileName,
  type BrightDayReport,
  type Konsumsi
} from './brightDay';
import { getBrightDayStore } from './brightDayStore';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';

const KONSUMSI: [Konsumsi, string][] = [
  ['a', 'a. Di kantor DENGAN termos'],
  ['b', 'b. Di kantor TANPA termos'],
  ['c', 'c. Di cafe']
];

function formatWib(d: Date): string {
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Menu admin: Report Bright Day (checklist acara + laporan after event + foto lampiran → PDF). */
export const BrightDayPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getBrightDayStore();
  const [reports, setReports] = useState<BrightDayReport[] | null>(null);
  const [draft, setDraft] = useState<BrightDayReport | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'save' | 'pdf' | 'photo' | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await store.list(auth);
      setReports(list);
      setSavedIds(new Set(list.map((r) => r.id)));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat laporan.', 'error');
      setReports([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  // Muat gambar foto yang belum ada di memori (laporan tersimpan).
  useEffect(() => {
    if (!draft) return;
    for (const p of draft.photos) {
      if (photoUrls[p.id]) continue;
      if (p.dataUrl) {
        setPhotoUrls((m) => ({ ...m, [p.id]: p.dataUrl! }));
        continue;
      }
      void store
        .photoDataUrl(p, auth)
        .then((url) => setPhotoUrls((m) => ({ ...m, [p.id]: url })))
        .catch(() => undefined);
    }
  }, [draft, photoUrls, store, auth]);

  // Pratinjau halaman 1 (digambar ulang setelah isian berhenti diketik).
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const { drawChecklistPage, loadBrightDayFonts } = await import('./brightDayPdf');
      await loadBrightDayFonts().catch(() => undefined);
      if (!cancelled) setPreview(drawChecklistPage(draft, 1.6).toDataURL('image/png'));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [draft]);

  const update = (patch: Partial<BrightDayReport> | ((r: BrightDayReport) => BrightDayReport)) => {
    setDraft((d) => (d ? (typeof patch === 'function' ? patch(d) : { ...d, ...patch }) : d));
    setDirty(true);
  };

  const startNew = () => {
    setDraft(newReport(randomId(), new Date().toISOString()));
    setDirty(false);
    setPreview('');
  };

  const open = (r: BrightDayReport) => {
    setDraft(r);
    setDirty(false);
    setPreview('');
  };

  const save = async (): Promise<BrightDayReport | null> => {
    if (!draft) return null;
    setBusy('save');
    try {
      const saved = await store.save(
        { ...draft, photos: draft.photos.map((p) => ({ ...p, dataUrl: p.path ? undefined : (photoUrls[p.id] ?? p.dataUrl) })) },
        auth
      );
      setDraft(saved);
      setDirty(false);
      await load();
      toast(`Laporan disimpan. Terhapus otomatis ${formatWib(expiresAt(saved.createdAt))}.`);
      return saved;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan laporan.', 'error');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (!draft) return;
    const missing = missingFields(draft);
    if (missing.length) {
      toast(`Lengkapi dulu: ${missing.join(', ')}.`, 'error');
      return;
    }
    setBusy('pdf');
    try {
      const urls = await Promise.all(draft.photos.map((p) => photoUrls[p.id] ?? store.photoDataUrl(p, auth)));
      const { buildBrightDayPdf } = await import('./brightDayPdf');
      downloadBytes(await buildBrightDayPdf(draft, urls), pdfFileName(draft), 'application/pdf');
      toast(`${pdfFileName(draft)} diunduh (${1 + urls.length} halaman).`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat PDF.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const addPhotos = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy('photo');
    try {
      const { compressPhoto } = await import('./brightDayPdf');
      const added: { id: string; dataUrl: string }[] = [];
      for (const file of files) {
        try {
          added.push({ id: randomId(), dataUrl: await compressPhoto(file) });
        } catch (err) {
          toast(err instanceof Error ? err.message : `Foto ${file.name} gagal dibaca.`, 'error');
        }
      }
      if (added.length) {
        setPhotoUrls((m) => ({ ...m, ...Object.fromEntries(added.map((a) => [a.id, a.dataUrl])) }));
        update((r) => ({ ...r, photos: [...r.photos, ...added] }));
        toast(`${added.length} foto ditambahkan sebagai halaman baru.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const movePhotoTo = (from: number, to: number) =>
    update((r) => {
      if (to < 0 || to >= r.photos.length || to === from) return r;
      const photos = [...r.photos];
      const [moved] = photos.splice(from, 1);
      photos.splice(to, 0, moved);
      return { ...r, photos };
    });

  const now = new Date();

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Bright Day</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Report</h1>
            <p className="mt-1 text-sm text-slate-600">
              Checklist Bright Day Onsite, laporan after event, dan foto lampiran dalam satu PDF. Laporan disimpan {RETENTION_DAYS} hari
              lalu terhapus otomatis.
            </p>
          </div>
          {!draft && (
            <button type="button" onClick={startNew} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              Buat laporan baru
            </button>
          )}
        </div>

        {!draft && (
          <div className={`${card} mt-6`}>
            <h2 className="text-base font-bold text-slate-950">Laporan tersimpan ({reports?.length ?? 0})</h2>
            {reports === null ? (
              <p className="mt-3 text-sm text-slate-500">Memuat…</p>
            ) : reports.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada laporan dalam {RETENTION_DAYS} hari terakhir.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {formatEventDate(r.eventDate) || 'Tanggal belum diisi'}
                        {r.host && <span className="font-normal text-slate-600"> · Host {r.host}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.photos.length} foto · terhapus otomatis dalam {daysLeft(r.createdAt, now)} hari ({formatWib(expiresAt(r.createdAt))})
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => open(r)} className={ghostBtn}>
                        Buka
                      </button>
                      <ConfirmCancelButton
                        label="Hapus"
                        confirmLabel="Ya, hapus"
                        onConfirm={async () => {
                          await store.remove(r, auth);
                          toast('Laporan dihapus.');
                          await load();
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {draft && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (dirty && !window.confirm('Perubahan belum disimpan. Tutup laporan ini?')) return;
                    setDraft(null);
                  }}
                  className={ghostBtn}
                >
                  ← Daftar laporan
                </button>
                <span className="text-xs text-slate-500">
                  {savedIds.has(draft.id)
                    ? `${dirty ? 'Ada perubahan belum disimpan · ' : 'Tersimpan · '}terhapus otomatis ${formatWib(expiresAt(draft.createdAt))}`
                    : 'Belum disimpan'}
                </span>
              </div>

              <div className={card}>
                <h2 className="text-base font-bold text-slate-950">Data acara</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Lokasi
                    <input className={`${input} mt-1 bg-stone-50 text-slate-600`} value={BRIGHT_DAY_LOCATION} readOnly aria-label="Lokasi" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Admin In Charge
                    <input
                      className={`${input} mt-1`}
                      value={draft.adminInCharge}
                      onChange={(e) => update({ adminInCharge: e.target.value })}
                      aria-label="Admin In Charge"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Host
                    <input className={`${input} mt-1`} value={draft.host} onChange={(e) => update({ host: e.target.value })} aria-label="Host" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Narasumber
                    <input
                      className={`${input} mt-1`}
                      value={draft.speaker}
                      onChange={(e) => update({ speaker: e.target.value })}
                      aria-label="Narasumber"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Tanggal acara
                    <input
                      type="date"
                      className={`${input} mt-1`}
                      value={draft.eventDate}
                      onChange={(e) => update({ eventDate: e.target.value })}
                      aria-label="Tanggal acara"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Waktu acara (WIB)
                    <input
                      type="time"
                      className={`${input} mt-1`}
                      value={draft.eventTime.replace('.', ':')}
                      onChange={(e) => update({ eventTime: e.target.value })}
                      aria-label="Waktu acara"
                    />
                  </label>
                </div>
              </div>

              <div className={card}>
                <h2 className="text-base font-bold text-slate-950">Checklist</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Pakai pengajuan finance?
                    <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
                      {([true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => update((r) => applyChoice(r, { finance: v }))}
                          aria-pressed={draft.finance === v}
                          className={`rounded-lg px-2 py-1.5 text-xs font-bold cursor-pointer ${
                            draft.finance === v ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          {v ? 'Ya' : 'Tidak'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="text-xs font-semibold text-slate-700">
                    Konsumsi
                    <select
                      className={`${input} mt-1`}
                      value={draft.konsumsi}
                      onChange={(e) => update((r) => applyChoice(r, { konsumsi: e.target.value as Konsumsi }))}
                      aria-label="Konsumsi"
                    >
                      {KONSUMSI.map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                  {CHECK_ITEMS.map((item) => {
                    const title = item.lines[0].map((r) => r.t).join('').trim();
                    return (
                      <li key={item.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            checked={!!draft.checks[item.id]}
                            onChange={(e) => update((r) => ({ ...r, checks: { ...r.checks, [item.id]: e.target.checked } }))}
                            className="h-4 w-4 shrink-0 accent-amber-500"
                            aria-label={`Status ${title}`}
                          />
                          <span className="w-6 shrink-0 text-xs font-bold text-slate-500">{item.no}</span>
                          <span className="min-w-0 truncate">{title}</span>
                        </label>
                        <input
                          className={`${input} sm:max-w-[220px] py-1.5 text-xs`}
                          value={draft.notes[item.id] ?? ''}
                          onChange={(e) => update((r) => ({ ...r, notes: { ...r.notes, [item.id]: e.target.value } }))}
                          placeholder="Keterangan (opsional)"
                          aria-label={`Keterangan ${title}`}
                          maxLength={120}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className={card}>
                <h2 className="text-base font-bold text-slate-950">Format laporan after event</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['registered', 'Peserta Daftar Acara'],
                      ['attended', 'Peserta Hadir'],
                      ['paWithGuests', 'PA Yang Membawa Tamu'],
                      ['closing', 'Peserta Closing di Tempat']
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-xs font-semibold text-slate-700">
                      {label}
                      <input
                        className={`${input} mt-1`}
                        inputMode="numeric"
                        value={draft[key]}
                        onChange={(e) => update({ [key]: e.target.value } as Partial<BrightDayReport>)}
                        aria-label={label}
                      />
                    </label>
                  ))}
                  <label className="text-xs font-semibold text-slate-700">
                    Biaya Acara (Rp)
                    <input
                      className={`${input} mt-1`}
                      inputMode="numeric"
                      value={draft.cost}
                      onChange={(e) => update({ cost: e.target.value.replace(/[^\d.]/g, '') })}
                      aria-label="Biaya Acara"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  Evaluasi & Catatan Lainnya
                  <textarea
                    className={`${input} mt-1 min-h-24`}
                    value={draft.evaluation}
                    onChange={(e) => update({ evaluation: e.target.value })}
                    aria-label="Evaluasi & Catatan Lainnya"
                    maxLength={600}
                  />
                </label>
              </div>

            </div>

            <aside className="space-y-3 lg:sticky lg:top-[73px] lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto lg:pr-1">
              <div className="flex gap-2">
                <button type="button" onClick={() => void save()} disabled={busy !== null} className={`${primaryBtn} flex-1`}>
                  {busy === 'save' ? 'Menyimpan…' : 'Simpan laporan'}
                </button>
                <button type="button" onClick={() => void downloadPdf()} disabled={busy !== null} className={`${ghostBtn} flex-1`}>
                  <FileDown className="h-4 w-4 text-red-700" />
                  {busy === 'pdf' ? 'Membuat…' : 'Unduh PDF'}
                </button>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'photo'} className={`${ghostBtn} w-full`}>
                <Upload className="h-4 w-4" />
                {busy === 'photo' ? 'Memproses foto…' : 'Tambah halaman foto'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Unggah foto lampiran"
                onChange={(e) => {
                  const files: File[] = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  void addPhotos(files);
                }}
              />

              <ol className="space-y-3" aria-label="Halaman laporan">
                <li className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                  <p className="border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                    Halaman 1 dari {1 + draft.photos.length}
                  </p>
                  {preview ? (
                    <img src={preview} alt="Halaman 1: checklist Bright Day" className="w-full" />
                  ) : (
                    <div className="grid aspect-[595/842] place-items-center text-xs text-slate-400">Menyiapkan pratinjau…</div>
                  )}
                </li>
                {draft.photos.map((p, i) => (
                  <li key={p.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        Halaman
                        <select
                          value={i + 2}
                          onChange={(e) => movePhotoTo(i, Number(e.target.value) - 2)}
                          aria-label={`Pindahkan halaman ${i + 2}`}
                          className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-bold"
                        >
                          {draft.photos.map((_, j) => (
                            <option key={j} value={j + 2}>
                              {j + 2}
                            </option>
                          ))}
                        </select>
                        <span className="font-normal text-slate-500">dari {1 + draft.photos.length}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => update((r) => ({ ...r, photos: r.photos.filter((x) => x.id !== p.id) }))}
                        aria-label={`Hapus halaman ${i + 2}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                    <div className="aspect-[595/842] bg-white p-[4.7%]">
                      {photoUrls[p.id] ? (
                        <img src={photoUrls[p.id]} alt={`Halaman ${i + 2}`} className="mx-auto max-h-full max-w-full object-contain object-top" />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-slate-400">Memuat foto…</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-slate-500">Nama file: {pdfFileName(draft)}</p>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
};
