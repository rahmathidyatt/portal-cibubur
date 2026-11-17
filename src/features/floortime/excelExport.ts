import {
  agentUnit,
  DAY_NAMES_ID,
  formatDateId,
  monthLabel,
  previousMonth,
  weekdayOf,
  weekRangeLabel,
  type ScheduleData
} from './engine';
import { buildXlsx, type SheetCell, type SheetSpec } from './spreadsheet';

const H = (value: string): SheetCell => ({ value, style: 2 });

/** Susunan sheet sama dengan versi Python: Overview, Periode n, Data Detail. */
export function scheduleWorkbookSheets(data: ScheduleData): SheetSpec[] {
  const totalAssignments = Object.values(data.assignments).reduce((n, l) => n + l.length, 0);
  const [py, pm] = previousMonth(data.year, data.month);

  const overview: SheetSpec = {
    name: 'Overview',
    merges: ['A1:H1'],
    columnWidths: [18, 30, 14, 24, 38, 16],
    rows: [
      [{ value: `FLOOR TIME SCHEDULE - ${data.hubName}`, style: 3 }],
      [],
      [{ value: 'Target Schedule', style: 1 }, monthLabel(data.year, data.month)],
      [{ value: 'Data Reference', style: 1 }, monthLabel(py, pm)],
      [{ value: 'Total Agen Bertugas', style: 1 }, data.agents.length],
      [{ value: 'Hari Libur', style: 1 }, Object.keys(data.holidays).length],
      [{ value: 'Total Assignment', style: 1 }, totalAssignments],
      [],
      [],
      [],
      [H('Agent ID'), H('Nama'), H('Kode'), H('Jabatan'), H('Unit'), H('Total Kehadiran')],
      ...data.agents.map((a) => [a.id, a.name, a.code, a.jobTitle, agentUnit(a), a.attendance])
    ]
  };

  const periodSheets: SheetSpec[] = data.weeks.map((week) => {
    const rows: SheetSpec['rows'] = [
      [{ value: 'FLOOR TIME SCHEDULE', style: 3 }],
      [{ value: weekRangeLabel(week.dates), style: 1 }],
      [],
      [H('Hari'), H('Tanggal'), H('Shift / Keterangan'), H('Jam'), H('Agen')]
    ];
    for (const date of week.dates) {
      const day = DAY_NAMES_ID[weekdayOf(date)];
      if (data.holidays[date] !== undefined) {
        rows.push(
          [day, formatDateId(date), data.holidays[date], '-', '-'].map((v) => ({ value: v, style: 5 as const }))
        );
        continue;
      }
      const slots = data.slots.filter((s) => s.date === date).sort((a, b) => a.shiftIndex - b.shiftIndex);
      for (const slot of slots) {
        const entries = data.assignments[slot.key] ?? [];
        const agentText = entries.map((e) => `• ${e.displayName}`).join('\n') || 'Slot Belum Terisi';
        rows.push(
          [day, formatDateId(date), slot.shiftName, slot.timeLabel, agentText].map((v) => ({
            value: v,
            style: 4 as const
          }))
        );
      }
    }
    return {
      name: `Periode ${week.weekNo}`,
      merges: ['A1:E1', 'A2:E2'],
      columnWidths: [16, 19, 30, 18, 42],
      rows
    };
  });

  const agentMap = new Map(data.agents.map((a) => [a.id, a]));
  const detailHeader = [
    'Minggu Internal', 'Tanggal', 'Hari', 'Shift', 'Jam', 'Urutan', 'Agent ID',
    'Agen', 'Kode', 'Jabatan', 'Unit', 'Kehadiran Bulan Sebelumnya'
  ];
  const detailRows: SheetSpec['rows'] = [detailHeader.map((h) => ({ value: h, style: 1 as const }))];
  for (const slot of data.slots) {
    (data.assignments[slot.key] ?? []).forEach((entry, i) => {
      const agent = agentMap.get(entry.agentId);
      detailRows.push([
        slot.weekNo,
        slot.date,
        DAY_NAMES_ID[slot.weekday],
        slot.shiftName,
        slot.timeLabel,
        i + 1,
        entry.agentId,
        entry.displayName,
        agent?.code ?? '',
        agent?.jobTitle ?? '',
        agent ? agentUnit(agent) : '',
        agent?.attendance ?? 0
      ]);
    });
  }
  const detail: SheetSpec = {
    name: 'Data Detail',
    columnWidths: detailHeader.map(() => 22),
    rows: detailRows.length > 1 ? detailRows : [['Belum ada data.']]
  };

  return [overview, ...periodSheets, detail];
}

export function buildScheduleWorkbook(data: ScheduleData): Promise<Uint8Array> {
  return buildXlsx(scheduleWorkbookSheets(data));
}

/** Template impor agen (sama dengan template_import_agents.xlsx). */
export function buildAgentTemplate(): Promise<Uint8Array> {
  return buildXlsx([
    {
      name: 'Agen',
      columnWidths: [6, 30, 22, 36, 10],
      rows: [
        ['No', 'Nama', 'Jabatan', 'Office', 'Total'].map((h) => ({ value: h, style: 1 as const })),
        [1, 'TONI (ACYS)', 'Business Manager', 'Brighton Priority Cibubur, Bogor', 13],
        [2, 'VIRA (AUTU)', 'Business Manager', 'Brighton Warrior Cibubur, Bogor', 9]
      ]
    }
  ]);
}
