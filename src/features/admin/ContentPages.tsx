import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cake, Music, Pause, Play, Plus, Upload } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { getJingleStore, JINGLES_CHANGED_EVENT } from '../../services/jingleStore';
import { resolveJingleUrl, titleFromFileName, validateJingleFile, type Jingle } from '../../data/jingles';
import { getBirthdayStore } from '../../services/birthdayStore';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { readTableFile } from '../floortime/spreadsheet';
import { MONTH_NAMES_ID } from '../floortime/engine';
import { todayInJakarta } from '../../utils/schedule';
import {
  compareBirthday,
  parseBirthDate,
  parseBirthdayRows,
  type AgentBirthday,
  type ParseResult
} from '../birthdays/birthdays';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'bg-white border border-slate-200 rounded-2xl p-5 sm:p-6';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';

const PageFrame: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({
  title,
  description,
  children
}) => (
  <section className="bg-stone-50 min-h-[70vh]">
    <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <p className="text-xs text-slate-500">Konten portal</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </div>
  </section>
);

/** Menu admin: daftar jingle yang diputar di portal. */
export const JinglePage: React.FC = () => (
  <PageFrame title="Jingle Brighton" description="Lagu di daftar ini diputar bergantian di portal. Tambahkan jingle baru atau hapus yang sudah tidak berlaku.">
    <JingleManager />
  </PageFrame>
);

/** Menu admin: data ulang tahun agen untuk pengingat beranda. */
export const BirthdayPage: React.FC = () => (
  <PageFrame title="Ulang tahun agen" description="Data untuk pengingat ulang tahun hari ini dan besok di beranda.">
    <BirthdayManager />
  </PageFrame>
);

/* ------------------------------------------------------------------ */

