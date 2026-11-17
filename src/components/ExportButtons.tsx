import React, { useState } from 'react';
import { FileDown } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { downloadBytes } from '../features/floortime/posterRenderer';
import { buildReportXlsx, type ReportDoc } from '../utils/report';

/** Tombol Unduh Excel & PDF untuk laporan admin. */
export const ExportButtons: React.FC<{
  fileBase: string;
  disabled?: boolean;
  /** Dipanggil saat tombol ditekan agar data yang dipakai selalu yang terbaru. */
  build: () => { name: string; doc: ReportDoc }[];
}> = ({ fileBase, disabled, build }) => {
  const toast = useToast();
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);
  const run = async (kind: 'xlsx' | 'pdf') => {
    setBusy(kind);
    try {
      const sheets = build();
      if (kind === 'xlsx') {
        downloadBytes(
          await buildReportXlsx(sheets),
          `${fileBase}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        const { renderReportPdf } = await import('../utils/reportPdf');
        const doc: ReportDoc = {
          title: sheets[0].doc.title,
          subtitle: sheets[0].doc.subtitle,
          tables: sheets.flatMap((s, i) =>
            i === 0 ? s.doc.tables : s.doc.tables.map((t) => ({ ...t, title: `${s.doc.title} · ${t.title ?? ''}` }))
          ),
          notes: sheets.flatMap((s) => s.doc.notes ?? [])
        };
        downloadBytes(await renderReportPdf(doc), `${fileBase}.pdf`, 'application/pdf');
      }
      toast(`File ${kind === 'xlsx' ? 'Excel' : 'PDF'} diunduh.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat file.', 'error');
    } finally {
      setBusy(null);
    }
  };
  const cls =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';
  return (
    <>
      <button type="button" disabled={disabled || busy !== null} onClick={() => void run('xlsx')} className={cls}>
        <FileDown className="h-4 w-4 text-green-700" />
        {busy === 'xlsx' ? 'Membuat…' : 'Unduh Excel'}
      </button>
      <button type="button" disabled={disabled || busy !== null} onClick={() => void run('pdf')} className={cls}>
        <FileDown className="h-4 w-4 text-red-700" />
        {busy === 'pdf' ? 'Membuat…' : 'Unduh PDF'}
      </button>
    </>
  );
};
