import { c, type ReportDoc } from '../../utils/report';
import { CLOSING_TYPES, formatClosingDate, mainAgents, type Closing, type ClosingType } from './closing';

/** Rekap & analisis data closing HUB Cibubur (bisa per tahun atau semua tahun). */

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export interface Ranked {
  label: string;
  count: number;
}

export interface ClosingStats {
  total: number;
  byType: Record<ClosingType, number>;
  /** Tahun tertentu: 12 bulan. Semua tahun: per tahun. */
  timeline: Ranked[];
  byUnit: Ranked[];
  byAgent: Ranked[];
  byLocation: Ranked[];
}

const title = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

export function unitName(unit: string): string {
  const u = unit.trim().replace(/^brighton\s+/i, '');
  return u ? `Brighton ${title(u)}` : 'Tanpa unit';
}

function rank(map: Map<string, number>, limit?: number): Ranked[] {
  const list = [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return limit ? list.slice(0, limit) : list;
}

export function closingYears(closings: Closing[]): string[] {
  return [...new Set<string>(closings.map((x) => x.date.slice(0, 4)))].sort().reverse();
}

/** year = "2026" atau "" (semua tahun). */
export function computeStats(closings: Closing[], year: string, limit = 10): ClosingStats {
  const items = closings.filter((x) => !year || x.date.startsWith(year));
  const byType = Object.fromEntries(CLOSING_TYPES.map((t) => [t, 0])) as Record<ClosingType, number>;
  const unit = new Map<string, number>();
  const agent = new Map<string, number>();
  const location = new Map<string, number>();
  for (const x of items) {
    byType[x.type] = (byType[x.type] ?? 0) + 1;
    location.set(x.location.trim().toUpperCase(), (location.get(x.location.trim().toUpperCase()) ?? 0) + 1);
    // Satu transaksi dihitung sekali per unit / per agen yang terlibat (tanpa Project Leader).
    const units = new Set(mainAgents(x).map((a) => unitName(a.unit)));
    for (const u of units) unit.set(u, (unit.get(u) ?? 0) + 1);
    const people = new Set(mainAgents(x).map((a) => `${a.name.trim().toUpperCase()}${a.code.trim() ? ` (${a.code.trim().toUpperCase()})` : ''}`));
    for (const p of people) agent.set(p, (agent.get(p) ?? 0) + 1);
  }
  let timeline: Ranked[];
  if (year) {
    timeline = MONTH_SHORT.map((label, i) => ({
      label,
      count: items.filter((x) => Number(x.date.slice(5, 7)) === i + 1).length
    }));
  } else {
    const years = [...new Set<string>(items.map((x) => x.date.slice(0, 4)))].sort();
    timeline = years.map((y) => ({ label: y, count: items.filter((x) => x.date.startsWith(y)).length }));
  }
  return { total: items.length, byType, timeline, byUnit: rank(unit, limit), byAgent: rank(agent, limit), byLocation: rank(location, limit) };
}

const HEAD = 'FFD54F';

function rankTable(t: string, label: string, list: Ranked[]) {
  return {
    title: t,
    columns: [
      { label: 'No', width: 6, align: 'center' as const, fill: HEAD },
      { label, width: 40, fill: HEAD },
      { label: 'Jumlah closing', width: 16, align: 'center' as const, fill: HEAD }
    ],
    rows: list.map((r, i) => [c(i + 1, { align: 'center' }), c(r.label), c(r.count, { align: 'center' })])
  };
}

/** Lembar-lembar Excel rekap closing. */
export function closingRecapSheets(closings: Closing[], year: string, printedAt: string): { name: string; doc: ReportDoc }[] {
  const items = closings.filter((x) => !year || x.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
  const stats = computeStats(closings, year, 0);
  const scope = year ? `Tahun ${year}` : 'Semua tahun';
  const sub = `Brighton HUB Cibubur · ${scope} · dicetak ${printedAt}`;
  const years = [...new Set<string>(items.map((x) => x.date.slice(0, 4)))].sort();
  return [
    {
      name: 'DATA CLOSING',
      doc: {
        title: 'DATA CLOSING',
        subtitle: sub,
        tables: [
          {
            columns: [
              { label: 'Tanggal', width: 20, fill: HEAD },
              { label: 'Jenis', width: 14, fill: HEAD },
              { label: 'Lokasi / properti', width: 28, fill: HEAD },
              { label: 'Peran', width: 14, align: 'center', fill: HEAD },
              { label: 'Agen', width: 24, fill: HEAD },
              { label: 'Kode', width: 9, align: 'center', fill: HEAD },
              { label: 'Unit', width: 20, fill: HEAD },
              { label: 'Area', width: 18, fill: HEAD }
            ],
            rows: items.flatMap((x) =>
              x.agents
                .filter((a) => a.name.trim())
                .map((a) => [
                  c(formatClosingDate(x.date)),
                  c(x.type),
                  c(x.location.trim().toUpperCase()),
                  c(a.role === 'PL' ? 'Project Leader' : a.role, { align: 'center' }),
                  c(a.name.trim()),
                  c(a.code.trim().toUpperCase(), { align: 'center' }),
                  c(unitName(a.unit)),
                  c(a.area.trim())
                ])
            )
          }
        ]
      }
    },
    {
      name: 'PER BULAN',
      doc: {
        title: 'CLOSING PER BULAN',
        subtitle: sub,
        tables: [
          {
            columns: [
              { label: 'Tahun', width: 10, align: 'center', fill: HEAD },
              ...MONTH_SHORT.map((m) => ({ label: m, width: 7, align: 'center' as const, fill: HEAD })),
              { label: 'Total', width: 9, align: 'center', fill: HEAD }
            ],
            rows: years.map((y) => {
              const counts = MONTH_SHORT.map((_, i) => items.filter((x) => x.date.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`)).length);
              return [
                c(y, { align: 'center', bold: true }),
                ...counts.map((n) => c(n, { align: 'center' })),
                c(counts.reduce((s, n) => s + n, 0), { align: 'center', bold: true })
              ];
            })
          }
        ]
      }
    },
    {
      name: 'PER JENIS',
      doc: {
        title: 'CLOSING PER JENIS TRANSAKSI',
        subtitle: sub,
        tables: [rankTable('Jenis transaksi', 'Jenis', CLOSING_TYPES.map((t) => ({ label: t, count: stats.byType[t] })))]
      }
    },
    { name: 'PER UNIT', doc: { title: 'CLOSING PER UNIT', subtitle: sub, tables: [rankTable('Unit', 'Unit', stats.byUnit)] } },
    { name: 'PER AGEN', doc: { title: 'CLOSING PER AGEN', subtitle: sub, tables: [rankTable('Agen', 'Agen', stats.byAgent)] } },
    { name: 'PER LOKASI', doc: { title: 'CLOSING PER LOKASI / PROPERTI', subtitle: sub, tables: [rankTable('Lokasi', 'Lokasi / properti', stats.byLocation)] } }
  ];
}
