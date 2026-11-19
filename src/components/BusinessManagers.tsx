import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Plus, Upload } from 'lucide-react';
import {
  BM_TIER_OPTIONS,
  BUSINESS_MANAGERS,
  groupByUnit,
  isPrincipal,
  validateBusinessManager,
  type BusinessManager
} from '../data/businessManagers';
import { getContentStore } from '../services/contentStore';
import { useAdmin } from '../hooks/useAdmin';
import { resizeImageToDataUrl } from '../utils/imageResize';
import { ConfirmCancelButton } from './ConfirmCancelButton';

// Foto bawaan di-import satu per satu agar Vite menyalin & meng-hash file saat build.
// BM baru cukup ditambahkan admin lewat portal (foto diunggah dari formulir).
import rudyPhoto from '../assets/managers/rudy.webp';
import adolfPhoto from '../assets/managers/adolf.webp';
import viraPhoto from '../assets/managers/vira.webp';
import edahPhoto from '../assets/managers/edah.webp';
import risdaPhoto from '../assets/managers/risda.webp';
import veePhoto from '../assets/managers/vee.webp';
import morenPhoto from '../assets/managers/moren.webp';
import adePhoto from '../assets/managers/ade.webp';
import toniPhoto from '../assets/managers/toni.webp';

const BUNDLED_PHOTOS: Record<string, string> = {
  rudy: rudyPhoto,
  adolf: adolfPhoto,
  vira: viraPhoto,
  edah: edahPhoto,
  risda: risdaPhoto,
  vee: veePhoto,
  moren: morenPhoto,
  ade: adePhoto,
  toni: toniPhoto
};

function photoFor(bm: BusinessManager): string | undefined {
  return bm.photoUrl || BUNDLED_PHOTOS[bm.id];
}

