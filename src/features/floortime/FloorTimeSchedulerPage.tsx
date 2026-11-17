import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, Download, Plus, Trash2, RefreshCw, Send, Check, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { todayInJakarta } from '../../utils/schedule';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import {
  agentUnit,
  dateOptionLabel,
  DEFAULT_POSTER_NOTES,
  displayName,
  filterAgentsForSchedule,
  generateSchedule,
  getMonthWorkDates,
  monthLabel,
  MONTH_NAMES_ID,
  previousMonth,
  rowsToAgents,
  weekRangeLabel,
  type Agent,
  type GenerateResult,
  type RosterSort,
  type ScheduleData,
  type UrgentRequest
} from './engine';
import { buildAgentTemplate, buildScheduleWorkbook } from './excelExport';
import { readTableFile } from './spreadsheet';
import {
  buildPdfFromPngs,
  buildZip,
  canvasToPng,
  downloadBytes,
  loadPosterFonts,
  renderRosterPages,
  renderWeekPoster,
  ROSTER_COLUMNS,
  type RosterColumn
} from './posterRenderer';
import { getScheduleStore } from './scheduleStore';
import {
  applyChangeRequest,
  defaultRequestDeadline,
  formatDeadlineWib,
  isRequestOpen,
  slotLabel,
  type ChangeRequest,
  type PublishedSchedule
} from './requests';

type Tab = 'data' | 'config' | 'result' | 'publish';

const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: '1. Data agen' },
  { id: 'config', label: '2. Konfigurasi & generate' },
  { id: 'result', label: '3. Hasil & unduh' },
  { id: 'publish', label: '4. Terbitkan & request' }
];

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const card = 'bg-white border border-slate-200 rounded-2xl p-5';

function nextMonth(): [number, number] {
  const [y, m] = todayInJakarta().split('-').map(Number);
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

/** "2026-11-22T23:59:00+07:00" ⇄ nilai input datetime-local dalam WIB */
function deadlineToLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
}
function localInputToDeadline(value: string): string {
  return `${value}:00+07:00`;
}

/* ------------------------------------------------------------------ */

