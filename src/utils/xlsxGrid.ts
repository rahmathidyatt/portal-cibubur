import JSZip from 'jszip';

/**
 * Pembaca .xlsx "apa adanya": nilai sel + warna isi sel (fill) + penanda tanggal.
 * Dipakai untuk mengimpor rekap Excel yang memakai warna sebagai status
 * (mis. hijau = lulus/sesuai, merah = terdaftar menunggu nilai).
 */
export interface GridCell {
  value: string;
  /** Warna isi sel "RRGGBB" (huruf besar) bila ada warna solid; null bila tanpa warna. */
  fill: string | null;
  /** Sel bernilai tanggal (format angka tanggal Excel). value berisi YYYY-MM-DD. */
  isDate: boolean;
}

export interface GridSheet {
  name: string;
  cells: Map<string, GridCell>;
  maxRow: number;
  maxCol: number;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function textOfRuns(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
}

export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function colLetter(index: number): string {
  let s = '';
  let n = index;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function serialToIso(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Membaca semua sheet. */
export async function readXlsxGrid(data: ArrayBuffer | Uint8Array): Promise<GridSheet[]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => (await zip.file(path)?.async('string')) ?? '';

  const sharedXml = await read('xl/sharedStrings.xml');
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOfRuns(m[1]));

  // Gaya: fill & format angka per indeks gaya sel (cellXfs).
  const styles = await read('xl/styles.xml');
  const customDateFmt = new Set<number>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    const code = decodeXml(m[2]).replace(/"[^"]*"|\[[^\]]*\]/g, '');
    if (/[dy]/i.test(code) || /m{3,}/i.test(code)) customDateFmt.add(Number(m[1]));
  }
  const fillsXml = styles.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/)?.[1] ?? '';
  const fills = [...fillsXml.matchAll(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g)].map((m) => {
    const body = m[1] ?? '';
    if (!/patternType="solid"/.test(body)) return null;
    const rgb = body.match(/<fgColor\b[^>]*rgb="([0-9A-Fa-f]{6,8})"/)?.[1];
    return rgb ? rgb.slice(-6).toUpperCase() : null;
  });
  const xfsXml = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  const xfs = [...xfsXml.matchAll(/<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => {
    const fillId = Number(m[1].match(/fillId="(\d+)"/)?.[1] ?? 0);
    const numFmtId = Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    const fill = fills[fillId] ?? null;
    return {
      fill: fill === 'FFFFFF' ? null : fill,
      isDate: BUILTIN_DATE_FORMATS.has(numFmtId) || customDateFmt.has(numFmtId)
    };
  });

  const workbook = await read('xl/workbook.xml');
  const rels = await read('xl/_rels/workbook.xml.rels');
  const sheets: GridSheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*?name="([^"]*)"[^>]*?r:id="([^"]+)"[^>]*\/?>/g)) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((x) => x[0]).find((t) => t.includes(`Id="${m[2]}"`));
    const target = rel?.match(/Target="([^"]+)"/)?.[1];
    if (!target) continue;
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = await read(path);
    const cells = new Map<string, GridCell>();
    let maxRow = 0;
    let maxCol = 0;
    for (const cell of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+)(\d+)"/);
      if (!ref) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const style = xfs[Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? 0)] ?? { fill: null, isDate: false };
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      let isDate = false;
      if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOfRuns(body);
      else if (type === 'str') value = raw !== undefined ? decodeXml(raw) : '';
      else if (raw !== undefined) {
        if (style.isDate && /^-?\d+(\.\d+)?$/.test(raw)) {
          value = serialToIso(Number(raw));
          isDate = true;
        } else value = decodeXml(raw);
      }
      if (/<f>/.test(body) && type !== 'str' && raw === undefined) value = '';
      if (value === '' && !style.fill) continue;
      const row = Number(ref[2]);
      const col = colIndex(ref[1]);
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);
      cells.set(`${ref[1]}${ref[2]}`, { value: value.trim(), fill: style.fill, isDate });
    }
    sheets.push({ name: decodeXml(m[1]).trim(), cells, maxRow, maxCol });
  }
  return sheets;
}

/** Sel pada baris/kolom (kolom 1 = A). */
export function cellAt(sheet: GridSheet, row: number, col: number): GridCell | undefined {
  return sheet.cells.get(`${colLetter(col)}${row}`);
}

/** Kelompok warna yang dipakai di rekap. */
export function fillKind(fill: string | null): 'green' | 'red' | 'gray' | 'yellow' | 'other' | null {
  if (!fill) return null;
  const r = parseInt(fill.slice(0, 2), 16);
  const g = parseInt(fill.slice(2, 4), 16);
  const b = parseInt(fill.slice(4, 6), 16);
  if (g > 150 && r < 150 && b < 150) return 'green';
  if (r > 200 && g < 120 && b < 120) return 'red';
  if (r > 200 && g > 200 && b < 120) return 'yellow';
  if (Math.abs(r - g) < 16 && Math.abs(g - b) < 16 && r < 200) return 'gray';
  return 'other';
}
