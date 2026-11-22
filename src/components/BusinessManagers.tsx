import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Plus, Upload } from 'lucide-react';
import {
  BM_TIER_OPTIONS,
  BUSINESS_MANAGERS,
  groupByUnit,
  isPrincipal,
  normalizeTier,
  validateBusinessManager,
  type BusinessManager
} from '../data/businessManagers';
import { getContentStore } from '../services/contentStore';
import { useAdmin } from '../hooks/useAdmin';
import { resizeImageToDataUrl } from '../utils/imageResize';
import { SectionHeading } from './SectionHeading';
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
      <ul className="mt-3 flex flex-wrap justify-center gap-3">{principals.map((p) => renderCard(p))}</ul>
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
  /** Diisi = mode edit BM yang sudah ada. */
  editing?: BusinessManager | null;
}> = ({ existing, onDone, onCancel, initialTier, editing }) => {
  const { auth } = useAdmin();
  const [name, setName] = useState<string>(editing?.name ?? '');
  const [code, setCode] = useState<string>(editing?.code ?? '');
  const [tier, setTier] = useState<string>(editing?.tier ?? initialTier);
  const principal = isPrincipal({ tier });
  const [photoUrl, setPhotoUrl] = useState<string | null>(editing?.photoUrl ?? null);
  const preview = photoUrl || (editing ? photoFor(editing) : undefined);
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
    const finalTier = normalizeTier(tier);
    const others = editing ? existing.filter((m) => m.id !== editing.id) : existing;
    const validation = validateBusinessManager({ name, code, tier: finalTier }, others);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) await getContentStore().updateBusinessManager(editing.id, { name, code, tier: finalTier, photoUrl }, auth);
      else await getContentStore().addBusinessManager({ name, code, tier: finalTier, photoUrl }, auth);
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
        {preview ? (
          <img src={preview} alt="Pratinjau foto BM" className="w-full h-full object-cover" />
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
        {/* Unit bebas diketik (unit Brighton sangat banyak); daftar hanya saran. */}
        <input
          aria-label="Unit BM"
          list="bm-unit-options"
          value={tier}
          maxLength={40}
          onChange={(e) => setTier(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Unit, mis. Brighton Eagle"
          className={`${inputClass} [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-list-button]:hidden`}
        />
        <datalist id="bm-unit-options">
          {[...new Set([...BM_TIER_OPTIONS, ...existing.map((m) => m.tier)])].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <div className="sm:col-span-3 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-xs font-semibold text-red-700">{error}</p>
          ) : (
            <p className="text-[11px] text-slate-500">
              {editing ? `Edit ${editing.name} · klik foto untuk mengganti.` : 'Foto otomatis dipotong persegi 400×400.'}
            </p>
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
              {busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : principal ? 'Simpan Principal' : 'Simpan BM'}
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
  const [editingBm, setEditingBm] = useState<BusinessManager | null>(null);
  const formOpen = formTier !== null;
  const setFormOpen = (open: boolean, tier = 'Brighton Warrior') => {
    setFormTier(open ? tier : null);
    if (!open) setEditingBm(null);
  };
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
  const units = groupByUnit<BusinessManager>(bms);

  /** Kartu BM tegak: foto besar, label unit, nama & kode. */
  const renderCard = (bm: BusinessManager, unit?: string) => {
    const photo = photoFor(bm);
    return (
      <li
        key={bm.id}
        className="w-[calc(25%-6px)] sm:w-[calc(20%-10px)] lg:w-[calc(11.111%-11px)] overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {photo ? (
          <img
            src={photo}
            alt={`Foto ${bm.name}`}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full object-cover object-top bg-slate-900"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid aspect-square w-full place-items-center bg-slate-900 text-2xl font-bold text-white"
          >
            {bm.name.charAt(0)}
          </span>
        )}
        <div className="px-1.5 py-1.5 sm:px-2.5 sm:py-2">
          {unit && (
            <p
              translate="no"
              title={`Brighton ${unit}`}
              className="notranslate truncate text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700"
            >
              {unit}
            </p>
          )}
          <p translate="no" title={bm.name} className="notranslate mt-0.5 line-clamp-2 break-words text-[11px] leading-tight sm:text-[13px] font-bold text-slate-950">{bm.name}</p>
          <p className="font-mono text-[10px] sm:text-[11px] text-slate-500">{bm.code}</p>
          {isAdmin && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <button
                type="button"
                onClick={() => {
                  setEditingBm(bm);
                  setFormTier(bm.tier);
                  document.getElementById('business-manager')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-bold text-slate-700 hover:text-slate-950 cursor-pointer"
              >
                Edit
              </button>
              <ConfirmCancelButton label="Hapus" confirmLabel="Hapus" onConfirm={() => handleDelete(bm)} />
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <section id="business-manager" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <SectionHeading
          overline="Pimpinan unit"
          title="Business Manager"
          action={
            isAdmin && !formOpen ? (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah BM
              </button>
            ) : null
          }
        />

        {isAdmin && formOpen && (
          <AddBmForm
            key={editingBm?.id ?? formTier}
            editing={editingBm}
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
          // Semua BM dalam satu grid rapi (urut per unit); nama unit tampil di tiap kartu.
          <ul className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            {units.flatMap(({ unit, members }) => members.map((bm) => renderCard(bm, unit)))}
          </ul>
        )}
      </div>
    </section>
  );
};
