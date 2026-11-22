import React, { useCallback, useEffect, useState } from 'react';
import { Award, Pencil, Plus, Upload, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { SectionHeading } from '../../components/SectionHeading';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { DEFAULT_ACHIEVEMENTS, validateAchievement, type Achievement } from './achievementData';
import { addAchievement, deleteAchievement, listAchievements, updateAchievement } from './achievementStore';
import bocAwards2026 from '../../assets/achievements/boc-awards-2026.webp';

/** Poster bawaan aplikasi (dipakai bila baris tidak punya unggahan). */
const BUNDLED: Record<string, string> = { 'boc-awards-2026': bocAwards2026 };
const posterOf = (a: Achievement) => a.photoUrl || BUNDLED[a.id];

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

/** Perkecil poster (sisi terpanjang maks. 1000 px, rasio asli) menjadi data URL WebP. */
async function posterToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const webp = c.toDataURL('image/webp', 0.8);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82);
}

/** Bagian "Pencapaian" di beranda: kartu poster + keterangan, terbaru di depan. */
export const Achievements: React.FC = () => {
  const { isAdmin, auth } = useAdmin();
  const [items, setItems] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  /** null = formulir tertutup, 'baru' = tambah, selain itu = pencapaian yang sedang diedit. */
  const [form, setForm] = useState<'baru' | Achievement | null>(null);
  const [zoom, setZoom] = useState<Achievement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listAchievements());
    } catch {
      setItems(DEFAULT_ACHIEVEMENTS);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (items.length === 0 && !isAdmin) return null;

  return (
    <section id="pencapaian" className="scroll-mt-20 py-12 sm:py-16 bg-stone-50 border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <SectionHeading
          overline="Prestasi kantor"
          title="Pencapaian"
          action={
            isAdmin && form === null ? (
              <button
                type="button"
                onClick={() => setForm('baru')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah pencapaian
              </button>
            ) : null
          }
        />

        {isAdmin && form !== null && (
          <AchievementForm
            key={form === 'baru' ? 'baru' : form.id}
            editing={form === 'baru' ? null : form}
            onCancel={() => setForm(null)}
            onDone={() => {
              setForm(null);
              void load();
            }}
          />
        )}
        {error && <p className="mt-4 text-xs font-semibold text-red-700">{error}</p>}

        {items.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">Belum ada pencapaian.</p>
        ) : (
          <ul className="mt-8 flex flex-wrap justify-center gap-4">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex w-full max-w-[520px] gap-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4"
              >
                <button
                  type="button"
                  onClick={() => setZoom(a)}
                  aria-label={`Perbesar poster ${a.award}`}
                  className="w-[104px] shrink-0 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200 cursor-zoom-in sm:w-[132px]"
                >
                  <img src={posterOf(a)} alt={`Poster ${a.award}`} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
                </button>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    {a.award}
                  </p>
                  {a.rank && (
                    <p className="mt-1 font-display text-4xl font-extrabold leading-none tracking-tight text-slate-950 sm:text-5xl">
                      {a.rank.startsWith('#') ? (
                        <>
                          <span className="text-amber-500">#</span>
                          {a.rank.slice(1)}
                        </>
                      ) : (
                        a.rank
                      )}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-bold leading-snug text-slate-900 sm:text-base">{a.title}</p>
                  {a.periodLabel && <p className="mt-1 text-xs text-slate-500">Periode {a.periodLabel}</p>}
                  {isAdmin && (
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(a);
                          document.getElementById('pencapaian')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-950 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <ConfirmCancelButton
                        label="Hapus"
                        confirmLabel="Hapus"
                        onConfirm={async () => {
                          setError(null);
                          try {
                            await deleteAchievement(a.id, auth);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Gagal menghapus pencapaian.');
                          }
                          await load();
                        }}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Poster ${zoom.award}`}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4"
          onClick={() => setZoom(null)}
          onKeyDown={(e) => e.key === 'Escape' && setZoom(null)}
        >
          <button
            type="button"
            autoFocus
            onClick={() => setZoom(null)}
            aria-label="Tutup"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-900 hover:bg-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={posterOf(zoom)}
            alt={`Poster ${zoom.award}`}
            className="max-h-[88vh] max-w-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};

const AchievementForm: React.FC<{ editing: Achievement | null; onDone: () => void; onCancel: () => void }> = ({
  editing,
  onDone,
  onCancel
}) => {
  const { auth } = useAdmin();
  const [award, setAward] = useState(editing?.award ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [rank, setRank] = useState(editing?.rank ?? '');
  const [periodLabel, setPeriodLabel] = useState(editing?.periodLabel ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(editing?.photoUrl ?? null);
  const preview = photoUrl || (editing ? BUNDLED[editing.id] : undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { award, title, rank, periodLabel, photoUrl };
    const invalid = validateAchievement(input, Boolean(preview));
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateAchievement(editing.id, input, auth);
      else await addAchievement(input, auth);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pencapaian.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 sm:grid-cols-[auto_1fr]">
      <label className="relative grid h-[130px] w-[104px] cursor-pointer place-items-center overflow-hidden rounded-xl bg-amber-100 text-amber-800">
        {preview ? (
          <img src={preview} alt="Pratinjau poster" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] font-semibold">
            <Upload className="h-4 w-4" />
            Unggah poster
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          aria-label="Poster pencapaian"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setError(null);
              setPhotoUrl(await posterToDataUrl(f));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Poster gagal diproses.');
            }
          }}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {editing && <p className="text-sm font-bold text-slate-900 sm:col-span-2">Edit pencapaian · {editing.award}</p>}
        <input aria-label="Nama penghargaan" className={inputClass} value={award} maxLength={80} onChange={(e) => setAward(e.target.value)} placeholder="Penghargaan, mis. BOC Awards 2026" />
        <input aria-label="Peringkat" className={inputClass} value={rank} maxLength={20} onChange={(e) => setRank(e.target.value)} placeholder="Peringkat, mis. 12 (boleh kosong)" />
        <input aria-label="Kategori" className={`${inputClass} sm:col-span-2`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Kategori, mis. TOP 15 Brighton HUB · Bisnis Tanpa Batas" />
        <input aria-label="Periode" className={`${inputClass} sm:col-span-2`} value={periodLabel} maxLength={60} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Periode, mis. Januari – Juni 2026" />
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : <span />}
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onCancel} className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-950 cursor-pointer">
              Batal
            </button>
            <button type="submit" disabled={busy} className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-60 cursor-pointer">
              {busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan pencapaian'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
