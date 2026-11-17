import JSZip from 'jszip';

/**
 * Model laporan sederhana (judul + beberapa tabel) yang bisa diekspor ke
 * Excel (.xlsx bergaya, warna sel ikut) maupun PDF (lihat reportPdf.ts).
 */
export interface ReportCell {
  text: string | number;
  /** Warna isi "RRGGBB". */
  fill?: string;
  /** Warna huruf "RRGGBB". */
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Angka rupiah: format ribuan di Excel & PDF. */
  money?: boolean;
}

export interface ReportColumn {
  label: string;
  /** Lebar kolom Excel (karakter); PDF memakai perbandingannya. */
  width: number;
  align?: 'left' | 'center' | 'right';
  fill?: string;
}

export interface ReportTable {
  title?: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  footer?: ReportCell[];
}

export interface ReportDoc {
  title: string;
  subtitle?: string;
  tables: ReportTable[];
  notes?: string[];
}

export const c = (text: string | number, opts: Omit<ReportCell, 'text'> = {}): ReportCell => ({ text, ...opts });

/* ------------------------------ Excel ------------------------------ */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colLetter(index: number): string {
  let s = '';
  let n = index;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface StyleKey {
  fill?: string;
  color?: string;
  bold?: boolean;
  align?: string;
  money?: boolean;
  border?: boolean;
  size?: number;
}

class StyleBook {
  private fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  private fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private index = new Map<string, number>();

  private font(k: StyleKey): number {
    const xml = `<font>${k.bold ? '<b/>' : ''}<sz val="${k.size ?? 11}"/>${k.color ? `<color rgb="FF${k.color}"/>` : ''}<name val="Calibri"/></font>`;
    let i = this.fonts.indexOf(xml);
    if (i < 0) i = this.fonts.push(xml) - 1;
    return i;
  }

  private fill(rgb?: string): number {
    if (!rgb) return 0;
    const xml = `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
    let i = this.fills.indexOf(xml);
    if (i < 0) i = this.fills.push(xml) - 1;
    return i;
  }

  id(k: StyleKey): number {
    const key = JSON.stringify(k);
    const hit = this.index.get(key);
    if (hit !== undefined) return hit;
    const align = k.align ? `<alignment horizontal="${k.align}" vertical="center" wrapText="1"/>` : '<alignment vertical="center" wrapText="1"/>';
    const xml = `<xf numFmtId="${k.money ? 3 : 0}" fontId="${this.font(k)}" fillId="${this.fill(k.fill)}" borderId="${k.border ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${k.money ? ' applyNumberFormat="1"' : ''}>${align}</xf>`;
    const i = this.xfs.push(xml) - 1;
    this.index.set(key, i);
    return i;
  }

  xml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="2"><border/><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs></styleSheet>`;
  }
}

function sheetXml(doc: ReportDoc, styles: StyleBook): string {
  const width = Math.max(1, ...doc.tables.map((t) => t.columns.length));
  const rows: string[] = [];
  const merges: string[] = [];
  let r = 0;
  const pushRow = (cells: string[], height?: number) => {
    r += 1;
    rows.push(`<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells.join('')}</row>`);
  };
  const cellXml = (col: number, cell: ReportCell, extra: StyleKey = {}) => {
    const ref = `${colLetter(col)}${r + 1}`;
    const s = styles.id({ fill: cell.fill, color: cell.color, bold: cell.bold, align: cell.align, money: cell.money, border: true, ...extra });
    if (typeof cell.text === 'number') return `<c r="${ref}" s="${s}"><v>${cell.text}</v></c>`;
    if (cell.text === '') return `<c r="${ref}" s="${s}"/>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(cell.text)}</t></is></c>`;
  };
  const titleRow = (text: string, size: number, bold: boolean) => {
    const ref = `A${r + 1}`;
    merges.push(`A${r + 1}:${colLetter(width)}${r + 1}`);
    pushRow([`<c r="${ref}" s="${styles.id({ bold, size })}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`], size > 12 ? 22 : undefined);
  };

  titleRow(doc.title, 14, true);
  if (doc.subtitle) titleRow(doc.subtitle, 10, false);
  for (const t of doc.tables) {
    pushRow([]);
    if (t.title) titleRow(t.title, 12, true);
    if (t.subtitle) titleRow(t.subtitle, 10, false);
    pushRow(t.columns.map((col, i) => cellXml(i + 1, { text: col.label, bold: true, align: 'center', fill: col.fill ?? 'FFF7D6' })), 30);
    for (const row of t.rows) pushRow(row.map((cell, i) => cellXml(i + 1, { align: t.columns[i]?.align, ...cell })));
    if (t.footer) pushRow(t.footer.map((cell, i) => cellXml(i + 1, { align: t.columns[i]?.align, bold: true, ...cell })));
  }
  for (const n of doc.notes ?? []) {
    pushRow([]);
    titleRow(n, 10, false);
  }
  const widths = Array.from({ length: width }, (_, i) => Math.max(...doc.tables.map((t) => t.columns[i]?.width ?? 8)));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows.join('')}</sheetData>${mergeXml}<pageSetup orientation="landscape"/></worksheet>`;
}

/** Satu sheet per laporan. */
export async function buildReportXlsx(sheets: { name: string; doc: ReportDoc }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const styles = new StyleBook();
  const sheetXmls = sheets.map((s) => sheetXml(s.doc, styles));
  const names = sheets.map((s, i) => s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${i + 1}`);
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );
  sheetXmls.forEach((x, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, x));
  zip.file('xl/styles.xml', styles.xml());
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function moneyText(n: number): string {
  return n ? new Intl.NumberFormat('id-ID').format(n) : '';
}
