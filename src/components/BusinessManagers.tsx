import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import {
  BM_TIER_OPTIONS,
  BUSINESS_MANAGERS,
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

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

const AddBmForm: React.FC<{
  existing: BusinessManager[];
  onDone: () => void;
  onCancel: () => void;
}> = ({ existing, onDone, onCancel }) => {
  const { auth } = useAdmin();
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [tier, setTier] = useState<string>(BM_TIER_OPTIONS[0]);
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
          placeholder="Nama, mis. BUDI, CRA®"
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
        <input
          aria-label="Level BM"
          list="bm-tier-options"
          value={tier}
          maxLength={40}
          onChange={(e) => setTier(e.target.value)}
          className={inputClass}
        />
        <datalist id="bm-tier-options">
          {BM_TIER_OPTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

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
              {busy ? 'Menyimpan…' : 'Simpan BM'}
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
  const [formOpen, setFormOpen] = useState<boolean>(false);
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

  return (
    <section id="business-manager" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Business Manager
          </h2>
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
            existing={managers}
            onCancel={() => setFormOpen(false)}
            onDone={() => {
              setFormOpen(false);
              void load();
            }}
          />
        )}
        {error && <p className="mt-4 text-xs font-semibold text-red-700">{error}</p>}

        {managers.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Belum ada Business Manager.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {managers.map((bm) => {
              const photo = photoFor(bm);
              return (
                <li
                  key={bm.id}
                  className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-3"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={`Foto ${bm.name}`}
                      width={400}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="w-20 h-20 shrink-0 rounded-xl object-cover bg-amber-400"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid place-items-center w-20 h-20 shrink-0 rounded-xl bg-amber-400 text-2xl font-bold text-slate-950"
                    >
                      {bm.name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-950 truncate">{bm.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{bm.code}</p>
                    <p className="mt-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                      {bm.tier}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="self-start">
                      <ConfirmCancelButton
                        label="Hapus"
                        confirmLabel="Hapus"
                        onConfirm={() => handleDelete(bm)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
