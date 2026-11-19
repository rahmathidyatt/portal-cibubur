import React, { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { todayInJakarta } from '../../utils/schedule';
import { downloadBytes } from '../floortime/posterRenderer';
import { ATTENDANCE_SHEETS, attendanceDateLine, attendanceFileName, type AttendanceKind } from './attendance';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';

const KINDS: AttendanceKind[] = ['tamu', 'pa'];

/** Menu admin Bright Day › Daftar hadir: cukup pilih tanggal acara, kedua lembar ikut berganti. */
export const AttendancePage: React.FC = () => {
  const toast = useToast();
  const [date, setDate] = useState<string>(todayInJakarta());
  const [previews, setPreviews] = useState<Record<AttendanceKind, string>>({ tamu: '', pa: '' });
  const [busy, setBusy] = useState<AttendanceKind | null>(null);
  const valid = attendanceDateLine(date) !== '';

  useEffect(() => {
    if (!valid) return;
    const t = window.setTimeout(async () => {
      const { attendancePreview } = await import('./attendancePdf');
      setPreviews({ tamu: attendancePreview('tamu', date), pa: attendancePreview('pa', date) });
    }, 150);
    return () => window.clearTimeout(t);
  }, [date, valid]);

  const download = async (kind: AttendanceKind) => {
    setBusy(kind);
    try {
      const { buildAttendancePdf } = await import('./attendancePdf');
      downloadBytes(await buildAttendancePdf(kind, date), attendanceFileName(kind, date), 'application/pdf');
      toast(`${attendanceFileName(kind, date)} diunduh.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat PDF.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Bright Day</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Daftar hadir</h1>

        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <label className="text-xs font-semibold text-slate-700">
            Hari & tanggal acara
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1 w-56`} aria-label="Tanggal acara" />
          </label>
          <p className="pb-2 text-sm font-bold text-slate-900">{attendanceDateLine(date)}</p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {KINDS.map((kind) => (
            <div key={kind} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-950">{ATTENDANCE_SHEETS[kind].label}</h2>
                <button type="button" onClick={() => void download(kind)} disabled={!valid || busy !== null} className={ghostBtn}>
                  <FileDown className="h-4 w-4 text-red-700" />
                  {busy === kind ? 'Membuat…' : 'Unduh PDF'}
                </button>
              </div>
              {previews[kind] ? (
                <img src={previews[kind]} alt={ATTENDANCE_SHEETS[kind].label} className="w-full" />
              ) : (
                <div className="grid aspect-[595/842] place-items-center text-xs text-slate-400">Menyiapkan pratinjau…</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
