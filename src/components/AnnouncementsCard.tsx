import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import {
  getContentStore,
  validateAnnouncement,
  type Announcement
} from '../services/contentStore';
import { useAdmin } from '../hooks/useAdmin';
import { ConfirmCancelButton } from './ConfirmCancelButton';

function formatDateWib(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));
}

const MAX_VISIBLE = 3;

export const AnnouncementsCard: React.FC = () => {
  const { isAdmin, auth } = useAdmin();
  const [items, setItems] = useState<Announcement[]>([]);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      setItems(await getContentStore().listAnnouncements());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Tanpa pengumuman dan bukan admin: kartu tidak perlu tampil.
  if (items.length === 0 && !isAdmin) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAnnouncement({ title, body });
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getContentStore().addAnnouncement({ title, body }, auth);
      setTitle('');
      setBody('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengumuman.');
    } finally {
      setBusy(false);
    }
  };

  const visible = showAll ? items : items.slice(0, MAX_VISIBLE);

  return (
    <section
      aria-labelledby="pengumuman-title"
      className="w-full lg:flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="pengumuman-title" className="flex items-center gap-2 text-base font-bold text-slate-950">
          <Megaphone className="w-4 h-4 text-amber-600" />
          Pengumuman
        </h2>
        {isAdmin && !formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-amber-700 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleAdd} className="mt-4 space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
          <input
            aria-label="Judul pengumuman"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul, mis. Rapat bulanan Jumat 09:00"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <textarea
            aria-label="Isi pengumuman"
            value={body}
            maxLength={1000}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Isi pengumuman (opsional)"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setError(null);
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Menyimpan…' : 'Terbitkan'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Belum ada pengumuman.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {visible.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {formatDateWib(item.createdAt)}
                </span>
              </div>
              {item.body && (
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{item.body}</p>
              )}
              {isAdmin && (
                <div className="mt-1">
                  <ConfirmCancelButton
                    label="Hapus"
                    confirmLabel="Ya, hapus"
                    onConfirm={async () => {
                      await getContentStore().deleteAnnouncement(item.id, auth);
                      await load();
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-xs font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
        >
          {showAll ? 'Tampilkan lebih sedikit' : `Lihat semua (${items.length})`}
        </button>
      )}
    </section>
  );
};
