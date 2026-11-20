import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Lightbulb,
  ListChecks,
  Palette,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { getNotesStore, validateLabel } from './notesStore';
import {
  EMPTY_DRAFT,
  NOTE_COLORS,
  colorOf,
  filterNotes,
  isEmptyDraft,
  linkify,
  newItemId,
  noteCopyText,
  sortNotes,
  toChecklist,
  toText,
  type Note,
  type NoteDraft,
  type NoteLabel,
  type NoteStatus,
  type NotesView
} from './notes';

const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-900/10 hover:text-slate-950 cursor-pointer disabled:opacity-40';

const draftOf = (n: Note): NoteDraft => ({
  title: n.title,
  body: n.body,
  isChecklist: n.isChecklist,
  items: n.items,
  color: n.color,
  labelIds: n.labelIds,
  pinned: n.pinned
});

/** Halaman Notes: catatan ala Google Keep, khusus admin, tanpa terjemahan. */
export const NotesPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getNotesStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<NoteLabel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [view, setView] = useState<NotesView>({ kind: 'notes' });
  const [editing, setEditing] = useState<Note | null>(null);
  const [labelsOpen, setLabelsOpen] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      const [n, l] = await Promise.all([store.list(auth), store.listLabels(auth)]);
      setNotes(n);
      setLabels(l);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat Notes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [store, auth, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Ubah catatan: tampilan langsung berubah, lalu disimpan ke server. */
  const patch = async (id: string, change: Partial<NoteDraft> & { status?: NoteStatus }, message?: string) => {
    const now = new Date().toISOString();
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...change, updatedAt: now } : n)));
    try {
      await store.update(id, change, auth);
      if (message) toast(message);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan catatan.', 'error');
      void load();
    }
  };

  const create = async (draft: NoteDraft) => {
    if (isEmptyDraft(draft)) return;
    try {
      const note = await store.create(draft, auth);
      setNotes((list) => [...list, note]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan catatan.', 'error');
    }
  };

  const copy = async (n: Note) => {
    try {
      await navigator.clipboard.writeText(noteCopyText(n));
      toast('Isi catatan disalin.');
    } catch {
      toast('Tidak bisa menyalin di browser ini.', 'error');
    }
  };

  const shown = useMemo(() => sortNotes(filterNotes(notes, view)), [notes, view]);
  const pinned = view.kind === 'notes' || view.kind === 'label' ? shown.filter((n) => n.pinned) : [];
  const others = view.kind === 'notes' || view.kind === 'label' ? shown.filter((n) => !n.pinned) : shown;
  const currentLabel = view.kind === 'label' ? labels.find((l) => l.id === view.labelId) : undefined;

  const navItems: { key: string; label: string; icon: React.ReactNode; view: NotesView }[] = [
    { key: 'notes', label: 'Catatan', icon: <Lightbulb className="h-4 w-4" />, view: { kind: 'notes' } },
    ...labels.map((l) => ({
      key: l.id,
      label: l.name,
      icon: <Tag className="h-4 w-4" />,
      view: { kind: 'label', labelId: l.id } as NotesView
    })),
    { key: 'archive', label: 'Arsip', icon: <Archive className="h-4 w-4" />, view: { kind: 'archive' } },
    { key: 'trash', label: 'Sampah', icon: <Trash2 className="h-4 w-4" />, view: { kind: 'trash' } }
  ];
  const isActive = (v: NotesView) =>
    v.kind === view.kind && (v.kind !== 'label' || (view.kind === 'label' && v.labelId === view.labelId));

  const cardProps = {
    labels,
    onOpen: (n: Note) => setEditing(n),
    onPatch: patch,
    onCopy: copy,
    onRemove: async (n: Note) => {
      setNotes((list) => list.filter((x) => x.id !== n.id));
      try {
        await store.remove(n.id, auth);
        toast('Catatan dihapus permanen.');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Gagal menghapus.', 'error');
        void load();
      }
    }
  };

  return (
    <section translate="no" className="notranslate bg-stone-50 min-h-[75vh]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:flex lg:gap-8">
        {/* Navigasi: kolom kiri di laptop, deretan geser di HP */}
        <nav aria-label="Navigasi Notes" className="lg:w-56 lg:shrink-0">
          <h1 className="mb-3 text-2xl font-bold text-slate-950">Notes</h1>
          <ul className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible">
            {navItems.map((item) => (
              <li key={item.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setView(item.view)}
                  aria-current={isActive(item.view) ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-full px-3.5 py-2 text-left text-sm font-semibold cursor-pointer lg:rounded-r-full lg:rounded-l-none lg:-ml-4 lg:pl-5 ${
                    isActive(item.view) ? 'bg-amber-100 text-amber-950' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 lg:bg-transparent lg:ring-0'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            ))}
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setLabelsOpen(true)}
                className="flex w-full items-center gap-3 rounded-full bg-white px-3.5 py-2 text-left text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 cursor-pointer lg:rounded-r-full lg:rounded-l-none lg:-ml-4 lg:pl-5 lg:bg-transparent lg:ring-0"
              >
                <Pencil className="h-4 w-4" />
                Edit label
              </button>
            </li>
          </ul>
        </nav>

        <div className="mt-4 min-w-0 flex-1 lg:mt-0">
          {(view.kind === 'notes' || view.kind === 'label') && (
            <Composer
              labels={labels}
              defaultLabelIds={view.kind === 'label' ? [view.labelId] : []}
              onSave={create}
            />
          )}

          {view.kind === 'trash' && shown.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <p>Catatan di sampah tidak terhapus otomatis. Hapus permanen hanya lewat tombol di bawah.</p>
              <ConfirmCancelButton
                label="Kosongkan sampah"
                confirmLabel={`Ya, hapus ${shown.length} catatan`}
                onConfirm={async () => {
                  await store.emptyTrash(auth);
                  setNotes((list) => list.filter((n) => n.status !== 'trashed'));
                  toast('Sampah dikosongkan.');
                }}
              />
            </div>
          )}

          {loading ? (
            <p className="py-16 text-center text-sm text-slate-500">Memuat catatan…</p>
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              {view.kind === 'archive'
                ? 'Belum ada catatan yang diarsipkan.'
                : view.kind === 'trash'
                  ? 'Sampah kosong.'
                  : currentLabel
                    ? `Belum ada catatan berlabel "${currentLabel.name}".`
                    : 'Catatan yang Anda buat akan muncul di sini.'}
            </p>
          ) : (
            <div className="space-y-6">
              {pinned.length > 0 && (
                <NoteGrid title="Disematkan" notes={pinned} trash={false} {...cardProps} />
              )}
              {others.length > 0 && (
                <NoteGrid
                  title={pinned.length > 0 ? 'Lainnya' : undefined}
                  notes={others}
                  trash={view.kind === 'trash'}
                  {...cardProps}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditDialog
          note={editing}
          labels={labels}
          onClose={(draft) => {
            const before = draftOf(editing);
            setEditing(null);
            if (JSON.stringify(before) !== JSON.stringify(draft)) {
              if (isEmptyDraft(draft)) void patch(editing.id, { ...draft, status: 'trashed' }, 'Catatan kosong dipindah ke sampah.');
              else void patch(editing.id, draft);
            }
          }}
        />
      )}

      {labelsOpen && (
        <LabelsDialog
          labels={labels}
          onClose={() => setLabelsOpen(false)}
          onAdd={async (name) => {
            const label = await store.addLabel(name, auth);
            setLabels((l) => [...l, label].sort((a, b) => a.name.localeCompare(b.name, 'id')));
          }}
          onRename={async (id, name) => {
            await store.renameLabel(id, name, auth);
            setLabels((l) => l.map((x) => (x.id === id ? { ...x, name: name.trim() } : x)));
          }}
          onRemove={async (id) => {
            await store.removeLabel(id, auth);
            setLabels((l) => l.filter((x) => x.id !== id));
            setNotes((list) => list.map((n) => ({ ...n, labelIds: n.labelIds.filter((x) => x !== id) })));
            if (view.kind === 'label' && view.labelId === id) setView({ kind: 'notes' });
          }}
        />
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ grid & kartu */

interface CardActions {
  labels: NoteLabel[];
  onOpen: (n: Note) => void;
  onPatch: (id: string, change: Partial<NoteDraft> & { status?: NoteStatus }, message?: string) => Promise<void>;
  onCopy: (n: Note) => Promise<void>;
  onRemove: (n: Note) => Promise<void>;
}

const NoteGrid: React.FC<CardActions & { title?: string; notes: Note[]; trash: boolean }> = ({ title, notes, trash, ...actions }) => (
  <div>
    {title && <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p>}
    <ul className="columns-1 gap-3 sm:columns-2 xl:columns-3">
      {notes.map((n) => (
        <li key={n.id} className="mb-3 break-inside-avoid">
          <NoteCard note={n} trash={trash} {...actions} />
        </li>
      ))}
    </ul>
  </div>
);

const LinkedText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {linkify(text).map((p, i) =>
      p.href ? (
        <a
          key={i}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="break-all text-slate-900 underline decoration-slate-400 underline-offset-2 hover:decoration-slate-900"
        >
          {p.text}
        </a>
      ) : (
        <React.Fragment key={i}>{p.text}</React.Fragment>
      )
    )}
  </>
);

const NoteCard: React.FC<CardActions & { note: Note; trash: boolean }> = ({
  note,
  trash,
  labels,
  onOpen,
  onPatch,
  onCopy,
  onRemove
}) => {
  const color = colorOf(note.color);
  const noteLabels = labels.filter((l) => note.labelIds.includes(l.id));
  const open = note.items.filter((i) => !i.done);
  const done = note.items.filter((i) => i.done);
  const toggleItem = (id: string) =>
    void onPatch(note.id, { items: note.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) });

  return (
    <article
      className={`group relative rounded-xl ring-1 ring-slate-200 transition hover:shadow-md ${color.card} ${trash ? '' : 'cursor-pointer'}`}
      onClick={() => !trash && onOpen(note)}
    >
      {!trash && (
        <button
          type="button"
          aria-label={note.pinned ? 'Lepas sematan' : 'Sematkan'}
          title={note.pinned ? 'Lepas sematan' : 'Sematkan'}
          onClick={(e) => {
            e.stopPropagation();
            void onPatch(note.id, { pinned: !note.pinned });
          }}
          className={`absolute right-1.5 top-1.5 ${iconBtn} ${note.pinned ? 'text-slate-900' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}
        >
          <Pin className={`h-4 w-4 ${note.pinned ? 'fill-current' : ''}`} />
        </button>
      )}

      <div className="px-4 pt-3 pb-1">
        {note.title && <h3 className="pr-8 text-base font-semibold text-slate-950 break-words">{note.title}</h3>}
        {note.isChecklist ? (
          <ul className={`${note.title ? 'mt-2' : 'pr-8'} space-y-1 text-sm text-slate-800`}>
            {open.slice(0, 12).map((i) => (
              <li key={i.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={trash}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleItem(i.id)}
                  aria-label={`Tandai selesai: ${i.text}`}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900 cursor-pointer"
                />
                <span className="break-words">
                  <LinkedText text={i.text} />
                </span>
              </li>
            ))}
            {open.length > 12 && <li className="text-xs text-slate-500">… {open.length - 12} item lagi</li>}
            {done.length > 0 && (
              <li className="pt-1 text-xs font-semibold text-slate-500">
                {done.length} item selesai
              </li>
            )}
          </ul>
        ) : (
          note.body && (
            <p className={`${note.title ? 'mt-2' : 'pr-8'} max-h-[420px] overflow-hidden whitespace-pre-wrap break-words text-sm text-slate-800`}>
              <LinkedText text={note.body} />
            </p>
          )
        )}
        {noteLabels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {noteLabels.map((l) => (
              <span key={l.id} className="rounded-full bg-slate-900/[0.07] px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-0.5 px-2 pb-1.5 pt-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {trash ? (
          <>
            <button type="button" className={iconBtn} title="Pulihkan" aria-label="Pulihkan" onClick={() => void onPatch(note.id, { status: 'active' }, 'Catatan dipulihkan.')}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="ml-auto">
              <ConfirmCancelButton label="Hapus selamanya" confirmLabel="Ya, hapus" onConfirm={() => onRemove(note)} />
            </div>
          </>
        ) : (
          <>
            <ColorPicker value={note.color} onChange={(c) => void onPatch(note.id, { color: c })} />
            <LabelPicker
              labels={labels}
              value={note.labelIds}
              onChange={(ids) => void onPatch(note.id, { labelIds: ids })}
            />
            <button type="button" className={iconBtn} title="Salin" aria-label="Salin isi catatan" onClick={() => void onCopy(note)}>
              <Copy className="h-4 w-4" />
            </button>
            {note.status === 'archived' ? (
              <button type="button" className={iconBtn} title="Batal arsip" aria-label="Batal arsip" onClick={() => void onPatch(note.id, { status: 'active' }, 'Catatan dikembalikan.')}>
                <ArchiveRestore className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" className={iconBtn} title="Arsipkan" aria-label="Arsipkan" onClick={() => void onPatch(note.id, { status: 'archived', pinned: false }, 'Catatan diarsipkan.')}>
                <Archive className="h-4 w-4" />
              </button>
            )}
            <button type="button" className={iconBtn} title="Pindah ke sampah" aria-label="Pindah ke sampah" onClick={() => void onPatch(note.id, { status: 'trashed', pinned: false }, 'Catatan dipindah ke sampah.')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </article>
  );
};

/* ------------------------------------------------------------------ pemilih warna & label */

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const ColorPicker: React.FC<{ value: string; onChange: (c: Note['color']) => void }> = ({ value, onChange }) => {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" className={iconBtn} title="Warna" aria-label="Pilih warna" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 grid w-max grid-cols-5 gap-1.5 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.name}
              aria-label={`Warna ${c.name}`}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className={`grid h-7 w-7 place-items-center rounded-full ring-1 cursor-pointer ${c.swatch} ${
                value === c.id ? 'ring-2 ring-slate-900' : 'ring-slate-300'
              }`}
            >
              {value === c.id && <Check className="h-3.5 w-3.5 text-slate-900" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const LabelPicker: React.FC<{ labels: NoteLabel[]; value: string[]; onChange: (ids: string[]) => void }> = ({ labels, value, onChange }) => {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" className={iconBtn} title="Label" aria-label="Pilih label" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Tag className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-56 rounded-xl bg-white py-1.5 shadow-lg ring-1 ring-slate-200">
          <p className="px-3 pb-1 text-xs font-semibold text-slate-500">Label catatan</p>
          {labels.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-slate-500">Belum ada label. Buat lewat "Edit label".</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {labels.map((l) => {
                const on = value.includes(l.id);
                return (
                  <li key={l.id}>
                    <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onChange(on ? value.filter((x) => x !== l.id) : [...value, l.id])}
                        className="h-4 w-4 accent-slate-900"
                      />
                      <span className="truncate">{l.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ editor */

const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
};

const ChecklistEditor: React.FC<{
  draft: NoteDraft;
  setDraft: React.Dispatch<React.SetStateAction<NoteDraft>>;
  pendingRef: React.MutableRefObject<string>;
}> = ({ draft, setDraft, pendingRef }) => {
  const [newText, setNewTextState] = useState('');
  const setNewText = (v: string) => {
    pendingRef.current = v;
    setNewTextState(v);
  };
  const refs = useRef<Map<string, HTMLInputElement>>(new Map());
  const update = (id: string, change: Partial<{ text: string; done: boolean }>) =>
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...change } : i)) }));
  const remove = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
  const [focusId, setFocusId] = useState<string | null>(null);
  // Setelah item baru dibuat, kursor pindah ke item itu (di akhir teks).
  useEffect(() => {
    if (!focusId) return;
    const el = refs.current.get(focusId);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      setFocusId(null);
    }
  }, [focusId, draft.items]);
  const addAfter = (id: string | null, text = '') => {
    const item = { id: newItemId(), text, done: false };
    setDraft((d) => {
      const items = [...d.items];
      const at = id ? items.findIndex((i) => i.id === id) + 1 : items.filter((i) => !i.done).length;
      items.splice(at, 0, item);
      return { ...d, items };
    });
    setFocusId(item.id);
  };
  const open = draft.items.filter((i) => !i.done);
  const done = draft.items.filter((i) => i.done);

  const row = (i: (typeof draft.items)[number]) => (
    <li key={i.id} className="group/item flex items-center gap-2">
      <input
        type="checkbox"
        checked={i.done}
        onChange={() => update(i.id, { done: !i.done })}
        aria-label={i.done ? 'Tandai belum selesai' : 'Tandai selesai'}
        className="h-4 w-4 shrink-0 accent-slate-900 cursor-pointer"
      />
      <input
        ref={(el) => {
          if (el) refs.current.set(i.id, el);
          else refs.current.delete(i.id);
        }}
        value={i.text}
        maxLength={500}
        onChange={(e) => update(i.id, { text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addAfter(i.id);
          } else if (e.key === 'Backspace' && !i.text) {
            e.preventDefault();
            remove(i.id);
          }
        }}
        className={`min-w-0 flex-1 bg-transparent py-1 text-sm outline-none ${i.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}
      />
      <button type="button" aria-label="Hapus item" onClick={() => remove(i.id)} className={`${iconBtn} h-7 w-7 opacity-60 hover:opacity-100`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );

  return (
    <div className="mt-2">
      <ul className="space-y-0.5">{open.map(row)}</ul>
      <div className="flex items-center gap-2 border-y border-transparent focus-within:border-slate-200">
        <Plus className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <input
          value={newText}
          placeholder="Tambah item (Enter untuk simpan)"
          aria-label="Tambah item"
          maxLength={500}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (newText.trim()) {
                const item = { id: newItemId(), text: newText.trim(), done: false };
                setDraft((d) => {
                  const items = [...d.items];
                  items.splice(items.filter((i) => !i.done).length, 0, item);
                  return { ...d, items };
                });
                setNewText('');
              }
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-slate-500"
        />
      </div>
      {done.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <p className="mb-1 text-xs font-semibold text-slate-500">{done.length} item selesai</p>
          <ul className="space-y-0.5">{done.map(row)}</ul>
        </div>
      )}
    </div>
  );
};

/** Item checklist yang masih diketik (belum Enter) ikut disimpan saat catatan ditutup. */
function withPending(d: NoteDraft, pending: string): NoteDraft {
  const text = pending.trim();
  if (!d.isChecklist || !text) return d;
  const item = { id: newItemId(), text, done: false };
  return { ...d, items: [...d.items.filter((i) => !i.done), item, ...d.items.filter((i) => i.done)] };
}

/** Isi editor (dipakai kotak "Buat catatan" dan jendela edit). */
const NoteEditor: React.FC<{
  draft: NoteDraft;
  setDraft: React.Dispatch<React.SetStateAction<NoteDraft>>;
  labels: NoteLabel[];
  onClose: () => void;
  autoFocus?: boolean;
  pendingRef: React.MutableRefObject<string>;
}> = ({ draft, setDraft, labels, onClose, autoFocus, pendingRef }) => {
  const noteLabels = labels.filter((l) => draft.labelIds.includes(l.id));
  return (
    <div className={`relative rounded-xl ${colorOf(draft.color).card}`}>
      <button
        type="button"
        aria-label={draft.pinned ? 'Lepas sematan' : 'Sematkan'}
        title={draft.pinned ? 'Lepas sematan' : 'Sematkan'}
        onClick={() => setDraft((d) => ({ ...d, pinned: !d.pinned }))}
        className={`absolute right-2 top-2 ${iconBtn}`}
      >
        <Pin className={`h-4 w-4 ${draft.pinned ? 'fill-current text-slate-900' : ''}`} />
      </button>
      <div className="px-4 pt-3">
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Judul"
          maxLength={200}
          aria-label="Judul catatan"
          className="w-full bg-transparent pr-10 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-500"
        />
        {draft.isChecklist ? (
          <ChecklistEditor draft={draft} setDraft={setDraft} pendingRef={pendingRef} />
        ) : (
          <AutoTextarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            placeholder="Buat catatan…"
            maxLength={20000}
            autoFocus={autoFocus}
            aria-label="Isi catatan"
            className="mt-2 block max-h-[60vh] w-full resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-500"
          />
        )}
        {noteLabels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {noteLabels.map((l) => (
              <span key={l.id} className="rounded-full bg-slate-900/[0.07] px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-0.5 px-2 pb-2">
        <ColorPicker value={draft.color} onChange={(c) => setDraft((d) => ({ ...d, color: c }))} />
        <LabelPicker labels={labels} value={draft.labelIds} onChange={(ids) => setDraft((d) => ({ ...d, labelIds: ids }))} />
        <button
          type="button"
          className={iconBtn}
          title={draft.isChecklist ? 'Ubah ke teks biasa' : 'Ubah ke checklist'}
          aria-label={draft.isChecklist ? 'Ubah ke teks biasa' : 'Ubah ke checklist'}
          onClick={() => setDraft((d) => (d.isChecklist ? toText(d) : toChecklist(d)))}
        >
          <ListChecks className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-900/10 cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

const Composer: React.FC<{ labels: NoteLabel[]; defaultLabelIds: string[]; onSave: (d: NoteDraft) => Promise<void> }> = ({
  labels,
  defaultLabelIds,
  onSave
}) => {
  const fresh = useCallback((): NoteDraft => ({ ...EMPTY_DRAFT, labelIds: defaultLabelIds }), [defaultLabelIds]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>(fresh);
  const ref = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pendingRef = useRef('');

  const close = useCallback(() => {
    const d = withPending(draftRef.current, pendingRef.current);
    pendingRef.current = '';
    setOpen(false);
    setDraft(fresh());
    void onSave(d);
  }, [fresh, onSave]);

  // Klik di luar kotak = simpan & tutup (seperti Google Keep).
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target) && document.contains(e.target)) {
        close();
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, close]);

  return (
    <div ref={ref} className="mx-auto mb-6 max-w-xl rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {open ? (
        <NoteEditor
          draft={draft}
          setDraft={setDraft}
          labels={labels}
          onClose={close}
          autoFocus={!draft.isChecklist}
          pendingRef={pendingRef}
        />
      ) : (
        <div className="flex items-center gap-1 pl-4 pr-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-1 py-3 text-left text-sm font-semibold text-slate-500 cursor-text"
          >
            Buat catatan…
          </button>
          <button
            type="button"
            className={iconBtn}
            title="Checklist baru"
            aria-label="Checklist baru"
            onClick={() => {
              setDraft({ ...fresh(), isChecklist: true });
              setOpen(true);
            }}
          >
            <ListChecks className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const EditDialog: React.FC<{ note: Note; labels: NoteLabel[]; onClose: (d: NoteDraft) => void }> = ({ note, labels, onClose }) => {
  const [draft, setDraft] = useState<NoteDraft>(() => draftOf(note));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pendingRef = useRef('');
  const closedRef = useRef(false);
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose(withPending(draftRef.current, pendingRef.current));
  }, [onClose]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [close]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit catatan"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-10 sm:py-20"
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200">
        <NoteEditor draft={draft} setDraft={setDraft} labels={labels} onClose={close} pendingRef={pendingRef} />
        <p className="px-4 pb-2 text-right text-[11px] text-slate-500">
          Diubah {new Date(note.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ edit label */

const LabelsDialog: React.FC<{
  labels: NoteLabel[];
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}> = ({ labels, onClose, onAdd, onRename, onRemove }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan label.');
    }
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit label"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-3 py-16"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-950">Edit label</h2>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = validateLabel(name, labels);
            if (problem) return setError(problem);
            void run(async () => {
              await onAdd(name);
              setName('');
            });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Buat label baru"
            maxLength={50}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          <button type="submit" className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-500 cursor-pointer" aria-label="Tambah label">
            <Plus className="h-4 w-4" />
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <ul className="mt-3 max-h-[50vh] divide-y divide-slate-100 overflow-y-auto">
          {labels.map((l) => {
            const value = edits[l.id] ?? l.name;
            const changed = value.trim() !== l.name;
            return (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <Tag className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <input
                  value={value}
                  maxLength={50}
                  aria-label={`Nama label ${l.name}`}
                  onChange={(e) => setEdits((x) => ({ ...x, [l.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-md px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                />
                {changed ? (
                  <button
                    type="button"
                    aria-label="Simpan nama label"
                    className={iconBtn}
                    onClick={() => {
                      const problem = validateLabel(value, labels, l.id);
                      if (problem) return setError(problem);
                      void run(async () => {
                        await onRename(l.id, value);
                        setEdits((x) => {
                          const { [l.id]: _, ...rest } = x;
                          return rest;
                        });
                      });
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <ConfirmCancelButton label="Hapus" confirmLabel="Ya, hapus" onConfirm={() => run(() => onRemove(l.id))} />
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Menghapus label tidak menghapus catatannya.</p>
        <div className="mt-3 text-right">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer">
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
