import { c, type ReportDoc } from '../../utils/report';
import {
  PASS_SCORE,
  TRAINING_MODULES,
  agentStatus,
  formatBatchDate,
  moduleStatus,
  passedCount,
  type TrainingAgent
} from './training';

/** Warna mengikuti rekap Excel lama: hijau lulus, abu-abu belum lulus, merah menunggu nilai. */
const NAME_FILL = { lulus: '00FF00', belum: '434343', menunggu: 'FF0000' } as const;
const NAME_COLOR = { lulus: '000000', belum: 'FFFFFF', menunggu: 'FFFFFF' } as const;
const STAGE_FILL: Record<number, string> = { 1: 'FF9900', 2: 'B6D7A8', 3: 'FFFF00', 4: '6FA8DC' };
const STATUS_LABEL = { lulus: 'Lulus', belum: 'Belum lulus', menunggu: 'Menunggu nilai' } as const;

export function trainingReport(agents: TrainingAgent[], printedAt: string): ReportDoc {
  const sorted = [...agents];
  return {
    title: 'REKAP TRAINING BRIGHTON',
    subtitle: `Dicetak ${printedAt} · ${agents.length} agen · lulus minimal ${PASS_SCORE}`,
    tables: [
      {
        columns: [
          { label: 'NO', width: 5, align: 'center' },
          { label: 'PROPERTY ADVISOR', width: 26 },
          ...TRAINING_MODULES.map((m) => ({ label: m.title, width: 13, align: 'center' as const, fill: STAGE_FILL[m.stage] })),
          { label: 'LULUS', width: 8, align: 'center' },
          { label: 'STATUS', width: 15, align: 'center' }
        ],
        rows: sorted.map((a, i) => {
          const st = agentStatus(a);
          return [
            c(i + 1, { align: 'center' }),
            c(a.name, { fill: NAME_FILL[st], color: NAME_COLOR[st], bold: true }),
            ...TRAINING_MODULES.map((m) => {
              const ms = moduleStatus(a, m.id);
              const score = a.scores[m.id];
              if (ms === 'menunggu') {
                const d = a.pending[m.id];
                return c(score !== undefined ? `${score} → daftar` : d ? `Daftar ${d.slice(8)}/${d.slice(5, 7)}` : 'Daftar', {
                  fill: 'FF0000',
                  color: 'FFFFFF',
                  align: 'center'
                });
              }
              if (score === undefined) return c('', {});
              return c(score, { align: 'center', ...(ms === 'tidak-lulus' ? { fill: 'D9D9D9', color: 'C00000' } : {}) });
            }),
            c(`${passedCount(a)}/${TRAINING_MODULES.length}`, { align: 'center' }),
            c(STATUS_LABEL[st], { align: 'center' })
          ];
        })
      }
    ],
    notes: [
      'Keterangan: nama hijau = lulus, merah = didaftarkan & menunggu nilai, abu-abu = belum lulus. Sel merah = sesi yang sedang didaftarkan.',
      ...[...new Set(agents.flatMap((a) => Object.values(a.pending)).filter(Boolean))]
        .sort()
        .map((d) => `Batch ${formatBatchDate(d)}`)
    ]
  };
}
