import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Repeat } from 'lucide-react';
import {
  getContentStore,
  validateAnnouncement,
  type Announcement
} from '../services/contentStore';
import { useAdmin } from '../hooks/useAdmin';
import { ConfirmCancelButton } from './ConfirmCancelButton';
import { useToast } from '../hooks/useToast';
import { WEEKDAY_NAMES, repeatLabel } from '../data/recurringAnnouncements';
import { todayInJakarta } from '../utils/schedule';

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

export const AnnouncementsCard: React.FC<{ className?: string; onLoaded?: (count: number) => void }> = ({
  className,
  onLoaded
}) => {
  const { isAdmin, auth } = useAdmin();
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [repeatWeekday, setRepeatWeekday] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const [loaded, setLoaded] = useState<boolean>(false);

  const load = useCallback(async () => {
    let list: Announcement[] = [];
    try {
      list = await getContentStore().listAnnouncements();
    } catch {
      list = [];
    }
    setItems(list);
    setLoaded(true);
    onLoaded?.(list.length);
  }, [onLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pengunjung biasa: kartu tidak tampil bila belum ada pengumuman.
  if (!loaded || (items.length === 0 && !isAdmin)) return null;
  const today = todayInJakarta();

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
      await getContentStore().addAnnouncement({ title, body, repeatWeekday: repeatWeekday || null }, auth);
      setTitle('');
      setBody('');
      setRepeatWeekday(0);
      setFormOpen(false);
      await load();
      toast('Pengumuman diterbitkan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengumuman.');
    } finally {
      setBusy(false);
    }
  };

  // Pengumuman mingguan di atas, lalu pengumuman biasa terbaru.
  const ordered = [...items.filter((a) => a.repeatWeekday), ...items.filter((a) => !a.repeatWeekday)];
  const visible = showAll ? ordered : ordered.slice(0, MAX_VISIBLE);

  return (
    <section
      aria-labelledby="pengumuman-title"
      className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="pengumuman-title" className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
          </span>
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
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            Ulangi
            <select
              aria-label="Ulangi pengumuman"
              value={repeatWeekday}
              onChange={(e) => setRepeatWeekday(Number(e.target.value))}
              className="px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value={0}>Tidak (sekali)</option>
              {WEEKDAY_NAMES.slice(1).map((d, i) => (
                <option key={d} value={i + 1}>
                  Setiap {d}
                </option>
              ))}
            </select>
          </label>
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
        <p className="mt-3 text-sm text-slate-500">Belum ada pengumuman. Pengunjung tidak melihat kartu ini sampai ada pengumuman.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {visible.map((item) => (
            <li key={item.id} className="py-3">
              {item.repeatWeekday ? (
                (() => {
                  const { label, isToday } = repeatLabel(item.repeatWeekday, today);
                  return (
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
                        <Repeat className={`h-3.5 w-3.5 ${isToday ? 'text-amber-600' : 'text-slate-400'}`} aria-hidden="true" />
                        {item.title}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isToday ? 'bg-amber-400 text-slate-950' : 'bg-stone-100 text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          {label}
                        </span>
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateWib(item.createdAt)}</span>
                </div>
              )}
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
