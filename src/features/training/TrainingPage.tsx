import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, CalendarPlus, CalendarX, FileSpreadsheet, Plus, Search, Trash2, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { CopyTextBlock } from '../../components/CopyTextBlock';
import { readXlsxGrid } from '../../utils/xlsxGrid';
import { todayInJakarta } from '../../utils/schedule';
import {
  PASS_SCORE,
  TRAINING_MODULES,
  agentStatus,
  buildTrainingBc,
  addDays,
  batchEnd,
  buildAgentTrainingBc,
  buildReminderBc,
  formatBatchRange,
  type TrainingBatch,
  cancelAllPending,
  reminderAgents,
  defaultDeadline,
  greetingForHour,
  registeredAgents,
  cancelPending,
  findTrainingSheet,
  formatBatchDate,
  importTrainingSheet,
  moduleStatus,
  normalizeAgentName,
  outstandingModules,
  pendingBatches,
  registerToBatch,
  setScore,
  validateAgentName,
  type AgentStatus,
  type ModuleStatus,
  type TrainingAgent
} from './training';
import { getBcStore } from '../bc/bcStore';
import { getTrainingStore } from './trainingStore';
import { trainingReport } from './trainingReport';
import { ExportButtons } from '../../components/ExportButtons';

const printedAt = () =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }).format(new Date());

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';

/** Warna tahap mengikuti judul kolom di rekap Excel. */
const STAGE_COLOR: Record<number, string> = {
  1: 'bg-orange-300',
  2: 'bg-green-300',
  3: 'bg-yellow-300',
  4: 'bg-sky-400'
};

