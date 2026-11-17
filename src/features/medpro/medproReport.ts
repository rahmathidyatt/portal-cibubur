import { c, type ReportDoc, type ReportTable } from '../../utils/report';
import {
  formatLongId,
  formatShortId,
  groupByPaidOn,
  invoiceBr,
  notaTotal,
  sortNotas,
  summarize,
  type MedproDrop,
  type MedproNota
} from './medpro';

const COLS = [
  { label: 'TANGGAL', width: 12 },
  { label: 'INVOICE BR', width: 20 },
  { label: 'INVOICE', width: 26 },
  { label: 'BANNER/PLANK', width: 15, align: 'right' as const },
  { label: 'ALAT BRANDING', width: 15, align: 'right' as const },
  { label: 'TOTAL', width: 15, align: 'right' as const }
];

function notaTable(title: string, subtitle: string, notas: MedproNota[]): ReportTable {
  const sorted = sortNotas(notas);
  const s = summarize(sorted);
  return {
    title,
    subtitle,
    columns: COLS,
    rows: sorted.map((n, i) => [
      c(i === 0 || sorted[i - 1].date !== n.date ? formatShortId(n.date) : ''),
      c(invoiceBr(n.invoice), n.checked ? { fill: '00FF00', bold: true } : { bold: true }),
      c(n.invoice + (n.note ? ` (${n.note})` : '')),
      c(n.banner || '', { money: true }),
      c(n.branding || '', { money: true }),
      c(notaTotal(n), { money: true, bold: true })
    ]),
    footer: [
      c('TOTAL TAGIHAN', { fill: 'FFB3B3' }),
      c(`${s.count} nota`, { fill: 'FFB3B3' }),
      c(`${s.checked}/${s.count} sesuai`, { fill: 'FFB3B3' }),
      c(s.banner, { fill: 'FFB3B3', money: true }),
      c(s.branding, { fill: 'FFB3B3', money: true }),
      c(s.total, { fill: 'FFB3B3', money: true })
    ]
  };
}

export function medproReport(notas: MedproNota[], payday: string, printedAt: string): ReportDoc {
  const active = notas.filter((n) => !n.paidOn);
  const tables: ReportTable[] = [];
  if (active.length) tables.push(notaTable('PERIODE BERJALAN', `Jadwal bayar ${formatLongId(payday)}`, active));
  for (const g of groupByPaidOn(notas)) tables.push(notaTable(`DIBAYAR ${formatLongId(g.paidOn).toUpperCase()}`, '', g.items));
  return {
    title: 'NOTA MEDPRO BRIGHTON CIBUBUR',
    subtitle: `Dicetak ${printedAt} · ${notas.length} nota`,
    tables,
    notes: ['INVOICE BR hijau = nominal sudah dicek & sesuai.']
  };
}

export function dropReport(drops: MedproDrop[], printedAt: string): ReportDoc {
  const groups: { title: string; items: MedproDrop[] }[] = [];
  const active = drops.filter((d) => !d.paidOn);
  if (active.length) groups.push({ title: 'BELUM DIBAYAR', items: active });
  for (const g of groupByPaidOn(drops)) groups.push({ title: `DIBAYAR ${formatLongId(g.paidOn).toUpperCase()}`, items: g.items });
  return {
    title: 'NOTA DROP BANNER',
    subtitle: `Dicetak ${printedAt} · ${drops.length} nota`,
    tables: groups.map((g) => {
      const sorted = sortNotas(g.items);
      const total = sorted.reduce((s, d) => s + d.amount, 0);
      return {
        title: g.title,
        columns: [
          { label: 'TANGGAL', width: 12 },
          { label: 'KANTOR TUJUAN', width: 20 },
          { label: 'NOMOR NOTA', width: 20 },
          { label: 'NOMINAL', width: 15, align: 'right' as const }
        ],
        rows: sorted.map((d) => [
          c(formatShortId(d.date)),
          c(d.office, { bold: true }),
          c(d.notaNo, d.checked ? { fill: '00FF00' } : {}),
          c(d.amount, { money: true })
        ]),
        footer: [c('TOTAL', { fill: 'FFB3B3' }), c('', { fill: 'FFB3B3' }), c(`${sorted.length} nota`, { fill: 'FFB3B3' }), c(total, { fill: 'FFB3B3', money: true })]
      };
    })
  };
}
