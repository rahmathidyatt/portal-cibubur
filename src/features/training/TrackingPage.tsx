import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, X } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { TRAINING_MODULES, PASS_SCORE, markToEnter, setScore, type TrainingAgent } from './training';
import { getTrainingStore } from './trainingStore';
import { matchRecap, parseRecapFile, type AgentFindings, type RecapFile } from './tracking';

const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';

const TITLE = Object.fromEntries(TRAINING_MODULES.map((m) => [m.id, m.title]));

/** Menu admin Training Brighton › Tracking Nilai: unggah rekap nilai pusat, cocokkan, lalu konfirmasi. */
export const TrackingPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const store = getTrainingStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [agents, setAgents] = useState<TrainingAgent[] | null>(null);
  const [recap, setRecap] = useState<{ file: string; data: RecapFile } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Baris yang dicentang per agen: `${agentId}:${moduleId}`. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    store
      .list(auth)
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [store, auth]);

  const results: AgentFindings[] = recap && agents ? matchRecap(agents, recap.data).filter((r) => !dismissed.has(r.agent.id)) : [];

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const { readXlsxGrid } = await import('../../utils/xlsxGrid');
      const data = parseRecapFile(await readXlsxGrid(new Uint8Array(await file.arrayBuffer())));
      if (data.sessions.length === 0) throw new Error('Format rekap tidak dikenali. Pastikan ada kolom Skor dan Nama.');
      setRecap({ file: file.name, data });
      setDismissed(new Set());
      // Bawaan: centang baris yang cocok lewat kode PA; yang hanya mirip dicek manual.
      const found = agents ? matchRecap(agents, data) : [];
      setPicked(new Set(found.flatMap((r) => r.findings.filter((f) => f.level === 'kode').map((f) => `${r.agent.id}:${f.moduleId}`))));
      toast(`${data.sessions.length} sesi terbaca, ${found.length} agen ditemukan.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'File tidak dapat dibaca.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirm = async (r: AgentFindings) => {
    const chosen = r.findings.filter((f) => picked.has(`${r.agent.id}:${f.moduleId}`));
    if (chosen.length === 0) return toast('Centang minimal satu sesi yang benar milik agen ini.', 'error');
    let next = r.agent;
    for (const f of chosen) next = setScore(next, f.moduleId, f.row.score);
    // Oranye di Rekap Nilai sampai ditandai sudah diinput ke web resmi Brighton.
    next = markToEnter(next, chosen.map((f) => f.moduleId));
    try {
      await store.save(next, auth);
      setAgents((list) => list?.map((a) => (a.id === next.id ? next : a)) ?? null);
      setDismissed((d) => new Set(d).add(next.id));
      toast(`Nilai ${next.name} disimpan (${chosen.length} sesi).`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan nilai.', 'error');
    }
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Training Brighton</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Tracking Nilai</h1>
            <p className="mt-1 text-sm text-slate-600">
              Unggah rekap nilai Bright On dari pusat. Nilai dicocokkan dengan agen di rekap lewat kode, nama, unit & lokasi — periksa lalu
              konfirmasi.
            </p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || agents === null} className={ghostBtn}>
            <FileSpreadsheet className="h-4 w-4 text-green-700" />
            {busy ? 'Membaca file…' : 'Unggah rekap nilai (Excel)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            aria-label="Unggah rekap nilai"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
        </div>

        {recap && (
          <p className="mt-4 text-xs text-slate-600">
            <b>{recap.file}</b> · {recap.data.sessions.length} sesi · {recap.data.rows.length.toLocaleString('id-ID')} baris nilai
          </p>
        )}

        {!recap ? (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada file. Unggah file rekap (satu sheet per sesi, kolom Skor, Nama, Unit, Kode, Lokasi).
          </div>
        ) : results.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Tidak ada nilai baru untuk agen di rekap.
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {results.map((r) => {
              const count = r.findings.filter((f) => picked.has(`${r.agent.id}:${f.moduleId}`)).length;
              return (
                <li key={r.agent.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-950">
                      {r.agent.name}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          r.level === 'kode' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {r.level === 'kode' ? 'Kode cocok' : 'Perlu dicek'}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDismissed((s) => new Set(s).add(r.agent.id))}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        Bukan agen ini
                      </button>
                      <button type="button" onClick={() => void confirm(r)} disabled={count === 0} className={primaryBtn}>
                        <CheckCircle2 className="h-4 w-4" />
                        Konfirmasi {count} sesi
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="bg-stone-50 text-left text-[11px] font-bold text-slate-600">
                          <th className="w-10 px-3 py-2" />
                          <th className="px-2 py-2">Sesi</th>
                          <th className="px-2 py-2 text-center">Skor</th>
                          <th className="px-2 py-2">Nama di rekap</th>
                          <th className="px-2 py-2">Unit</th>
                          <th className="px-2 py-2">Kode</th>
                          <th className="px-2 py-2">Lokasi</th>
                          <th className="px-2 py-2">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.findings.map((f) => {
                          const key = `${r.agent.id}:${f.moduleId}`;
                          return (
                            <tr key={key} className="border-t border-slate-100">
                              <td className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={picked.has(key)}
                                  onChange={() => toggle(key)}
                                  aria-label={`${r.agent.name} · ${TITLE[f.moduleId]}`}
                                  className="h-4 w-4 accent-amber-500"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-xs font-semibold text-slate-800">
                                {TITLE[f.moduleId]}
                                {f.level === 'nama' && <span className="ml-1 text-[10px] font-bold text-amber-700">(nama/kode mirip)</span>}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span
                                  className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                                    f.row.score >= PASS_SCORE ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {f.row.score}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-xs text-slate-800">{f.row.name}</td>
                              <td className="px-2 py-1.5 text-xs text-slate-600">{f.row.unit}</td>
                              <td className="px-2 py-1.5 text-xs text-slate-600">{f.row.rawCode}</td>
                              <td className="px-2 py-1.5 text-xs text-slate-600">{f.row.location}</td>
                              <td className="px-2 py-1.5 text-xs tabular-nums text-slate-500">{f.row.date}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
