import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  agentUnit,
  filterAgentsForSchedule,
  generateSchedule,
  getMonthWorkDates,
  groupDatesByWeek,
  previousMonth,
  rowsToAgents,
  sortAgentsForRoster,
  weekdayOf,
  weekRangeLabel,
  type Agent,
  type ScheduleConfig,
  type ScheduleData
} from './engine';
import {
  applyChangeRequest,
  defaultRequestDeadline,
  isRequestOpen,
  validateChangeRequest
} from './requests';
import { buildXlsx, parseCsv, readXlsx } from './spreadsheet';
import { scheduleWorkbookSheets } from './excelExport';

// Port dari test_floor_time.py (github.com/rahmathidyatt/floor-time)

function makeAgents(count: number): Agent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    name: `AGENT ${i}`,
    code: `C${String(i).padStart(3, '0')}`,
    office: i % 2 ? 'Brighton Paradise Cibubur' : 'Brighton Cibubur Bogor',
    jobTitle: '',
    attendance: 10 + i
  }));
}

function config(overrides: Partial<ScheduleConfig> = {}): ScheduleConfig {
  return {
    year: 2026,
    month: 9,
    hubName: 'HUB CIBUBUR',
    notes: [],
    weekdayCapacity: 4,
    saturdayCapacity: 3,
    maxWeekly: 2,
    holidays: {},
    urgentRequests: [],
    seed: 'test',
    ...overrides
  };
}

function entriesOf(data: ScheduleData) {
  const slotMap = new Map(data.slots.map((s) => [s.key, s]));
  return Object.entries(data.assignments).flatMap(([key, list]) =>
    list.map((e) => ({ ...e, slot: slotMap.get(key)! }))
  );
}

test('cross-month week & previous month cross-year', () => {
  const dates = getMonthWorkDates(2026, 9);
  assert.equal(dates[0], '2026-08-31');
  assert.equal(dates[dates.length - 1], '2026-10-03');
  const weeks = groupDatesByWeek(dates);
  assert.equal(weeks[0].dates[0], '2026-08-31');
  assert.equal(weeks[0].dates[weeks[0].dates.length - 1], '2026-09-05');
  assert.deepEqual(previousMonth(2027, 1), [2026, 12]);
  assert.equal(weekRangeLabel(weeks[0].dates), '31 AGUSTUS 2026 - 05 SEPTEMBER 2026');
});