const JingleManager: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getJingleStore();
  const [tracks, setTracks] = useState<Jingle[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      setTracks(await store.list());
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal memuat daftar jingle.' });
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = async (text: string) => {
    await load();
    window.dispatchEvent(new Event(JINGLES_CHANGED_EVENT));
    setMessage(null);
    toast(text);
  };

  const pickFile = (f: File | undefined) => {
    setMessage(null);
    if (!f) return;
    const problem = validateJingleFile(f, store.maxBytes);
    if (problem) {
      setFile(null);
      setMessage({ ok: false, text: problem });
      return;
    }
    setFile(f);
    setTitle(titleFromFileName(f.name));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setMessage({ ok: false, text: 'Pilih file lagu terlebih dahulu.' });
    if (!title.trim()) return setMessage({ ok: false, text: 'Judul jingle wajib diisi.' });
    setBusy(true);
    setMessage(null);
    try {
      await store.add({ title, file }, auth);
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await changed(`"${title.trim()}" ditambahkan ke daftar jingle.`);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal mengunggah jingle.' });
    } finally {
      setBusy(false);
    }
  };

  const togglePreview = (t: Jingle) => {
    const audio = previewRef.current;
    if (!audio) return;
    if (previewId === t.id) {
      audio.pause();
      setPreviewId(null);
      return;
    }
    audio.src = resolveJingleUrl(t.url, import.meta.env?.BASE_URL ?? '');
    void audio.play().catch(() => setPreviewId(null));
    setPreviewId(t.id);
  };

  return (
    <section className={card} aria-labelledby="jingle-title">
      <audio ref={previewRef} onEnded={() => setPreviewId(null)} />
      <h2 id="jingle-title" className="flex items-center gap-2 text-base font-bold text-slate-950">
        <Music className="w-4 h-4 text-amber-600" aria-hidden="true" />
        Tambah jingle
      </h2>

      <form onSubmit={handleAdd} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end" noValidate>
        <label className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-stone-50 px-4 py-3 cursor-pointer hover:border-amber-400">
          <Upload className="w-5 h-5 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800">{file ? file.name : 'Pilih file lagu'}</span>
            <span className="block text-xs text-slate-500">
              mp3/m4a/wav/ogg, maks. {Math.round(store.maxBytes / 1024 / 1024)} MB
            </span>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.mpeg,.m4a,.wav,.ogg"
            aria-label="File jingle"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Judul jingle
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mis. Rise and Multiply"
            maxLength={100}
            className={`${input} mt-1`}
          />
        </label>
        <button type="submit" disabled={busy || !file} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          {busy ? 'Mengunggah…' : 'Tambah jingle'}
        </button>
      </form>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}
        >
          {message.text}
        </p>
      )}

      <p className="mt-5 text-sm font-bold text-slate-950">{tracks.length} jingle aktif</p>
      {tracks.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Belum ada jingle. Pemutar tidak tampil di portal.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {tracks.map((t, i) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => togglePreview(t)}
                  aria-label={previewId === t.id ? `Hentikan ${t.title}` : `Dengarkan ${t.title}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                >
                  {previewId === t.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
                </button>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {i + 1}. {t.title}
                  </span>
                  <span className="block text-xs text-slate-500">{t.url.startsWith('jingles/') ? 'Bawaan portal' : 'Unggahan admin'}</span>
                </span>
              </span>
              <ConfirmCancelButton
                label="Hapus"
                confirmLabel="Ya, hapus"
                onConfirm={async () => {
                  if (previewId === t.id) previewRef.current?.pause();
                  try {
                    await store.remove(t, auth);
                    await changed(`"${t.title}" dihapus dari daftar jingle.`);
                  } catch (err) {
                    setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal menghapus jingle.' });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */

const BirthdayManager: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getBirthdayStore();
  const currentMonth = Number(todayInJakarta().slice(5, 7));
  const [month, setMonth] = useState<number>(currentMonth);
  const [list, setList] = useState<AgentBirthday[]>([]);
  const [preview, setPreview] = useState<(ParseResult & { fileName: string }) | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [manual, setManual] = useState({ code: '', name: '', date: '' });

  const load = useCallback(async () => {
    try {
      setList(await store.list());
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal memuat data ulang tahun.' });
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await load();
      toast(success);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Gagal menyimpan.' });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const result = parseBirthdayRows(await readTableFile(file));
      setPreview({ ...result, fileName: file.name });
      const months = [...new Set(result.entries.map((e) => e.month))];
      if (months.length === 1) setMonth(months[0]);
    } catch (err) {
      setPreview(null);
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'File tidak dapat dibaca.' });
    }
  };

  const handleManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manual.code.trim().toUpperCase();
    const name = manual.name.trim();
    const date = parseBirthDate(manual.date);
    if (!/^[A-Z0-9]{2,12}$/.test(code)) return setMessage({ ok: false, text: 'Kode agen 2–12 huruf/angka.' });
    if (!name) return setMessage({ ok: false, text: 'Nama panggilan wajib diisi.' });
    if (!date) return setMessage({ ok: false, text: 'Tanggal lahir tidak terbaca. Contoh: 15-Nov-79 atau 15/11/1979.' });
    void run(async () => {
      await store.upsert([{ code, name: name.includes(`(${code})`) ? name : `${name} (${code})`, ...date }], auth);
      setManual({ code: '', name: '', date: '' });
      setMonth(date.month);
    }, 'Data ulang tahun disimpan.');
  };

  const perMonth = new Map<number, number>();
  for (const b of list) perMonth.set(b.month, (perMonth.get(b.month) ?? 0) + 1);
  const monthList = list.filter((b) => b.month === month).sort(compareBirthday);

  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
        <Cake className="w-4 h-4 text-amber-600" aria-hidden="true" />
        Unggah data ulang tahun
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Unggah ekspor bulanan (kolom <b>Code</b>, <b>Nama Panggilan</b>, <b>Tgl Lahir</b>) dalam .csv atau .xlsx. Beranda
        menampilkan agen yang berulang tahun hari ini dan besok. Tahun lahir tidak disimpan.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-stone-50 p-5 text-center cursor-pointer hover:border-amber-400">
          <Upload className="w-5 h-5 text-slate-500" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-800">Pilih file ulang tahun</span>
          <span className="text-xs text-slate-500">.csv atau .xlsx</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            aria-label="File ulang tahun agen"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>

        <form onSubmit={handleManual} className="rounded-xl ring-1 ring-slate-200 p-4 space-y-2" noValidate>
          <p className="text-sm font-semibold text-slate-800">Tambah satu agen</p>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <input
              aria-label="Kode agen"
              placeholder="Kode"
              value={manual.code}
              onChange={(e) => setManual({ ...manual, code: e.target.value })}
              className={input}
            />
            <input
              aria-label="Nama panggilan"
              placeholder="Nama panggilan"
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
              className={input}
            />
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Tanggal lahir"
              placeholder="Tgl lahir, mis. 15-Nov-79"
              value={manual.date}
              onChange={(e) => setManual({ ...manual, date: e.target.value })}
              className={input}
            />
            <button type="submit" disabled={busy} className={`${primaryBtn} shrink-0`}>
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </div>
        </form>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}
        >
          {message.text}
        </p>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {preview.fileName}: {preview.entries.length} agen siap disimpan
            {preview.skipped.length > 0 && `, ${preview.skipped.length} baris dilewati`}
          </p>
          {preview.skipped.length > 0 && (
            <ul className="mt-1 text-xs text-red-800 list-disc pl-5">
              {preview.skipped.slice(0, 5).map((s) => (
                <li key={s.line}>
                  Baris {s.line}: {s.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-white ring-1 ring-amber-200">
            <table className="w-full text-sm">
              <tbody>
                {preview.entries.map((e) => (
                  <tr key={e.code} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-1.5 w-24 tabular-nums text-slate-600">
                      {e.day} {MONTH_NAMES_ID[e.month - 1].slice(0, 3)}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{e.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy || preview.entries.length === 0}
              onClick={() =>
                void run(async () => {
                  await store.upsert(preview.entries, auth);
                  setPreview(null);
                }, `${preview.entries.length} data ulang tahun disimpan.`)
              }
              className={primaryBtn}
            >
              Simpan {preview.entries.length} data
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <div role="tablist" aria-label="Pilih bulan" className="flex gap-1.5 overflow-x-auto pb-1">
          {MONTH_NAMES_ID.map((name, i) => {
            const m = i + 1;
            const count = perMonth.get(m) ?? 0;
            const active = m === month;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMonth(m)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  active ? 'bg-slate-950 text-white' : 'bg-stone-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {name.slice(0, 3)}
                {count > 0 && <span className={active ? 'text-amber-300' : 'text-slate-400'}> · {count}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-950">
            {MONTH_NAMES_ID[month - 1]} · {monthList.length} agen
          </p>
          {monthList.length > 0 && (
            <ConfirmCancelButton
              label={`Hapus semua ${MONTH_NAMES_ID[month - 1]}`}
              confirmLabel="Ya, hapus"
              onConfirm={() => run(() => store.removeMonth(month, auth), `Data ${MONTH_NAMES_ID[month - 1]} dihapus.`)}
            />
          )}
        </div>
        {monthList.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada data ulang tahun untuk bulan ini.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {monthList.map((b) => (
              <li key={b.code} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-14 shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-amber-700">
                    {b.day} {MONTH_NAMES_ID[b.month - 1].slice(0, 3)}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-900">{b.name}</span>
                </span>
                <ConfirmCancelButton
                  label="Hapus"
                  confirmLabel="Ya, hapus"
                  onConfirm={() => run(() => store.remove(b.code, auth), `${b.name} dihapus.`)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
