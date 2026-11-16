import React, { useCallback, useEffect, useState } from 'react';
import { FileText, ExternalLink, Plus } from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  getContentStore,
  validateDocument,
  type OfficeDocument
} from '../services/contentStore';
import { useAdmin } from '../hooks/useAdmin';
import { ConfirmCancelButton } from './ConfirmCancelButton';

export const OfficeDocuments: React.FC = () => {
  const { isAdmin, auth } = useAdmin();
  const [docs, setDocs] = useState<OfficeDocument[]>([]);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      setDocs(await getContentStore().listDocuments());
    } catch {
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateDocument({ title, url });
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getContentStore().addDocument({ title, url, category }, auth);
      setTitle('');
      setUrl('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan dokumen.');
    } finally {
      setBusy(false);
    }
  };

  const grouped = DOCUMENT_CATEGORIES.map((cat) => ({
    category: cat,
    items: docs.filter((d) => d.category === cat)
  })).filter((g) => g.items.length > 0);

  return (
    <section id="dokumen" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Dokumen & formulir
            </h2>
            <p className="mt-2 text-base text-slate-600 max-w-xl">
              SOP, template, dan formulir kantor yang sering dipakai advisor.
            </p>
          </div>
          {isAdmin && !formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg self-start cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah dokumen
            </button>
          )}
        </div>

        {formOpen && (
          <form
            onSubmit={handleAdd}
            className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-3 rounded-2xl border border-dashed border-slate-300 p-4"
          >
            <input
              aria-label="Nama dokumen"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nama dokumen, mis. Template PPJB"
              className="sm:col-span-4 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            />
            <input
              aria-label="Tautan dokumen"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              className="sm:col-span-5 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            />
            <select
              aria-label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="sm:col-span-3 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="sm:col-span-12 flex items-center justify-between gap-3">
              {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : <span />}
              <div className="flex gap-2">
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
                  {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          </form>
        )}

        {docs.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-stone-50 p-5 text-sm text-slate-600">
            Belum ada dokumen. {isAdmin ? 'Tambahkan tautan dokumen (mis. Google Drive) dengan tombol di atas.' : 'Hubungi Operasional jika membutuhkan dokumen tertentu.'}
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {grouped.map((group) => (
              <div key={group.category}>
                <h3 className="text-xs font-semibold text-amber-700">{group.category}</h3>
                <ul className="mt-2 space-y-2">
                  {group.items.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900 hover:text-amber-700"
                      >
                        <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="truncate">{doc.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                      </a>
                      {isAdmin && (
                        <ConfirmCancelButton
                          label="Hapus"
                          confirmLabel="Hapus"
                          onConfirm={async () => {
                            await getContentStore().deleteDocument(doc.id, auth);
                            await load();
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