test('kolom gaya Excel dinormalisasi & unit dari kata kedua Office', () => {
  const { agents, warnings } = rowsToAgents([
    { No: '1', Nama: 'TONI (ACYS)', Jabatan: 'Business Manager', Office: 'Brighton Priority Cibubur, Bogor', Total: '13' },
    { No: '2', Nama: 'toni (acys)', Jabatan: '', Office: '', Total: '1' }
  ]);
  assert.equal(agents.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(agents[0].name, 'TONI');
  assert.equal(agents[0].code, 'ACYS');
  assert.equal(agents[0].attendance, 13);
  assert.equal(agentUnit(agents[0]), 'Priority');
});

test('filter kehadiran minimum & pengecualian manual', () => {
  const agents = makeAgents(6); // kehadiran 10..15
  assert.deepEqual(filterAgentsForSchedule(agents, 13).map((a) => a.id), ['a3', 'a4', 'a5']);
  assert.deepEqual(filterAgentsForSchedule(agents, 13, ['a4']).map((a) => a.id), ['a3', 'a5']);
  assert.deepEqual(sortAgentsForRoster(agents, 'desc').map((a) => a.attendance)[0], 15);
});

test('setiap agen tepat sesuai target mingguan, tanpa dobel tanggal', () => {
  for (const count of [4, 24, 49, 60]) {
    for (const target of [1, 2, 3]) {
      const { data, validation } = generateSchedule(makeAgents(count), config({ maxWeekly: target, seed: 'exact' }));
      assert.ok(validation.ok, validation.messages.join('; '));
      const perWeek = new Map<string, number>();
      const perDate = new Set<string>();
      for (const e of entriesOf(data)) {
        const k = `${e.slot.weekNo}|${e.agentId}`;
        perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
        const d = `${e.agentId}|${e.slot.date}`;
        assert.ok(!perDate.has(d), `dobel tanggal ${d}`);
        perDate.add(d);
      }
      assert.equal(perWeek.size, data.weeks.length * count, `count=${count} target=${target}`);
      assert.ok([...perWeek.values()].every((n) => n === target));
    }
  }
});

test('rotasi hari antar minggu & kode audit konsisten', () => {
  const agents = makeAgents(49);
  for (const target of [1, 2, 3]) {
    const first = generateSchedule(agents, config({ maxWeekly: target, seed: 'rotation' })).data;
    const again = generateSchedule(agents, config({ maxWeekly: target, seed: 'rotation' })).data;
    assert.deepEqual(first.assignments, again.assignments);
    const byAgent = new Map<string, Map<number, Set<number>>>();
    for (const e of entriesOf(first)) {
      const weeks = byAgent.get(e.agentId) ?? new Map();
      const days = weeks.get(e.slot.weekNo) ?? new Set();
      days.add(e.slot.weekday);
      weeks.set(e.slot.weekNo, days);
      byAgent.set(e.agentId, weeks);
    }
    for (const weeks of byAgent.values()) {
      let previous = new Set<number>();
      for (const no of [...weeks.keys()].sort((a, b) => a - b)) {
        const current = weeks.get(no)!;
        assert.equal(current.size, target);
        assert.ok(![...current].some((d) => previous.has(d)), 'hari minggu lalu terulang');
        previous = current;
      }
    }
  }
  const fresh = [1, 2, 3].map(() => generateSchedule(agents, config({ seed: '' })).data.assignments);
  assert.ok(!fresh.slice(1).every((f) => JSON.stringify(f) === JSON.stringify(fresh[0])));
});

test('hari libur tanpa shift & tanpa agen', () => {
  const { data, validation } = generateSchedule(
    makeAgents(12),
    config({ weekdayCapacity: 2, saturdayCapacity: 2, maxWeekly: 1, holidays: { '2026-09-01': 'Maulid Nabi Muhammad SAW' } })
  );
  assert.ok(validation.ok, validation.messages.join('; '));
  assert.ok(!data.slots.some((s) => s.date === '2026-09-01'));
});

test('target dibatasi jumlah hari aktif', () => {
  // Minggu pertama September 2026 dibuat hanya 2 hari aktif.
  const holidays: Record<string, string> = {};
  for (const d of ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03']) holidays[d] = 'Libur';
  const { data, warnings } = generateSchedule(makeAgents(49), config({ maxWeekly: 3, holidays }));
  const firstWeek = entriesOf(data).filter((e) => e.slot.weekNo === 1);
  const counts = new Map<string, number>();
  for (const e of firstWeek) counts.set(e.agentId, (counts.get(e.agentId) ?? 0) + 1);
  assert.ok([...counts.values()].every((n) => n === 2));
  assert.ok(warnings.some((w) => w.includes('hanya 2 hari aktif')));
});

test('request khusus dihitung dalam target', () => {
  const { data } = generateSchedule(
    makeAgents(49),
    config({ weekdayCapacity: 1, saturdayCapacity: 1, maxWeekly: 3, urgentRequests: [{ agentId: 'a0', date: '2026-08-31', shiftIndex: 0 }] })
  );
  const forced = data.assignments['2026-08-31__0'].find((e) => e.agentId === 'a0');
  assert.ok(forced?.isUrgent);
  const perWeek = new Map<string, number>();
  for (const e of entriesOf(data)) {
    const k = `${e.slot.weekNo}|${e.agentId}`;
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  assert.ok([...perWeek.values()].every((n) => n === 3));
});

test('batas request: tayang Senin → Minggu 23:59 WIB', () => {
  const deadline = defaultRequestDeadline('2026-11-16'); // Senin
  assert.equal(deadline, '2026-11-22T23:59:00+07:00');
  assert.equal(defaultRequestDeadline('2026-11-22'), '2026-11-22T23:59:00+07:00'); // Minggu
  assert.equal(weekdayOf('2026-11-22'), 6);
  assert.ok(isRequestOpen(deadline, new Date('2026-11-22T16:58:00Z'))); // 23:58 WIB
  assert.ok(!isRequestOpen(deadline, new Date('2026-11-22T17:00:00Z'))); // 00:00 WIB Senin
});

test('request pindah & tambah jadwal diterapkan dengan aturan tanggal unik', () => {
  const { data } = generateSchedule(makeAgents(10), config({ maxWeekly: 1, seed: 'req' }));
  const agentId = 'a0';
  const from = data.slots.find((s) => data.assignments[s.key].some((e) => e.agentId === agentId))!;
  const target = data.slots.find(
    (s) => s.weekNo === from.weekNo && s.date !== from.date && !data.assignments[s.key].some((e) => e.agentId === agentId)
  )!;

  assert.match(validateChangeRequest(data, { agentId, fromSlot: from.key, toSlot: target.key, reason: '' }) ?? '', /alasan/);
  assert.equal(validateChangeRequest(data, { agentId, fromSlot: from.key, toSlot: target.key, reason: 'Ada akad klien' }), null);

  const moved = applyChangeRequest(data, { agentId, fromSlot: from.key, toSlot: target.key }).data!;
  assert.ok(!moved.assignments[from.key].some((e) => e.agentId === agentId));
  assert.ok(moved.assignments[target.key].some((e) => e.agentId === agentId));
  // Data asli tidak berubah.
  assert.ok(data.assignments[from.key].some((e) => e.agentId === agentId));

  // Tambah jadwal di tanggal yang sudah terisi agen yang sama → ditolak.
  const sameDate = moved.slots.find((s) => s.date === target.date && s.key !== target.key)!;
  assert.match(applyChangeRequest(moved, { agentId, fromSlot: null, toSlot: sameDate.key }).error ?? '', /sudah terjadwal/);
});

test('CSV & XLSX: baca template asli, tulis lalu baca ulang', async () => {
  const csvRows = parseCsv(readFileSync(new URL('./__fixtures__/sample_agents.csv', import.meta.url), 'utf8'));
  assert.equal(csvRows.length, 37);
  assert.equal(rowsToAgents(csvRows).agents[0].code, 'DUCC');

  const xlsxRows = await readXlsx(readFileSync(new URL('./__fixtures__/template_import_agents.xlsx', import.meta.url)));
  assert.ok(xlsxRows.length > 0);
  assert.deepEqual(Object.keys(xlsxRows[0]).slice(0, 5), ['No', 'Nama', 'Jabatan', 'Office', 'Total']);

  const semicolon = parseCsv('Nama;Total\n"VIRA (AUTU)";9\n');
  assert.equal(semicolon[0].Nama, 'VIRA (AUTU)');

  const { data } = generateSchedule(makeAgents(8), config({ maxWeekly: 1 }));
  const bytes = await buildXlsx(scheduleWorkbookSheets(data));
  const back = await readXlsx(bytes); // sheet pertama = Overview
  assert.ok(back.length > 5);
  assert.ok(bytes.length > 1000);
});
