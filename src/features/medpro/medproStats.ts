import { c, type ReportDoc } from '../../utils/report';
import { formatLongId, notaTotal, type MedproDrop, type MedproNota } from './medpro';

/** Rekap & analisis biaya Nota Medpro (banner/plank, alat branding, drop banner). */

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export interface Point {
  label: string;
  count: number;
}

export interface MedproStats {
  notaCount: number;
  banner: number;
  branding: number;
  drop: number;
  total: number;
  /** Tahun tertentu: total biaya per bulan. Semua tahun: per tahun. */
  timeline: Point[];
  /** Pembayaran (tanggal 14 & 28) terbaru dulu. */
  payments: { paidOn: string; notas: number; drops: number; total: number }[];
  dropByOffice: Point[];
}

export function medproYears(notas: MedproNota[], drops: MedproDrop[]): string[] {
  return [...new Set<string>([...notas, ...drops].map((x) => x.date.slice(0, 4)))].sort().reverse();
}

/** Ringkas: Rp 1,2 jt / Rp 850 rb. */
export function shortRupiah(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
}

export function computeMedproStats(notas: MedproNota[], drops: MedproDrop[], year: string): MedproStats {
  const ns = notas.filter((n) => !year || n.date.startsWith(year));
  const ds = drops.filter((d) => !year || d.date.startsWith(year));
  const banner = ns.reduce((s, n) => s + n.banner, 0);
  const branding = ns.reduce((s, n) => s + n.branding, 0);
  const drop = ds.reduce((s, d) => s + d.amount, 0);
  const sumIn = (prefix: string) =>
    ns.filter((n) => n.date.startsWith(prefix)).reduce((s, n) => s + notaTotal(n), 0) +
    ds.filter((d) => d.date.startsWith(prefix)).reduce((s, d) => s + d.amount, 0);
  const timeline = year
    ? MONTH_SHORT.map((label, i) => ({ label, count: sumIn(`${year}-${String(i + 1).padStart(2, '0')}`) }))
    : [...new Set<string>([...ns, ...ds].map((x) => x.date.slice(0, 4)))].sort().map((y) => ({ label: y, count: sumIn(y) }));

  const pay = new Map<string, { paidOn: string; notas: number; drops: number; total: number }>();
  for (const n of ns) {
    if (!n.paidOn) continue;
    const p = pay.get(n.paidOn) ?? { paidOn: n.paidOn, notas: 0, drops: 0, total: 0 };
    p.notas++;
    p.total += notaTotal(n);
    pay.set(n.paidOn, p);
  }
  for (const d of ds) {
    if (!d.paidOn) continue;
    const p = pay.get(d.paidOn) ?? { paidOn: d.paidOn, notas: 0, drops: 0, total: 0 };
    p.drops++;
    p.total += d.amount;
    pay.set(d.paidOn, p);
  }
  const office = new Map<string, number>();
  for (const d of ds) office.set(d.office.trim().toUpperCase(), (office.get(d.office.trim().toUpperCase()) ?? 0) + d.amount);

  return {
    notaCount: ns.length,
    banner,
    branding,
    drop,
    total: banner + branding + drop,
    timeline,
    payments: [...pay.values()].sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
    dropByOffice: [...office.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  };
}

const HEAD = 'FFD54F';
const money = (n: number) => c(n, { money: true, align: 'right' });

export function medproRecapSheets(notas: MedproNota[], drops: MedproDrop[], year: string, printedAt: string): { name: string; doc: ReportDoc }[] {
  const ns = notas.filter((n) => !year || n.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
  const ds = drops.filter((d) => !year || d.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
  const st = computeMedproStats(notas, drops, year);
  const sub = `Brighton HUB Cibubur · ${year ? `Tahun ${year}` : 'Semua tahun'} · dicetak ${printedAt}`;
  const months = [...new Set<string>([...ns, ...ds].map((x) => x.date.slice(0, 7)))].sort();
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return [
    {
      name: 'PER BULAN',
      doc: {
        title: 'REKAP MEDPRO PER BULAN',
        subtitle: sub,
        tables: [
          {
            columns: [
              { label: 'Bulan', width: 18, fill: HEAD },
              { label: 'Jumlah nota', width: 12, align: 'center', fill: HEAD },
              { label: 'Banner / plank', width: 18, align: 'right', fill: HEAD },
              { label: 'Alat branding', width: 18, align: 'right', fill: HEAD },
              { label: 'Drop banner', width: 18, align: 'right', fill: HEAD },
              { label: 'Total', width: 18, align: 'right', fill: HEAD }
            ],
            rows: months.map((m) => {
              const mn = ns.filter((n) => n.date.startsWith(m));
              const md = ds.filter((d) => d.date.startsWith(m));
              const b = mn.reduce((s, n) => s + n.banner, 0);
              const br = mn.reduce((s, n) => s + n.branding, 0);
              const dr = md.reduce((s, d) => s + d.amount, 0);
              return [c(`${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`), c(mn.length, { align: 'center' }), money(b), money(br), money(dr), c(b + br + dr, { money: true, align: 'right', bold: true })];
            }),
            footer: [c('TOTAL', { bold: true }), c(st.notaCount, { align: 'center', bold: true }), money(st.banner), money(st.branding), money(st.drop), c(st.total, { money: true, align: 'right', bold: true })]
          }
        ]
      }
    },
    {
      name: 'PER PEMBAYARAN',
      doc: {
        title: 'REKAP PEMBAYARAN MEDPRO',
        subtitle: sub,
        tables: [
          {
            columns: [
              { label: 'Tanggal bayar', width: 26, fill: HEAD },
              { label: 'Nota', width: 10, align: 'center', fill: HEAD },
              { label: 'Drop', width: 10, align: 'center', fill: HEAD },
              { label: 'Total dibayar', width: 20, align: 'right', fill: HEAD }
            ],
            rows: [...st.payments].reverse().map((p) => [c(formatLongId(p.paidOn)), c(p.notas, { align: 'center' }), c(p.drops, { align: 'center' }), money(p.total)])
          }
        ]
      }
    },
    {
      name: 'DROP PER KANTOR',
      doc: {
        title: 'DROP BANNER PER KANTOR',
        subtitle: sub,
        tables: [
          {
            columns: [
              { label: 'No', width: 6, align: 'center', fill: HEAD },
              { label: 'Kantor', width: 30, fill: HEAD },
              { label: 'Total', width: 20, align: 'right', fill: HEAD }
            ],
            rows: st.dropByOffice.map((o, i) => [c(i + 1, { align: 'center' }), c(o.label), money(o.count)])
          }
        ]
      }
    },
    {
      name: 'DATA NOTA',
      doc: {
        title: 'DATA NOTA MEDPRO',
        subtitle: sub,
        tables: [
          {
            columns: [
              { label: 'Tanggal', width: 22, fill: HEAD },
              { label: 'Invoice', width: 30, fill: HEAD },
              { label: 'Banner / plank', width: 16, align: 'right', fill: HEAD },
              { label: 'Alat branding', width: 16, align: 'right', fill: HEAD },
              { label: 'Total', width: 16, align: 'right', fill: HEAD },
              { label: 'Dibayar', width: 22, fill: HEAD }
            ],
            rows: ns.map((n) => [c(formatLongId(n.date)), c(n.invoice), money(n.banner), money(n.branding), money(notaTotal(n)), c(n.paidOn ? formatLongId(n.paidOn) : 'Periode berjalan')])
          }
        ]
      }
    }
  ];
}
