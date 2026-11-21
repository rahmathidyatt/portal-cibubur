import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CalendarClock, Check, Copy, Pencil, Plus, Send, Users, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { todayInJakarta } from '../../utils/schedule';
import { getTrainingStore } from '../training/trainingStore';
import { buildReminderBc, buildTrainingBc, defaultDeadline, greetingForHour, type TrainingAgent, type TrainingBatch } from '../training/training';
import { getBcStore } from './bcStore';
import { enablePush, getPushState, type PushState } from './push';
import {
  REPEAT_LABEL,
  formatWibDateTime,
  isDue,
  normalizePhone,
  sortSchedules,
  validateBc,
  waSendLink,
  wibIso,
  wibParts,
  type BcDraft,
  type BcRepeat,
  type BcSchedule,
  type BcTarget
} from './bc';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'bg-white border border-slate-200 rounded-2xl p-5 sm:p-6';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';
const ghostBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-50';

const KIND_LABEL: Record<BcSchedule['kind'], string> = {
  manual: '',
  'training-reminder': 'Otomatis · Training',
  'training-group': 'Otomatis · Training'
};

const jakartaHour = () => Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }));

/** Isi pesan: BC training dibuat dari data training terbaru, BC biasa dari isian admin. */
function messageOf(s: BcSchedule, agents: TrainingAgent[] | null, batch: TrainingBatch | null): string {
  if (s.kind === 'manual') return s.message;
  if (!agents) return '';
  const greeting = greetingForHour(jakartaHour());
  const start = s.sourceKey?.split(':')[1] ?? batch?.start ?? '';
  const nextBatch = batch ?? (start ? { start, end: start } : null);
  if (s.kind === 'training-reminder') return buildReminderBc(agents, { greeting, nextBatch });
  return buildTrainingBc(agents, {
    batchDate: start || undefined,
    nextBatch,
    deadline: defaultDeadline(start || undefined, todayInJakarta()),
    deadlineTime: '17.00',
    greeting
  });
}

const EMPTY: { title: string; message: string; targetId: string; date: string; time: string; repeat: BcRepeat } = {
  title: '',
  message: '',
  targetId: '',
  date: '',
  time: '09:00',
  repeat: 'none'
};