const UNIT_STYLE: Record<string, { label: string; chip: string; dot: string }> = {
  Warrior: { label: 'text-amber-700', chip: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  Champion: { label: 'text-sky-700', chip: 'bg-sky-100 text-sky-900', dot: 'bg-sky-500' },
  Vision: { label: 'text-violet-700', chip: 'bg-violet-100 text-violet-900', dot: 'bg-violet-500' },
  Priority: { label: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-500' },
  Winner: { label: 'text-rose-700', chip: 'bg-rose-100 text-rose-900', dot: 'bg-rose-500' },
  default: { label: 'text-slate-600', chip: 'bg-slate-100 text-slate-800', dot: 'bg-slate-500' }
};

const PrincipalSection: React.FC<{
  principals: BusinessManager[];
  isAdmin: boolean;
  renderCard: (bm: BusinessManager) => React.ReactNode;
  onAdd: () => void;
}> = ({ principals, isAdmin, renderCard, onAdd }) => (
  <div className="mt-6">
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-950">
        <Crown className="h-5 w-5 text-amber-500" aria-hidden="true" />
        Principal
      </h3>
      {isAdmin && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah Principal
        </button>
      )}
    </div>
    {principals.length === 0 ? (
      <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-stone-100 text-slate-400">
          <Crown className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-700">Belum ada Principal di HUB Cibubur.</p>
          {isAdmin && (
            <p className="text-xs text-slate-500">Klik Tambah Principal untuk menambahkan.</p>
          )}
        </div>
      </div>
    ) : (
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{principals.map(renderCard)}</ul>
    )}
  </div>
);

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

const AddBmForm: React.FC<{
  existing: BusinessManager[];
  onDone: () => void;
  onCancel: () => void;
  initialTier: string;
}> = ({ existing, onDone, onCancel, initialTier }) => {
  const { auth } = useAdmin();
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [tier, setTier] = useState<string>(initialTier);
  const principal = isPrincipal({ tier });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPhotoUrl(await resizeImageToDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto gagal diproses.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBusinessManager({ name, code, tier }, existing);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getContentStore().addBusinessManager({ name, code, tier, photoUrl }, auth);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan BM.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4"
    >
      <label className="relative grid place-items-center w-24 h-24 rounded-xl bg-amber-100 text-amber-800 cursor-pointer overflow-hidden">
        {photoUrl ? (
          <img src={photoUrl} alt="Pratinjau foto BM" className="w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] font-semibold">
            <Upload className="w-4 h-4" />
            Unggah foto
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          aria-label="Foto BM"
          onChange={handlePhoto}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          aria-label="Nama BM"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder={principal ? 'Nama Principal' : 'Nama, mis. BUDI, CRA®'}
          className={inputClass}
        />
        <input
          aria-label="Kode BM"
          value={code}
          maxLength={10}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Kode, mis. ABCD"
          className={`${inputClass} font-mono`}
        />
        <select aria-label="Level BM" value={tier} onChange={(e) => setTier(e.target.value)} className={inputClass}>
          {BM_TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div className="sm:col-span-3 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-xs font-semibold text-red-700">{error}</p>
          ) : (
            <p className="text-[11px] text-slate-500">Foto otomatis dipotong persegi 400×400.</p>
          )}
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Menyimpan…' : principal ? 'Simpan Principal' : 'Simpan BM'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export const BusinessManagers: React.FC = () => {
  const { isAdmin, auth } = useAdmin();
  const [managers, setManagers] = useState<BusinessManager[]>(BUSINESS_MANAGERS);
  /** Level awal formulir tambah (null = formulir tertutup). */
  const [formTier, setFormTier] = useState<string | null>(null);
  const formOpen = formTier !== null;
  const setFormOpen = (open: boolean, tier = 'Brighton Warrior') => setFormTier(open ? tier : null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setManagers(await getContentStore().listBusinessManagers());
    } catch {
      // Gagal memuat dari server: tetap tampilkan daftar bawaan.
      setManagers(BUSINESS_MANAGERS);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (bm: BusinessManager) => {
    setError(null);
    try {
      await getContentStore().deleteBusinessManager(bm.id, auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus BM.');
    }
    await load();
  };

  const principals = managers.filter(isPrincipal);
  const bms = managers.filter((m) => !isPrincipal(m));
  const units = groupByUnit(bms);

  const renderCard = (bm: BusinessManager) => {
    const photo = photoFor(bm);
    return (
      <li key={bm.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
        {photo ? (
          <img
            src={photo}
            alt={`Foto ${bm.name}`}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="h-16 w-16 shrink-0 rounded-lg object-cover bg-amber-400"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-amber-400 text-xl font-bold text-slate-950"
          >
            {bm.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-950">{bm.name}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{bm.code}</p>
        </div>
        {isAdmin && (
          <div className="self-start">
            <ConfirmCancelButton label="Hapus" confirmLabel="Hapus" onConfirm={() => handleDelete(bm)} />
          </div>
        )}
      </li>
    );
  };

  return (
    <section id="business-manager" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">Business Manager</h2>
            <p className="mt-1 text-xs text-slate-500">
              {bms.length} BM · {units.length} unit
            </p>
          </div>
          {isAdmin && !formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah BM
            </button>
          )}
        </div>

        {isAdmin && formOpen && (
          <AddBmForm
            key={formTier}
            initialTier={formTier ?? 'Brighton Warrior'}
            existing={managers}
            onCancel={() => setFormOpen(false)}
            onDone={() => {
              setFormOpen(false);
              void load();
            }}
          />
        )}
        {error && <p className="mt-4 text-xs font-semibold text-red-700">{error}</p>}

        {principals.length > 0 && (
        <PrincipalSection
          principals={principals}
          isAdmin={isAdmin}
          renderCard={renderCard}
          onAdd={() => setFormOpen(true, 'Principal')}
        />
        )}

        {principals.length > 0 && (
          <h3 className="mt-10 text-xl font-bold tracking-tight text-slate-950">Business Manager per unit</h3>
        )}
        {bms.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Belum ada Business Manager.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {units.map(({ unit, members }) => {
              const style = UNIT_STYLE[unit] ?? UNIT_STYLE.default;
              return (
                <section
                  key={unit}
                  aria-label={`Unit ${unit}`}
                  className="grid gap-3 rounded-2xl bg-stone-50 p-3 ring-1 ring-slate-200 md:grid-cols-[180px_minmax(0,1fr)] md:p-4"
                >
                  <div className="flex items-center justify-between gap-3 md:flex-col md:items-start md:justify-center">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${style.label}`}>Brighton</p>
                      <p className="text-2xl font-extrabold tracking-tight text-slate-950">{unit}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {members.length} BM
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{members.map(renderCard)}</ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