export const FloorTimeSchedulerPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('data');

  // Data agen
  const [fileName, setFileName] = useState<string>('');
  const [uploadedAgents, setUploadedAgents] = useState<Agent[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [minAttendance, setMinAttendance] = useState<number>(5);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Konfigurasi
  const [[year, month], setYearMonth] = useState<[number, number]>(nextMonth);
  const [hubName, setHubName] = useState<string>('HUB CIBUBUR');
  const [weekdayCapacity, setWeekdayCapacity] = useState<number>(4);
  const [saturdayCapacity, setSaturdayCapacity] = useState<number>(3);
  const [maxWeekly, setMaxWeekly] = useState<number>(2);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [urgent, setUrgent] = useState<UrgentRequest[]>([]);
  const [notesText, setNotesText] = useState<string>(DEFAULT_POSTER_NOTES.join('\n'));
  const [useSeed, setUseSeed] = useState<boolean>(false);
  const [seed, setSeed] = useState<string>('');

  // Hasil
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [resultKey, setResultKey] = useState<string>('');

  const candidates = useMemo(
    () => filterAgentsForSchedule(uploadedAgents, minAttendance),
    [uploadedAgents, minAttendance]
  );
  const agents = useMemo(() => candidates.filter((a) => !excluded.has(a.id)), [candidates, excluded]);
  const workDates = useMemo(() => getMonthWorkDates(year, month), [year, month]);
  const notes = useMemo(() => notesText.split('\n').map((l) => l.trim()).filter(Boolean), [notesText]);

  const configKey = JSON.stringify([
    year, month, hubName, weekdayCapacity, saturdayCapacity, maxWeekly, holidays, urgent, notes,
    useSeed ? seed : '', agents.map((a) => a.id)
  ]);
  const stale = result !== null && resultKey !== '' && resultKey !== configKey;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      const rows = await readTableFile(file);
      const { agents: parsed } = rowsToAgents(rows);
      if (parsed.length === 0) throw new Error('Tidak ditemukan data agen yang valid pada kolom Nama.');
      setUploadedAgents(parsed);
      setExcluded(new Set());
      setFileName(file.name);
      setResult(null);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'File tidak dapat dibaca.');
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerate = () => {
    if (agents.length === 0) return;
    const r = generateSchedule(agents, {
      year,
      month,
      hubName,
      notes,
      weekdayCapacity,
      saturdayCapacity,
      maxWeekly,
      holidays,
      urgentRequests: urgent.filter((u) => u.agentId && u.date),
      seed: useSeed ? seed || `${year}-${String(month).padStart(2, '0')}-brighton` : undefined
    });
    setResult(r);
    setResultKey(configKey);
    setTab('result');
  };

  return (
    <section className="bg-stone-50 min-h-[70vh] py-8 sm:py-12">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <p className="text-xs text-slate-500">Operasional</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Floor Time Scheduler
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Jadwal bulan {monthLabel(year, month)} · data referensi {monthLabel(...previousMonth(year, month))}
        </p>

        <div role="tablist" className="mt-6 flex flex-wrap gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer ${
                tab === t.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'data' && (
            <DataTab
              fileName={fileName}
              fileError={fileError}
              onFile={handleFile}
              uploadedCount={uploadedAgents.length}
              candidates={candidates}
              excluded={excluded}
              setExcluded={setExcluded}
              minAttendance={minAttendance}
              setMinAttendance={setMinAttendance}
              activeCount={agents.length}
            />
          )}
          {tab === 'config' && (
            <div className="space-y-5">
              <div className={`${card} grid grid-cols-1 md:grid-cols-3 gap-4`}>
                <label className="text-xs font-semibold text-slate-700">
                  Bulan jadwal
                  <select
                    value={month}
                    onChange={(e) => setYearMonth([year, Number(e.target.value)])}
                    className={`${input} mt-1`}
                  >
                    {MONTH_NAMES_ID.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Tahun
                  <input
                    type="number"
                    min={2024}
                    max={2100}
                    value={year}
                    onChange={(e) => setYearMonth([Number(e.target.value) || year, month])}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Nama hub (di poster)
                  <input value={hubName} onChange={(e) => setHubName(e.target.value)} className={`${input} mt-1`} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Target agen per shift Senin–Jumat
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={weekdayCapacity}
                    onChange={(e) => setWeekdayCapacity(Math.max(1, Number(e.target.value)))}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Target agen per shift Sabtu
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={saturdayCapacity}
                    onChange={(e) => setSaturdayCapacity(Math.max(1, Number(e.target.value)))}
                    className={`${input} mt-1`}
                  />
                </label>
                <div className="text-xs font-semibold text-slate-700">
                  Floor time per agen per minggu
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxWeekly(n)}
                        className={`flex-1 px-3 py-2 text-sm font-bold rounded-lg border cursor-pointer ${
                          maxWeekly === n ? 'bg-amber-400 border-amber-400 text-slate-950' : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <HolidayEditor workDates={workDates} holidays={holidays} setHolidays={setHolidays} />
                <UrgentEditor agents={agents} workDates={workDates} holidays={holidays} urgent={urgent} setUrgent={setUrgent} />
              </div>

              <div className={card}>
                <label className="text-xs font-semibold text-slate-700">
                  Catatan pada poster (satu baris satu catatan)
                  <textarea
                    rows={3}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={useSeed} onChange={(e) => setUseSeed(e.target.checked)} />
                  Gunakan kode audit (hasil tetap sama setiap generate)
                </label>
                {useSeed && (
                  <input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder={`${year}-${String(month).padStart(2, '0')}-brighton`}
                    className={`${input} mt-2 max-w-sm`}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={handleGenerate} disabled={agents.length === 0} className={btnPrimary}>
                  <RefreshCw className="w-4 h-4" />
                  {result ? 'Acak ulang jadwal bulanan' : 'Generate jadwal bulanan'}
                </button>
                <span className="text-xs text-slate-600">
                  {agents.length === 0
                    ? 'Unggah data agen di tab 1 terlebih dahulu.'
                    : `${agents.length} agen · ${Object.keys(holidays).length} hari libur`}
                </span>
              </div>
            </div>
          )}
          {tab === 'result' && (
            <ResultTab result={result} stale={stale} onGoPublish={() => setTab('publish')} />
          )}
          {tab === 'publish' && <PublishTab result={result} stale={stale} onShowResult={(r) => { setResult(r); setResultKey(''); setTab('result'); }} />}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 1: data agen                                                    */
/* ------------------------------------------------------------------ */

const DataTab: React.FC<{
  fileName: string;
  fileError: string | null;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedCount: number;
  candidates: Agent[];
  excluded: Set<string>;
  setExcluded: (s: Set<string>) => void;
  minAttendance: number;
  setMinAttendance: (n: number) => void;
  activeCount: number;
}> = ({ fileName, fileError, onFile, uploadedCount, candidates, excluded, setExcluded, minAttendance, setMinAttendance, activeCount }) => (
  <div className="space-y-5">
    <div className={`${card} flex flex-col sm:flex-row sm:items-center gap-4 justify-between`}>
      <div>
        <p className="text-sm font-semibold text-slate-900">Data agen bulan sebelumnya</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Format: No | Nama | Jabatan | Office | Total. Nama boleh "NAMA (KODE)". File .xlsx atau .csv.
        </p>
        {fileName && (
          <p className="text-xs text-emerald-700 mt-1">
            {fileName} · {uploadedCount} agen terbaca
          </p>
        )}
        {fileError && <p className="text-xs font-semibold text-red-700 mt-1">{fileError}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          className={btnSecondary}
          onClick={async () => downloadBytes(await buildAgentTemplate(), 'template_import_agents.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        >
          <Download className="w-4 h-4" />
          Template
        </button>
        <label className={`${btnPrimary} relative`}>
          <Upload className="w-4 h-4" />
          Unggah file
          <input
            type="file"
            accept=".xlsx,.csv"
            aria-label="File data agen"
            onChange={onFile}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>

    {uploadedCount > 0 && (
      <div className={card}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="text-xs font-semibold text-slate-700">
            Minimum total kehadiran
            <input
              type="number"
              min={0}
              value={minAttendance}
              onChange={(e) => setMinAttendance(Math.max(0, Number(e.target.value)))}
              className={`${input} mt-1 w-32`}
            />
          </label>
          <p className="text-sm text-slate-700">
            Total agen bertugas: <span className="text-lg font-bold text-slate-950">{activeCount}</span>
          </p>
        </div>
        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-amber-800">Tidak ada agen yang memenuhi minimum kehadiran.</p>
        ) : (
          <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-stone-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2 w-28">Masuk jadwal</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Jabatan</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Total kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Masukkan ${displayName(a)} ke jadwal`}
                        checked={!excluded.has(a.id)}
                        onChange={(e) => {
                          const next = new Set(excluded);
                          if (e.target.checked) next.delete(a.id);
                          else next.add(a.id);
                          setExcluded(next);
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-900">{displayName(a)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{a.jobTitle || '-'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{agentUnit(a) || '-'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{a.attendance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Tab 2: hari libur & request khusus                                  */
/* ------------------------------------------------------------------ */

const HolidayEditor: React.FC<{
  workDates: string[];
  holidays: Record<string, string>;
  setHolidays: (h: Record<string, string>) => void;
}> = ({ workDates, holidays, setHolidays }) => {
  const [pick, setPick] = useState<string>('');
  const available = workDates.filter((d) => holidays[d] === undefined);
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-950">Hari libur / tanggal merah</p>
      <p className="text-xs text-slate-500">Tanggal libur tidak mendapat shift maupun agen.</p>
      <div className="mt-3 flex gap-2">
        <select aria-label="Pilih tanggal libur" value={pick} onChange={(e) => setPick(e.target.value)} className={input}>
          <option value="">Pilih tanggal…</option>
          {available.map((d) => (
            <option key={d} value={d}>
              {dateOptionLabel(d)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!pick}
          onClick={() => {
            setHolidays({ ...holidays, [pick]: 'Hari Libur' });
            setPick('');
          }}
          className={btnSecondary}
        >
          <Plus className="w-4 h-4" />
          Tambah
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {Object.keys(holidays)
          .sort()
          .map((d) => (
            <li key={d} className="flex items-center gap-2">
              <span className="w-48 shrink-0 text-xs font-semibold text-red-700">{dateOptionLabel(d)}</span>
              <input
                aria-label={`Keterangan libur ${d}`}
                value={holidays[d]}
                onChange={(e) => setHolidays({ ...holidays, [d]: e.target.value })}
                placeholder="Mis. Maulid Nabi Muhammad SAW"
                className={input}
              />
              <button
                type="button"
                aria-label="Hapus hari libur"
                onClick={() => {
                  const next = { ...holidays };
                  delete next[d];
                  setHolidays(next);
                }}
                className="p-2 text-slate-500 hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};

const UrgentEditor: React.FC<{
  agents: Agent[];
  workDates: string[];
  holidays: Record<string, string>;
  urgent: UrgentRequest[];
  setUrgent: (u: UrgentRequest[]) => void;
}> = ({ agents, workDates, holidays, urgent, setUrgent }) => {
  const update = (i: number, patch: Partial<UrgentRequest>) =>
    setUrgent(urgent.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-950">Request jadwal khusus</p>
          <p className="text-xs text-slate-500">Ditempatkan lebih dahulu dan dihitung dalam target agen.</p>
        </div>
        <button
          type="button"
          disabled={agents.length === 0}
          onClick={() => setUrgent([...urgent, { agentId: '', date: '', shiftIndex: 0 }])}
          className={btnSecondary}
        >
          <Plus className="w-4 h-4" />
          Baris
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {urgent.map((u, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_90px_auto] gap-2">
            <select aria-label="Agen" value={u.agentId} onChange={(e) => update(i, { agentId: e.target.value })} className={input}>
              <option value="">Agen…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {displayName(a)}
                </option>
              ))}
            </select>
            <select aria-label="Tanggal" value={u.date} onChange={(e) => update(i, { date: e.target.value })} className={input}>
              <option value="">Tanggal…</option>
              {workDates
                .filter((d) => holidays[d] === undefined)
                .map((d) => (
                  <option key={d} value={d}>
                    {dateOptionLabel(d)}
                  </option>
                ))}
            </select>
            <select
              aria-label="Shift"
              value={u.shiftIndex}
              onChange={(e) => update(i, { shiftIndex: Number(e.target.value) })}
              className={input}
            >
              <option value={0}>Pagi</option>
              <option value={1}>Siang</option>
            </select>
            <button
              type="button"
              aria-label="Hapus request"
              onClick={() => setUrgent(urgent.filter((_, idx) => idx !== i))}
              className="p-2 text-slate-500 hover:text-red-700 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
        {urgent.length === 0 && <li className="text-xs text-slate-500">Belum ada request khusus.</li>}
      </ul>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 3: hasil & unduh                                                */
/* ------------------------------------------------------------------ */

interface RenderedImages {
  weeks: { weekNo: number; label: string; canvas: HTMLCanvasElement; url: string }[];
  roster: { canvas: HTMLCanvasElement; url: string }[];
}

function useRenderedImages(data: ScheduleData | null, columns: RosterColumn[], sort: RosterSort) {
  const [images, setImages] = useState<RenderedImages | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setImages(null);
    if (!data) return;
    (async () => {
      try {
        await loadPosterFonts();
        if (cancelled) return;
        const weeks = data.weeks.map((w) => {
          const canvas = renderWeekPoster(data, w);
          return { weekNo: w.weekNo, label: weekRangeLabel(w.dates), canvas, url: canvas.toDataURL('image/png') };
        });
        const roster = renderRosterPages(data.agents, data.year, data.month, columns, sort, data.hubName).map((canvas) => ({
          canvas,
          url: canvas.toDataURL('image/png')
        }));
        if (!cancelled) setImages({ weeks, roster });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal membuat poster.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, columns, sort]);
  return { images, error };
}

const ResultTab: React.FC<{ result: GenerateResult | null; stale: boolean; onGoPublish: () => void }> = ({ result, stale, onGoPublish }) => {
  const [columns, setColumns] = useState<RosterColumn[]>([...ROSTER_COLUMNS]);
  const [sort, setSort] = useState<RosterSort>('default');
  const [period, setPeriod] = useState<number>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const data = result?.data ?? null;
  const { images, error } = useRenderedImages(data, columns, sort);

  if (!result || !data) {
    return <p className={`${card} text-sm text-slate-600`}>Belum ada jadwal. Lakukan generate di tab 2.</p>;
  }

  const tag = `${data.year}-${String(data.month).padStart(2, '0')}`;
  const scheduledAgents = new Set(Object.values(data.assignments).flatMap((l) => l.map((e) => e.agentId))).size;
  const shownWarnings = result.warnings.filter((w) => /hari aktif|dari target|tidak memiliki/.test(w));
  const week = images?.weeks.find((w) => w.weekNo === period) ?? images?.weeks[0];

  const allPngs = async () => {
    if (!images) return [];
    return Promise.all([...images.roster.map((r) => r.canvas), ...images.weeks.map((w) => w.canvas)].map(canvasToPng));
  };

  return (
    <div className="space-y-5">
      {stale && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Data atau konfigurasi berubah setelah generate. Klik <b>Acak ulang</b> di tab 2 untuk hasil terbaru.
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Agen terjadwal', scheduledAgents],
          ['Hari libur', Object.keys(data.holidays).length],
          ['Periode poster', data.weeks.length]
        ].map(([label, value]) => (
          <div key={label} className={card}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </div>
      {!result.validation.ok &&
        result.validation.messages.map((m) => (
          <p key={m} className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {m}
          </p>
        ))}
      {shownWarnings.map((w) => (
        <p key={w} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {w}
        </p>
      ))}

      <div className={`${card} flex flex-wrap gap-3 items-center justify-between`}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={busy !== null}
            onClick={async () => {
              setBusy('excel');
              downloadBytes(await buildScheduleWorkbook(data), `floor_time_${tag}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              setBusy(null);
            }}
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!images || busy !== null}
            onClick={async () => {
              setBusy('zip');
              const pngs = await allPngs();
              const names = [
                ...images!.roster.map((_, i) => `00_daftar_agen_${tag}_hal${i + 1}.png`),
                ...images!.weeks.map((w) => `floor_time_${tag}_periode_${String(w.weekNo).padStart(2, '0')}.png`)
              ];
              downloadBytes(await buildZip(pngs.map((p, i) => ({ name: names[i], data: p }))), `floor_time_png_${tag}.zip`, 'application/zip');
              setBusy(null);
            }}
          >
            <Download className="w-4 h-4" />
            PNG (ZIP)
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!images || busy !== null}
            onClick={async () => {
              setBusy('pdf');
              downloadBytes(await buildPdfFromPngs(await allPngs()), `floor_time_${tag}.pdf`, 'application/pdf');
              setBusy(null);
            }}
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          {busy && <span className="self-center text-xs text-slate-500">Menyiapkan file…</span>}
        </div>
        <button type="button" className={btnPrimary} onClick={onGoPublish}>
          <Send className="w-4 h-4" />
          Terbitkan ke portal
        </button>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-end gap-4">
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">Kolom daftar agen</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {ROSTER_COLUMNS.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={columns.includes(c)}
                    onChange={(e) =>
                      setColumns(e.target.checked ? ROSTER_COLUMNS.filter((x) => columns.includes(x) || x === c) : columns.filter((x) => x !== c))
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="text-xs font-semibold text-slate-700">
            Urutan total kehadiran
            <select value={sort} onChange={(e) => setSort(e.target.value as RosterSort)} className={`${input} mt-1`}>
              <option value="default">Sesuai file</option>
              <option value="desc">Terbanyak ke terendah</option>
              <option value="asc">Terendah ke terbanyak</option>
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {!images && !error && <p className="mt-4 text-sm text-slate-500">Membuat poster…</p>}
        {images && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">Daftar agen bulanan ({images.roster.length} halaman)</p>
              {images.roster.map((r, i) => (
                <img key={i} src={r.url} alt={`Daftar agen halaman ${i + 1}`} className="w-full rounded-lg border border-slate-200" />
              ))}
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Poster mingguan
                <select value={week?.weekNo ?? 1} onChange={(e) => setPeriod(Number(e.target.value))} className={`${input} mt-1`}>
                  {images.weeks.map((w) => (
                    <option key={w.weekNo} value={w.weekNo}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              {week && <img src={week.url} alt={`Poster ${week.label}`} className="w-full rounded-lg border border-slate-200" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 4: terbitkan & kelola request                                   */
/* ------------------------------------------------------------------ */

const PublishTab: React.FC<{
  result: GenerateResult | null;
  stale: boolean;
  onShowResult: (r: GenerateResult) => void;
}> = ({ result, stale, onShowResult }) => {
  const { auth } = useAdmin();
  const store = getScheduleStore();
  const today = todayInJakarta();
  const [deadline, setDeadline] = useState<string>(() => deadlineToLocalInput(defaultRequestDeadline(today)));
  const [list, setList] = useState<{ id: string; year: number; month: number; requestDeadline: string }[]>([]);
  const [selected, setSelected] = useState<PublishedSchedule | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const loadList = useCallback(async () => {
    try {
      setList(await store.listSchedules());
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memuat jadwal.' });
    }
  }, [store]);

  const loadSelected = useCallback(
    async (year: number, month: number) => {
      const s = await store.getSchedule(year, month);
      setSelected(s);
      setRequests(s ? await store.listRequests(s.id, auth) : []);
    },
    [store, auth]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handlePublish = async () => {
    if (!result) return;
    setBusy(true);
    setMessage(null);
    try {
      const iso = localInputToDeadline(deadline);
      await store.publish(result.data, iso, auth);
      setMessage({
        type: 'ok',
        text: `Jadwal ${monthLabel(result.data.year, result.data.month)} diterbitkan. Request dibuka sampai ${formatDeadlineWib(iso)}.`
      });
      await loadList();
      await loadSelected(result.data.year, result.data.month);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menerbitkan jadwal.' });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (req: ChangeRequest, approve: boolean) => {
    if (!selected) return;
    setMessage(null);
    try {
      if (approve) {
        const applied = applyChangeRequest(selected.data, req);
        if (applied.error || !applied.data) throw new Error(applied.error ?? 'Request tidak bisa diterapkan.');
        await store.updateSchedule(selected.id, { data: applied.data }, auth);
      }
      await store.setRequestStatus(req.id, approve ? 'approved' : 'rejected', auth);
      setMessage({ type: 'ok', text: `Request ${req.agentName} ${approve ? 'disetujui dan jadwal diperbarui' : 'ditolak'}.` });
      await loadSelected(selected.data.year, selected.data.month);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memproses request.' });
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-5">
      {message && (
        <p
          className={`rounded-xl border p-3 text-sm ${
            message.type === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className={card}>
        <p className="text-sm font-bold text-slate-950">Terbitkan jadwal hasil generate</p>
        {result ? (
          <>
            <p className="mt-1 text-xs text-slate-600">
              {monthLabel(result.data.year, result.data.month)} · {result.data.agents.length} agen. Jadwal yang sudah terbit untuk
              bulan yang sama akan diganti.
            </p>
            {stale && <p className="mt-2 text-xs text-amber-800">Konfigurasi berubah setelah generate — pastikan hasilnya sudah benar.</p>}
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Batas request advisor (WIB)
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={`${input} mt-1`}
                />
              </label>
              <button type="button" onClick={handlePublish} disabled={busy || !deadline} className={btnPrimary}>
                <Send className="w-4 h-4" />
                {busy ? 'Menerbitkan…' : 'Terbitkan ke portal'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Bawaan: hari Minggu pada minggu tayang pukul 23:59 (tayang Senin → batas Minggu). Setelah batas lewat, advisor tidak bisa
              mengajukan request lagi.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-600">Generate jadwal di tab 2 terlebih dahulu.</p>
        )}
      </div>

      <div className={card}>
        <p className="text-sm font-bold text-slate-950">Jadwal yang sudah terbit</p>
        {list.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Belum ada jadwal yang diterbitkan.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void loadSelected(s.year, s.month)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                  selected?.id === s.id ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-300'
                }`}
              >
                {monthLabel(s.year, s.month)}
                <span className={`ml-2 font-normal ${isRequestOpen(s.requestDeadline) ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {isRequestOpen(s.requestDeadline) ? 'request dibuka' : 'request ditutup'}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Ubah batas request (WIB)
                <input
                  type="datetime-local"
                  defaultValue={deadlineToLocalInput(selected.requestDeadline)}
                  key={selected.requestDeadline}
                  onBlur={async (e) => {
                    const iso = localInputToDeadline(e.target.value);
                    if (iso === selected.requestDeadline || !e.target.value) return;
                    await store.updateSchedule(selected.id, { requestDeadline: iso }, auth);
                    setMessage({ type: 'ok', text: `Batas request diubah menjadi ${formatDeadlineWib(iso)}.` });
                    await loadSelected(selected.data.year, selected.data.month);
                    await loadList();
                  }}
                  className={`${input} mt-1`}
                />
              </label>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => onShowResult({ data: selected.data, warnings: [], validation: { ok: true, messages: [] } })}
              >
                Lihat & unduh poster terbaru
              </button>
              <ConfirmCancelButton
                label="Hapus jadwal terbit"
                confirmLabel="Ya, hapus"
                onConfirm={async () => {
                  await store.deleteSchedule(selected.id, auth);
                  setSelected(null);
                  setRequests([]);
                  await loadList();
                }}
              />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-950">
                Request advisor <span className="font-normal text-slate-500">({pending.length} menunggu)</span>
              </p>
              {requests.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Belum ada request.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {requests.map((r) => (
                    <li key={r.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                      <div className="text-sm">
                        <p className="font-semibold text-slate-900">{r.agentName}</p>
                        <p className="text-xs text-slate-600">
                          {r.fromSlot ? `Pindah dari ${slotLabel(selected.data, r.fromSlot)} → ` : 'Tambah jadwal: '}
                          {slotLabel(selected.data, r.toSlot)}
                        </p>
                        {r.reason && <p className="text-xs text-slate-500 mt-0.5">Alasan: {r.reason}</p>}
                      </div>
                      {r.status === 'pending' ? (
                        <div className="flex gap-2 shrink-0">
                          <button type="button" className={btnPrimary} onClick={() => void decide(r, true)}>
                            <Check className="w-4 h-4" />
                            Setujui
                          </button>
                          <button type="button" className={btnSecondary} onClick={() => void decide(r, false)}>
                            <X className="w-4 h-4" />
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-bold ${r.status === 'approved' ? 'text-emerald-700' : 'text-slate-500'}`}
                        >
                          {r.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