const STATUS_META: Record<AgentStatus, { label: string; dot: string; chip: string }> = {
  lulus: { label: 'Lulus', dot: 'bg-green-500', chip: 'bg-green-50 text-green-800 ring-green-200' },
  menunggu: { label: 'Menunggu nilai', dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 ring-red-200' },
  belum: { label: 'Belum lulus', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 ring-slate-300' }
};

const CELL_STYLE: Record<ModuleStatus, string> = {
  lulus: 'bg-green-100 text-green-900',
  menunggu: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-300',
  'tidak-lulus': 'bg-slate-200 text-slate-700',
  belum: 'bg-white text-slate-300'
};

type Filter = 'semua' | AgentStatus;

/** Menu admin: rekap nilai Training Brighton. */
export const TrainingPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getTrainingStore();
  const [agents, setAgents] = useState<TrainingAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextBatch, setNextBatch] = useState<TrainingBatch | null>(null);
  const [batchEdit, setBatchEdit] = useState<TrainingBatch | null>(null);

  useEffect(() => {
    store
      .getBatch(auth)
      .then(setNextBatch)
      .catch(() => setNextBatch(null));
  }, [store, auth]);

  const saveBatch = async (b: TrainingBatch) => {
    try {
      await store.setBatch(b, auth);
      // BC Pengingat (H-3) & Daftar peserta (H-1) otomatis masuk BC Terjadwal.
      await getBcStore()
        .syncTraining(b.start, auth)
        .catch(() => undefined);
      setNextBatch(b);
      setBatchEdit(null);
      setBcBatch(b.start);
      toast(`Batch berikutnya: ${formatBatchRange(b.start, b.end)}.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan batch.', 'error');
    }
  };
  const [filter, setFilter] = useState<Filter>('semua');
  const [search, setSearch] = useState<string>('');
  const [editing, setEditing] = useState<{ agentId: string; moduleId: string } | null>(null);
  const [batchOpen, setBatchOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [bcBatch, setBcBatch] = useState<string>('__all');
  const [bcMode, setBcMode] = useState<'grup' | 'pengingat' | 'konfirmasi'>('grup');
  const [bcAgentId, setBcAgentId] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [deadlineTime, setDeadlineTime] = useState<string>('17.00');
  const [registering, setRegistering] = useState<TrainingAgent | null>(null);
  const [reminderId, setReminderId] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setAgents(await store.list(auth));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap training.');
    }
  }, [store, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAgent = async (next: TrainingAgent, message?: string) => {
    setAgents((list) => list?.map((a) => (a.id === next.id ? next : a)) ?? null);
    try {
      await store.save(next, auth);
      if (message) toast(message);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
      void load();
    }
  };

  const list = agents ?? [];
  const counts = useMemo(() => {
    const c = { semua: list.length, lulus: 0, menunggu: 0, belum: 0 };
    for (const a of list) c[agentStatus(a)] += 1;
    return c;
  }, [list]);

  const needle = search.trim().toUpperCase();
  const visible = list
    .filter((a) => filter === 'semua' || agentStatus(a) === filter)
    .filter((a) => !needle || a.name.includes(needle));

  const batches = pendingBatches(list);
  const bcBatchDate = bcBatch === '__all' ? undefined : bcBatch;
  const bcOpts = {
    batchDate: bcBatchDate,
    nextBatch,
    deadline: deadline || defaultDeadline(bcBatchDate || nextBatch?.start || undefined, todayInJakarta()),
    deadlineTime: deadlineTime.trim() || '17.00',
    greeting: greetingForHour(Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false })))
  };
  const bcRegistered = registeredAgents(list, bcBatchDate);
  const reminders = reminderAgents(list);
  const bcAgent = bcRegistered.find((r) => r.agent.id === bcAgentId)?.agent ?? bcRegistered[0]?.agent;
  const bcText =
    bcMode === 'grup'
      ? buildTrainingBc(list, bcOpts)
      : bcMode === 'pengingat'
        ? buildReminderBc(list, bcOpts, reminderId || undefined)
        : bcAgent
          ? buildAgentTrainingBc(bcAgent, bcOpts)
          : '';
  const editAgent = editing ? list.find((a) => a.id === editing.agentId) : undefined;
  const editModule = editing ? TRAINING_MODULES.find((m) => m.id === editing.moduleId) : undefined;

  const addAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = normalizeAgentName(newName);
    const problem = validateAgentName(name);
    if (problem) return toast(problem, 'error');
    try {
      const agent = await store.add(name, auth);
      setAgents((l) => [...(l ?? []), agent]);
      setNewName('');
      toast(`${name} ditambahkan ke rekap.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menambah agen.', 'error');
    }
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Training Brighton</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Rekap nilai & BC</h1>
            <p className="mt-1 text-sm text-slate-600">
              Rekap nilai {TRAINING_MODULES.length} sesi training. Nilai minimal kelulusan {PASS_SCORE}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImportButton onImported={load} />
            <ExportButtons
              fileBase={`rekap_training_brighton_${todayInJakarta()}`}
              disabled={!agents || agents.length === 0}
              build={() => [{ name: 'TRAINING BRIGHTON', doc: trainingReport(agents ?? [], printedAt()) }]}
            />
            <button type="button" onClick={() => setBatchOpen(true)} className={primaryBtn} disabled={!agents}>
              <CalendarPlus className="h-4 w-4" />
              Daftarkan ke batch
            </button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <CalendarPlus className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          {batchEdit ? (
            <>
              <label className="text-xs font-semibold text-slate-700">
                Mulai
                <input
                  type="date"
                  aria-label="Mulai batch"
                  value={batchEdit.start}
                  onChange={(e) => setBatchEdit({ start: e.target.value, end: e.target.value ? addDays(e.target.value, 3) : '' })}
                  className={`${input} mt-0.5 w-40 py-1.5`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Selesai
                <input
                  type="date"
                  aria-label="Selesai batch"
                  value={batchEdit.end}
                  min={batchEdit.start}
                  onChange={(e) => setBatchEdit({ ...batchEdit, end: e.target.value })}
                  className={`${input} mt-0.5 w-40 py-1.5`}
                />
              </label>
              <p className="text-xs text-slate-500">
                {batchEdit.start && batchEdit.end >= batchEdit.start ? formatBatchRange(batchEdit.start, batchEdit.end) : 'Pilih tanggal mulai (biasanya Senin).'}
              </p>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setBatchEdit(null)} className="px-3 py-1.5 text-sm font-semibold text-slate-600 cursor-pointer">
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!batchEdit.start || !batchEdit.end || batchEdit.end < batchEdit.start}
                  onClick={() => void saveBatch(batchEdit)}
                  className={primaryBtn}
                >
                  Simpan batch
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                <span className="text-xs font-semibold text-slate-500">Batch berikutnya</span>
                <br />
                <b className="text-slate-950">{nextBatch ? formatBatchRange(nextBatch.start, nextBatch.end) : 'Belum diatur'}</b>
              </p>
              <button
                type="button"
                onClick={() => setBatchEdit(nextBatch ?? { start: '', end: '' })}
                className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                {nextBatch ? 'Ubah batch' : 'Atur batch'}
              </button>
            </>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['semua', 'lulus', 'menunggu', 'belum'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 cursor-pointer ${
                    filter === f
                      ? 'bg-slate-950 text-white ring-slate-950'
                      : f === 'semua'
                        ? 'bg-white text-slate-700 ring-slate-200'
                        : STATUS_META[f].chip
                  }`}
                >
                  {f !== 'semua' && <span className={`h-2 w-2 rounded-full ${STATUS_META[f].dot}`} />}
                  {f === 'semua' ? 'Semua' : STATUS_META[f].label}
                  <span className="tabular-nums opacity-80">{counts[f]}</span>
                </button>
              ))}
              <label className="relative ml-auto w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="Cari agen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama / kode"
                  className={`${input} pl-9`}
                />
              </label>
            </div>

            <div className="max-lg:overflow-x-auto lg:overflow-clip rounded-2xl bg-white ring-1 ring-slate-200">
              <table className="w-full max-lg:min-w-[900px] table-fixed border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-50 text-left">
                    <th className="sticky left-0 lg:top-[57px] z-20 w-[205px] bg-stone-50 px-2 py-2 text-center align-middle text-[11px] font-bold text-slate-700 shadow-[0_1px_0_#e2e8f0]">
                      Property advisor
                    </th>
                    {TRAINING_MODULES.map((m) => (
                      <th
                        key={m.id}
                        className="lg:sticky lg:top-[57px] z-10 bg-stone-50 px-0.5 pt-0 pb-1.5 text-center align-top shadow-[0_1px_0_#e2e8f0]"
                      >
                        <span className={`block h-1.5 ${STAGE_COLOR[m.stage]}`} />
                        <span className="mt-1 block text-[9.5px] font-semibold leading-[1.15] text-slate-700 [overflow-wrap:anywhere]">{m.title}</span>
                      </th>
                    ))}
                    <th className="lg:sticky lg:top-[57px] z-10 w-7 bg-stone-50 shadow-[0_1px_0_#e2e8f0]" />
                  </tr>
                </thead>
                <tbody>
                  {agents === null && (
                    <tr>
                      <td colSpan={14} className="px-3 py-8 text-center text-sm text-slate-500">
                        Memuat rekap…
                      </td>
                    </tr>
                  )}
                  {agents !== null && visible.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-8 text-center text-sm text-slate-500">
                        {list.length === 0 ? 'Belum ada data. Impor rekap Excel atau tambah agen.' : 'Tidak ada agen yang cocok.'}
                      </td>
                    </tr>
                  )}
                  {visible.map((a) => {
                    const status = agentStatus(a);
                    return (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="sticky left-0 z-[5] bg-white px-2 py-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              title={STATUS_META[status].label}
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[status].dot}`}
                            />
                            <span className="min-w-0 truncate text-[10.5px] font-semibold text-slate-900" title={a.name}>
                              {a.name}
                            </span>
                            <span className="ml-auto flex shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200" role="group" aria-label={`Jenis kelamin ${a.name}`}>
                              {(['L', 'P'] as const).map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  aria-pressed={a.gender === g}
                                  title={g === 'L' ? 'Laki-laki (Bapak)' : 'Perempuan (Ibu)'}
                                  onClick={() => void saveAgent({ ...a, gender: a.gender === g ? null : g }, '')}
                                  className={`h-5 w-5 text-[10px] font-bold cursor-pointer ${
                                    a.gender === g ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {g}
                                </button>
                              ))}
                            </span>
                            {a.graduated && (
                              <span title="Ditetapkan lulus" className="text-green-700">
                                <Award className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </span>
                        </td>
                        {TRAINING_MODULES.map((m) => {
                          const st = moduleStatus(a, m.id);
                          const score = a.scores[m.id];
                          return (
                            <td key={m.id} className="px-[1px] py-0.5">
                              <button
                                type="button"
                                onClick={() => setEditing({ agentId: a.id, moduleId: m.id })}
                                aria-label={`${a.name} · ${m.title}: ${score ?? 'kosong'}${st === 'menunggu' ? ', menunggu nilai' : ''}`}
                                className={`h-7 w-full rounded-md text-xs font-bold tabular-nums hover:ring-2 hover:ring-amber-400 cursor-pointer ${CELL_STYLE[st]}`}
                              >
                                {st === 'menunggu' ? (score !== undefined ? <s className="opacity-60">{score}</s> : 'Daftar') : (score ?? '–')}
                              </button>
                            </td>
                          );
                        })}
                        <td className="pr-1">
                          <AgentMenu agent={a} onRegister={() => setRegistering(a)} onNotAttending={() => void saveAgent(cancelAllPending(a), `Pendaftaran ${a.name} dibatalkan (tidak mengikuti).`)} onToggleGraduate={(g) => void saveAgent({ ...a, graduated: g }, g ? `${a.name} ditetapkan lulus.` : `Penetapan lulus ${a.name} dibatalkan.`)} onDelete={async () => {
                            try {
                              await store.remove(a.id, auth);
                              setAgents((l) => l?.filter((x) => x.id !== a.id) ?? null);
                              toast(`${a.name} dihapus dari rekap.`);
                            } catch (err) {
                              toast(err instanceof Error ? err.message : 'Gagal menghapus.', 'error');
                            }
                          }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <form onSubmit={addAgent} className="flex flex-col sm:flex-row gap-2" noValidate>
              <input
                aria-label="Nama agen baru"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tambah agen, mis. MARSEL (GFXY)"
                className={`${input} sm:max-w-xs`}
              />
              <button type="submit" className={ghostBtn}>
                <Plus className="h-4 w-4" />
                Tambah agen
              </button>
            </form>

          </div>

          <aside className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div>
                <p className="text-sm font-bold text-slate-950">BC training</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {bcMode === 'pengingat'
                    ? 'Agen dengan sesi yang belum diikuti atau belum lulus.'
                    : 'Dari agen yang sudah didaftarkan dan nilainya masih kosong.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="Jenis BC">
                {(['grup', 'pengingat', 'konfirmasi'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={bcMode === m}
                    onClick={() => setBcMode(m)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-bold cursor-pointer ${bcMode === m ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}
                  >
                    {m === 'grup' ? 'BC Group' : m === 'pengingat' ? 'BC Pengingat' : 'BC Konfirmasi'}
                  </button>
                ))}
              </div>
              {bcMode === 'pengingat' && (
                <label className="block text-xs font-semibold text-slate-700">
                  Agen ({reminders.length})
                  <select
                    aria-label="Agen untuk BC pengingat"
                    value={reminderId}
                    onChange={(e) => setReminderId(e.target.value)}
                    className={`${input} mt-1`}
                  >
                    <option value="">Semua agen (untuk grup)</option>
                    {reminders.map((r) => (
                      <option key={r.agent.id} value={r.agent.id}>
                        {r.agent.name} · {r.modules.length} sesi
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {bcMode !== 'pengingat' && (
              <label className="block text-xs font-semibold text-slate-700">
                Batch
                <select aria-label="Batch untuk BC" value={bcBatch} onChange={(e) => setBcBatch(e.target.value)} className={`${input} mt-1`}>
                  <option value="__all">Semua yang menunggu nilai</option>
                  {batches.map((b) => (
                    <option key={b || 'none'} value={b}>
                      {b ? `Batch ${formatBatchDate(b)}` : 'Tanpa tanggal batch'}
                    </option>
                  ))}
                </select>
              </label>
              )}
              {bcMode === 'konfirmasi' && (
                <label className="block text-xs font-semibold text-slate-700">
                  Agen ({bcRegistered.length})
                  <select
                    aria-label="Agen untuk BC"
                    value={bcAgent?.id ?? ''}
                    onChange={(e) => setBcAgentId(e.target.value)}
                    className={`${input} mt-1`}
                    disabled={bcRegistered.length === 0}
                  >
                    {bcRegistered.map((r) => (
                      <option key={r.agent.id} value={r.agent.id}>
                        {r.agent.name} · {r.modules.length} sesi
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {bcMode !== 'pengingat' && (
              <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Batas pendaftaran
                  <input
                    type="date"
                    aria-label="Batas pendaftaran"
                    value={bcOpts.deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Pukul
                  <input
                    aria-label="Jam batas pendaftaran"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    placeholder="17.00"
                    className={`${input} mt-1`}
                  />
                </label>
              </div>
              )}
            </div>
            <CopyTextBlock
              text={bcText}
              label={
                bcMode === 'grup'
                  ? 'Teks BC Group'
                  : bcMode === 'pengingat'
                    ? 'Teks BC Pengingat'
                    : `Teks BC Konfirmasi ${bcAgent?.name ?? 'agen'}`
              }
              emptyText={bcMode === 'pengingat' ? 'Semua agen sudah lulus atau sedang terdaftar.' : 'Belum ada agen yang didaftarkan dan menunggu nilai.'}
              rows={16}
            />
          </aside>
        </div>
      </div>

      {editing && editAgent && editModule && (
        <ScoreDialog
          agent={editAgent}
          moduleId={editModule.id}
          onClose={() => setEditing(null)}
          onSave={(next, msg) => {
            void saveAgent(next, msg);
            setEditing(null);
          }}
        />
      )}

      {registering && (
        <RegisterAgentDialog
          agent={registering}
          batch={nextBatch}
          onClose={() => setRegistering(null)}
          onSave={(next, date) => {
            setRegistering(null);
            setBcBatch(date);
            void saveAgent(next, `${next.name} didaftarkan ke batch ${formatBatchRange(date, batchEnd(date, nextBatch))}.`);
          }}
        />
      )}

      {batchOpen && (
        <BatchDialog
          agents={list}
          batch={nextBatch}
          onClose={() => setBatchOpen(false)}
          onSave={async (updated, date) => {
            setBatchOpen(false);
            setAgents((l) => l?.map((a) => updated.find((u) => u.id === a.id) ?? a) ?? null);
            try {
              await store.saveMany(updated, auth);
              setBcBatch(date);
              toast(`${updated.length} agen didaftarkan ke batch ${formatBatchRange(date, batchEnd(date, nextBatch))}.`);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
              void load();
            }
          }}
        />
      )}
    </section>
  );
};

const AgentMenu: React.FC<{
  agent: TrainingAgent;
  onRegister: () => void;
  onNotAttending: () => void;
  onToggleGraduate: (g: boolean) => void;
  onDelete: () => Promise<void>;
}> = ({
  agent,
  onRegister,
  onNotAttending,
  onToggleGraduate,
  onDelete
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean }>({ top: 0, right: 0, up: false });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (!open && btnRef.current) {
      // Menu memakai posisi tetap (fixed) agar tidak terpotong tabel; buka ke atas bila ruang di bawah sempit.
      const r = btnRef.current.getBoundingClientRect();
      const up = window.innerHeight - r.bottom < 230;
      setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up });
    }
    setOpen((o) => !o);
  };
  // Tutup otomatis saat klik di luar menu, pindah tab, atau tekan Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onBlur = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    window.addEventListener('scroll', onBlur, true);
    window.addEventListener('resize', onBlur);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('scroll', onBlur, true);
      window.removeEventListener('resize', onBlur);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Menu ${agent.name}`}
        aria-expanded={open}
        ref={btnRef}
        onClick={toggle}
        className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
      >
        ⋯
      </button>
      {open && (
        <div
          className="fixed z-40 w-52 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200"
          style={{ top: pos.top, right: pos.right, transform: pos.up ? 'translateY(-100%)' : undefined }}
        >
          {outstandingModules(agent).length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRegister();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4 text-amber-600" />
              Daftarkan sesi
            </button>
          )}
          {Object.keys(agent.pending).length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNotAttending();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <CalendarX className="h-4 w-4 text-red-600" />
              Tidak mengikuti
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onToggleGraduate(!agent.graduated);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <Award className="h-4 w-4 text-green-700" />
            {agent.graduated ? 'Batalkan tetapkan lulus' : 'Tetapkan lulus'}
          </button>
          <div className="px-2.5 py-1.5">
            <ConfirmCancelButton label="Hapus agen" confirmLabel="Ya, hapus" onConfirm={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
};

/** Daftarkan semua sesi yang belum diikuti / belum lulus dari satu agen sekaligus. */
/** Batch yang dipakai saat mendaftarkan (diatur di kartu "Batch berikutnya"). */
const BatchInfo: React.FC<{ batch: TrainingBatch | null }> = ({ batch }) =>
  batch ? (
    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
      Batch: <b>{formatBatchRange(batch.start, batch.end)}</b>
    </p>
  ) : (
    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200">
      Atur dulu &quot;Batch berikutnya&quot; di atas tabel rekap sebelum mendaftarkan agen.
    </p>
  );

const RegisterAgentDialog: React.FC<{
  agent: TrainingAgent;
  onClose: () => void;
  batch: TrainingBatch | null;
  onSave: (next: TrainingAgent, date: string) => void;
}> = ({ agent, batch, onClose, onSave }) => {
  const date = batch?.start ?? '';
  const out = outstandingModules(agent);
  return (
    <Dialog title={`Daftarkan sesi · ${agent.name}`} onClose={onClose}>
      <p className="text-sm text-slate-600">
        {out.length} sesi yang belum diikuti atau belum lulus akan ditandai <b className="text-red-700">menunggu nilai</b> sekaligus:
      </p>
      <ol className="mt-2 space-y-0.5 text-sm text-slate-800">
        {out.map((m) => (
          <li key={m.id}>
            <span className="inline-block w-6 text-right font-bold tabular-nums text-slate-500">{TRAINING_MODULES.indexOf(m) + 1}.</span> {m.title}
          </li>
        ))}
      </ol>
      <BatchInfo batch={batch} />
      <button type="button" disabled={!date} onClick={() => onSave(registerToBatch(agent, date), date)} className={`${primaryBtn} mt-4 w-full`}>
        Daftarkan {out.length} sesi
      </button>
    </Dialog>
  );
};

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({
  title,
  onClose,
  children,
  wide
}) => (
  <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`w-full ${wide ? 'max-w-lg' : 'max-w-sm'} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  </div>
);

const ScoreDialog: React.FC<{
  agent: TrainingAgent;
  moduleId: string;
  onClose: () => void;
  onSave: (next: TrainingAgent, message: string) => void;
}> = ({ agent, moduleId, onClose, onSave }) => {
  const mod = TRAINING_MODULES.find((m) => m.id === moduleId)!;
  const current = agent.scores[moduleId];
  const isPending = moduleId in agent.pending;
  const [value, setValue] = useState<string>(current !== undefined && !isPending ? String(current) : '');
  const [batch, setBatch] = useState<string>(agent.pending[moduleId] || todayInJakarta());
  const n = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100;

  return (
    <Dialog title={mod.title} onClose={onClose}>
      <p className="text-sm text-slate-600">
        <b className="text-slate-900">{agent.name}</b>
        {current !== undefined && ` · nilai terakhir ${current}`}
        {isPending && ` · terdaftar ${agent.pending[moduleId] ? formatBatchDate(agent.pending[moduleId]) : '(tanggal batch belum diisi)'}`}
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave(setScore(agent, moduleId, n), `Nilai ${agent.name} disimpan: ${n}${n >= PASS_SCORE ? ' (lulus)' : ' (belum lulus)'}.`);
        }}
      >
        <label className="block text-xs font-semibold text-slate-700">
          Nilai (0–100)
          <input
            autoFocus
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            className={`${input} mt-1 text-lg font-bold tabular-nums`}
            placeholder={`Lulus ≥ ${PASS_SCORE}`}
          />
        </label>
        <button type="submit" disabled={!valid} className={`${primaryBtn} w-full`}>
          Simpan nilai
        </button>
      </form>
      <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
        <label className="block text-xs font-semibold text-slate-700">
          Tanggal batch
          <input type="date" value={batch} onChange={(e) => setBatch(e.target.value)} className={`${input} mt-1`} />
        </label>
        <button
          type="button"
          onClick={() => onSave(registerToBatch(agent, batch, [moduleId]), `${agent.name} didaftarkan: ${mod.title}.`)}
          className={`${ghostBtn} w-full`}
        >
          <CalendarPlus className="h-4 w-4" />
          {isPending ? 'Ubah tanggal batch' : 'Daftarkan sesi ini (menunggu nilai)'}
        </button>
        <div className="flex gap-2">
          {isPending && (
            <button
              type="button"
              onClick={() => onSave(cancelPending(agent, moduleId), 'Pendaftaran dibatalkan.')}
              className={`${ghostBtn} flex-1`}
            >
              Batalkan daftar
            </button>
          )}
          {current !== undefined && (
            <button
              type="button"
              onClick={() => onSave(setScore(agent, moduleId, null), 'Nilai dihapus.')}
              className={`${ghostBtn} flex-1 text-red-700`}
            >
              <Trash2 className="h-4 w-4" />
              Hapus nilai
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
};

const BatchDialog: React.FC<{
  agents: TrainingAgent[];
  onClose: () => void;
  batch: TrainingBatch | null;
  onSave: (updated: TrainingAgent[], date: string) => void;
}> = ({ agents, batch, onClose, onSave }) => {
  const candidates = agents
    .filter((a) => agentStatus(a) !== 'lulus' && outstandingModules(a).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const date = batch?.start ?? '';
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<string>('');
  const q = query.trim().toUpperCase();
  const shown = candidates.filter((a) => !q || a.name.includes(q));

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog title="Daftarkan ke batch training" onClose={onClose} wide>
      <p className="text-sm text-slate-600">
        Semua sesi yang belum diikuti atau belum lulus dari agen terpilih akan ditandai{' '}
        <b className="text-red-700">menunggu nilai</b>.
      </p>
      <BatchInfo batch={batch} />
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">
          Agen belum lulus ({picked.size}/{candidates.length} dipilih)
        </p>
        <button
          type="button"
          onClick={() => setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((a) => a.id)))}
          className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
        >
          {picked.size === shown.length && shown.length > 0 ? 'Kosongkan' : 'Pilih semua'}
        </button>
      </div>
      <input
        aria-label="Cari agen untuk batch"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama"
        className={`${input} mt-2`}
      />
      <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {shown.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">Tidak ada agen yang perlu didaftarkan.</li>}
        {shown.map((a) => {
          const out = outstandingModules(a);
          return (
            <li key={a.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-stone-50">
                <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} className="mt-1 h-4 w-4 accent-amber-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{a.name}</span>
                  <span className="block text-xs text-slate-500">
                    {out.length} sesi: {out.map((m) => TRAINING_MODULES.indexOf(m) + 1).join(', ')}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={picked.size === 0 || !date}
        onClick={() => onSave(candidates.filter((a) => picked.has(a.id)).map((a) => registerToBatch(a, date)), date)}
        className={`${primaryBtn} mt-4 w-full`}
      >
        Daftarkan {picked.size} agen
      </button>
    </Dialog>
  );
};

const ImportButton: React.FC<{ onImported: () => Promise<void> }> = ({ onImported }) => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState<boolean>(false);
  return (
    <label className={`${ghostBtn} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
      <FileSpreadsheet className="h-4 w-4 text-green-700" />
      {busy ? 'Mengimpor…' : 'Impor dari Excel'}
      <input
        type="file"
        accept=".xlsx"
        aria-label="File rekap training"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const sheets = await readXlsxGrid(await file.arrayBuffer());
            const sheet = findTrainingSheet(sheets);
            if (!sheet) throw new Error('Sheet rekap training (kolom "PROPERTY ADVISOR") tidak ditemukan.');
            const result = importTrainingSheet(sheet);
            await getTrainingStore().importMany(result.agents, auth);
            await onImported();
            toast(`${result.agents.length} agen diimpor dari sheet "${result.sheetName}".`);
          } catch (err) {
            toast(err instanceof Error ? err.message : 'File tidak dapat diimpor.', 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
};