/** Menu admin "BC Terjadwal": siapkan BC, lalu kirim dengan satu sentuhan saat waktunya tiba. */
export const BcSchedulePage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getBcStore();
  const [list, setList] = useState<BcSchedule[] | null>(null);
  const [targets, setTargets] = useState<BcTarget[]>([]);
  const [agents, setAgents] = useState<TrainingAgent[] | null>(null);
  const [batch, setBatch] = useState<TrainingBatch | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<BcSchedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [push, setPush] = useState<PushState | null>(null);

  const load = useCallback(async () => {
    try {
      const training = getTrainingStore();
      const [b, a] = await Promise.all([training.getBatch(auth).catch(() => null), training.list(auth).catch(() => null)]);
      setBatch(b);
      setAgents(a);
      if (b?.start) await store.syncTraining(b.start, auth).catch(() => undefined);
      const [l, t] = await Promise.all([store.list(auth), store.listTargets(auth)]);
      setList(l);
      setTargets(t);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat BC terjadwal.', 'error');
      setList([]);
    }
  }, [store, auth, toast]);

  useEffect(() => {
    void load();
    void getPushState().then(setPush).catch(() => setPush('unsupported'));
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const active = useMemo(() => sortSchedules((list ?? []).filter((s) => s.status === 'active')), [list]);
  const due = active.filter((s) => isDue(s, now));
  const upcoming = active.filter((s) => !isDue(s, now));
  const done = useMemo(
    () =>
      (list ?? [])
        .filter((s) => s.status === 'done')
        .sort((a, b) => (b.lastSentAt ?? '').localeCompare(a.lastSentAt ?? ''))
        .slice(0, 10),
    [list]
  );
  const targetOf = (s: BcSchedule) => targets.find((t) => t.id === s.targetId) ?? null;

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, date: todayInJakarta() });
    setError(null);
    setFormOpen(true);
  };
  const openEdit = (s: BcSchedule) => {
    const { date, time } = wibParts(s.nextAt);
    setEditing(s);
    setForm({ title: s.title, message: s.message, targetId: s.targetId ?? '', date, time, repeat: s.repeat });
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    const draft: BcDraft = {
      title: form.title,
      message: form.message,
      targetId: form.targetId || null,
      nextAt: form.date ? wibIso(form.date, form.time || '09:00') : '',
      repeat: form.repeat
    };
    const kind = editing?.kind ?? 'manual';
    const timeChanged = !editing || draft.nextAt !== editing.nextAt;
    const problem = validateBc(draft, kind, new Date(), timeChanged);
    if (problem) return setError(problem);
    try {
      if (editing) {
        await store.update(
          editing.id,
          kind === 'manual' ? draft : { targetId: draft.targetId, nextAt: draft.nextAt, title: draft.title },
          auth
        );
      } else await store.create(draft, auth);
      toast(editing ? 'BC diperbarui.' : 'BC dijadwalkan.');
      setFormOpen(false);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan BC.');
    }
  };

  const send = async (s: BcSchedule) => {
    const text = messageOf(s, agents, batch);
    if (!text.trim()) return toast('Isi BC kosong (tidak ada data training yang perlu diingatkan).', 'error');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* tidak masalah: teks juga ikut di tautan WhatsApp */
    }
    window.open(waSendLink(text, targetOf(s)?.phone), '_blank', 'noopener');
    setOpened((o) => ({ ...o, [s.id]: true }));
  };

  const markSent = async (s: BcSchedule) => {
    try {
      await store.markSent(s, auth);
      toast(s.repeat === 'none' ? 'BC ditandai terkirim.' : `BC terkirim. Dijadwalkan lagi (${REPEAT_LABEL[s.repeat].toLowerCase()}).`);
      setOpened((o) => ({ ...o, [s.id]: false }));
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    }
  };

  const copy = async (s: BcSchedule) => {
    try {
      await navigator.clipboard.writeText(messageOf(s, agents, batch));
      toast('Isi BC disalin.');
    } catch {
      toast('Tidak bisa menyalin di browser ini.', 'error');
    }
  };

  const turnOnPush = async () => {
    try {
      const state = await enablePush(auth);
      setPush(state);
      toast(state === 'on' ? 'Notifikasi aktif di perangkat ini.' : 'Izin notifikasi belum diberikan.', state === 'on' ? 'success' : 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengaktifkan notifikasi.', 'error');
    }
  };

  const scheduleCard = (s: BcSchedule, isDueNow: boolean) => {
    const target = targetOf(s);
    const text = messageOf(s, agents, batch);
    return (
      <li key={s.id} className={`rounded-2xl p-4 ring-1 ${isDueNow ? 'bg-amber-50 ring-amber-300' : 'bg-white ring-slate-200'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-slate-950">{s.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {formatWibDateTime(s.nextAt)} · {REPEAT_LABEL[s.repeat]}
              {target && (
                <>
                  {' '}
                  · ke <b>{target.name}</b>
                </>
              )}
              {KIND_LABEL[s.kind] && <span className="ml-1.5 rounded-full bg-slate-900/[0.06] px-2 py-0.5 font-semibold">{KIND_LABEL[s.kind]}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {isDueNow ? (
              opened[s.id] ? (
                <button type="button" onClick={() => void markSent(s)} className={primaryBtn}>
                  <Check className="h-4 w-4" /> Sudah terkirim
                </button>
              ) : (
                <button type="button" onClick={() => void send(s)} className={primaryBtn}>
                  <Send className="h-4 w-4" /> Kirim
                </button>
              )
            ) : null}
            <button type="button" onClick={() => void copy(s)} className={ghostBtn} aria-label="Salin isi BC">
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => openEdit(s)} className={ghostBtn} aria-label="Ubah BC">
              <Pencil className="h-4 w-4" />
            </button>
            <ConfirmCancelButton
              label="Hapus"
              confirmLabel="Ya, hapus"
              onConfirm={async () => {
                await store.update(s.id, { status: 'cancelled' }, auth);
                toast('BC dihapus dari jadwal.');
                void load();
              }}
            />
          </div>
        </div>
        {opened[s.id] && isDueNow && (
          <p className="mt-2 text-xs text-amber-800">
            WhatsApp sudah dibuka & isi BC disalin. {target?.phone ? '' : `Pilih grup ${target ? `"${target.name}"` : 'tujuan'}, kirim, lalu `}
            tekan <b>Sudah terkirim</b>.
          </p>
        )}
        <details className="mt-2 group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">Lihat isi BC</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-sans text-sm text-slate-800 ring-1 ring-slate-200">
            {text || (s.kind === 'manual' ? '' : 'Belum ada data training yang perlu diingatkan.')}
          </pre>
        </details>
      </li>
    );
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Operasional</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">BC Terjadwal</h1>
            <p className="mt-1 text-sm text-slate-600">
              Siapkan BC lebih awal. Saat waktunya tiba, Anda diberi tahu lalu tinggal tekan Kirim — WhatsApp terbuka dengan isi
              BC yang sudah terisi.
            </p>
          </div>
          <button type="button" onClick={openNew} className={primaryBtn}>
            <Plus className="h-4 w-4" /> Jadwalkan BC
          </button>
        </div>

        {/* Notifikasi perangkat */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          {push === 'on' ? <BellRing className="h-5 w-5 text-emerald-600" /> : <Bell className="h-5 w-5 text-slate-500" />}
          <p className="min-w-0 flex-1 text-sm text-slate-700">
            {push === 'on'
              ? 'Notifikasi aktif di perangkat ini.'
              : push === 'denied'
                ? 'Notifikasi diblokir di browser ini. Izinkan notifikasi untuk portal ini di pengaturan browser.'
                : push === 'ios-install'
                  ? 'Di iPhone: buka portal di Safari, Bagikan → Tambah ke Layar Utama, lalu buka dari ikon itu dan aktifkan notifikasi di sini.'
                  : push === 'unsupported'
                    ? 'Notifikasi belum didukung di browser ini. BC yang sudah waktunya tetap tampil di halaman ini.'
                    : 'Aktifkan notifikasi agar HP ini berbunyi saat BC sudah waktunya dikirim.'}
          </p>
          {push === 'off' && (
            <button type="button" onClick={() => void turnOnPush()} className={ghostBtn}>
              <Bell className="h-4 w-4" /> Aktifkan notifikasi
            </button>
          )}
        </div>

        {list === null ? (
          <p className="py-16 text-center text-sm text-slate-500">Memuat BC terjadwal…</p>
        ) : (
          <div className="mt-6 space-y-8">
            {due.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-950">
                  <BellRing className="h-4 w-4 text-amber-600" /> Siap dikirim ({due.length})
                </h2>
                <ul className="space-y-3">{due.map((s) => scheduleCard(s, true))}</ul>
              </div>
            )}

            <div>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-950">
                <CalendarClock className="h-4 w-4 text-slate-500" /> Terjadwal ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                  Belum ada BC terjadwal. Tekan <b>Jadwalkan BC</b> untuk membuat yang pertama.
                </p>
              ) : (
                <ul className="space-y-3">{upcoming.map((s) => scheduleCard(s, false))}</ul>
              )}
            </div>

            <TargetsCard targets={targets} onChanged={load} />

            {done.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-bold text-slate-700">Terkirim terakhir</h2>
                <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
                  {done.map((s) => (
                    <li key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-slate-800">{s.title}</span>
                      <span className="text-xs text-slate-500">{s.lastSentAt ? formatWibDateTime(s.lastSentAt) : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? 'Ubah BC' : 'Jadwalkan BC'}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-8 sm:py-16"
          onPointerDown={(e) => e.target === e.currentTarget && setFormOpen(false)}
        >
          <div className={`${card} w-full max-w-lg shadow-2xl`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">{editing ? 'Ubah BC' : 'Jadwalkan BC'}</h2>
              <button type="button" aria-label="Tutup" onClick={() => setFormOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-semibold text-slate-800">Judul</span>
                <input
                  value={form.title}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="mis. Pengumuman Co-Broking Day"
                  className={`${input} mt-1`}
                />
              </label>
              {editing && editing.kind !== 'manual' ? (
                <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                  Isi BC ini dibuat otomatis dari data training terbaru saat dikirim.
                </p>
              ) : (
                <label className="block text-sm">
                  <span className="font-semibold text-slate-800">Isi pesan</span>
                  <textarea
                    rows={8}
                    maxLength={6000}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={`${input} mt-1`}
                  />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-semibold text-slate-800">Tanggal</span>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${input} mt-1`} />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-800">Jam (WIB)</span>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={`${input} mt-1`} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-semibold text-slate-800">Ulangi</span>
                  <select
                    value={form.repeat}
                    disabled={!!editing && editing.kind !== 'manual'}
                    onChange={(e) => setForm({ ...form, repeat: e.target.value as BcRepeat })}
                    className={`${input} mt-1`}
                  >
                    {(Object.keys(REPEAT_LABEL) as BcRepeat[]).map((r) => (
                      <option key={r} value={r}>
                        {REPEAT_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-800">Tujuan</span>
                  <select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} className={`${input} mt-1`}>
                    <option value="">— pilih saat mengirim —</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.phone ? ' (pribadi)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setFormOpen(false)} className="px-3 py-2 text-sm font-semibold text-slate-600 cursor-pointer">
                  Batal
                </button>
                <button type="button" onClick={() => void submit()} className={primaryBtn}>
                  {editing ? 'Simpan' : 'Jadwalkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

/** Daftar tujuan BC: nama grup (dipilih manual di WhatsApp) atau nomor pribadi. */
const TargetsCard: React.FC<{ targets: BcTarget[]; onChanged: () => void }> = ({ targets, onChanged }) => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    setError(null);
    const n = name.trim();
    const p = normalizePhone(phone);
    if (!n) return setError('Nama tujuan wajib diisi.');
    if (n.length > 80) return setError('Nama maksimal 80 karakter.');
    if (phone.trim() && !/^[0-9]{8,16}$/.test(p)) return setError('Nomor WhatsApp tidak valid.');
    if (targets.some((t) => t.name.toLowerCase() === n.toLowerCase())) return setError('Nama tujuan itu sudah ada.');
    try {
      await getBcStore().addTarget({ name: n, phone: p || null }, auth);
      setName('');
      setPhone('');
      toast('Tujuan BC ditambahkan.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah tujuan.');
    }
  };
  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
        <Users className="h-4 w-4 text-slate-500" /> Tujuan BC
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Simpan nama grup WhatsApp (dipilih saat mengirim) atau nomor pribadi (chat langsung terbuka ke nomornya).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_200px_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Grup Agen Brighton Cibubur" maxLength={80} className={input} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="No. WA (kosongkan untuk grup)" inputMode="tel" className={input} />
        <button type="button" onClick={() => void add()} className={primaryBtn}>
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {targets.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {targets.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <b className="text-slate-900">{t.name}</b>
                <span className="ml-2 text-xs text-slate-500">{t.phone ? `+${t.phone}` : 'Grup'}</span>
              </span>
              <ConfirmCancelButton
                label="Hapus"
                confirmLabel="Ya, hapus"
                onConfirm={async () => {
                  await getBcStore().removeTarget(t.id, auth);
                  onChanged();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
