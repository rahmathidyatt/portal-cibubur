import { CLOSING_TYPES, type ClosingAgent, type ClosingRole, type ClosingType } from './closing';

/** Hasil baca teks closing yang ditempel (format pesan WhatsApp). */
export interface ParsedClosing {
  type: ClosingType;
  location: string;
  agents: ClosingAgent[];
}

const TYPE_ALIASES: [RegExp, ClosingType][] = [
  [/^jual\s*beli$/i, 'Jual Beli'],
  [/^sewa(\s*menyewa)?$/i, 'Sewa Menyewa'],
  [/^primary$/i, 'Primary']
];

const ROLE_ALIASES: Record<string, ClosingRole> = { L: 'L', S: 'S', 'L/S': 'L/S', LS: 'L/S', PL: 'PL' };

/**
 * "Lenny Brighton Paradise Cibubur, Bogor @Paradise Lenny (IQID)" →
 * { name: "Lenny", unit: "Brighton Paradise", area: "Cibubur, Bogor", code: "IQID" }.
 * Kode agen hanya diambil dari tag @… (KODE); tanpa tag, kode dikosongkan (agen kantor lain).
 */
export function parseAgentText(text: string): Omit<ClosingAgent, 'role'> {
  const at = text.indexOf('@');
  const main = (at >= 0 ? text.slice(0, at) : text).trim().replace(/\s+/g, ' ');
  const tag = at >= 0 ? text.slice(at) : '';
  const code = tag.match(/\(([A-Za-z0-9]{2,8})\)/)?.[1]?.toUpperCase() ?? '';
  const m = main.match(/^(.*?)\s+(Brighton\s+\S+)\s*(.*)$/i);
  if (!m) return { name: main, unit: '', area: '', code };
  return { name: m[1].trim(), unit: m[2].replace(/^brighton/i, 'Brighton'), area: m[3].trim(), code };
}

/** Baca satu atau beberapa closing dari teks yang ditempel. */
export function parseClosingText(text: string): ParsedClosing[] {
  const result: ParsedClosing[] = [];
  let current: ParsedClosing | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(/^(.+?)\s*[–—-]\s*(.+)$/);
    const type = header ? TYPE_ALIASES.find(([re]) => re.test(header[1].trim()))?.[1] : undefined;
    if (header && type && !/^[-•*]/.test(line)) {
      current = { type, location: header[2].trim(), agents: [] };
      result.push(current);
      continue;
    }
    const agent = line.match(/^[-•*]?\s*(PL|L\/S|LS|L|S|PA)\s*:\s*(.*)$/i);
    if (!agent || !current) continue;
    const role = ROLE_ALIASES[agent[1].toUpperCase()];
    const rest = agent[2].trim();
    if (!role || !rest) continue; // "PA:" kosong diabaikan
    current.agents.push({ role, ...parseAgentText(rest) });
  }
  // Ada Project Leader (PL) → closing Primary. Primary: agen pertama Selling, sisanya Project Leader.
  for (const c of result) {
    if (c.agents.some((a) => a.role === 'PL')) c.type = 'Primary';
    if (c.type === 'Primary') {
      const ordered = [...c.agents.filter((a) => a.role !== 'PL'), ...c.agents.filter((a) => a.role === 'PL')];
      c.agents = ordered.map((a, i) => ({ ...a, role: i === 0 ? 'S' : 'PL' }));
    }
  }
  return result.filter((c) => c.agents.length > 0 && CLOSING_TYPES.includes(c.type));
}
