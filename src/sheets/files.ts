// Excel/CSV files on the phone: open, read, write an updated copy, and export the app's data.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { Asset, Category, ServiceLog, ServiceTask } from '../types';
import { Book, Grid, TEMPLATE_LOG_HEADERS, TEMPLATE_MACHINE_HEADERS, usDate, Writeback } from './core';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_UTI = 'org.openxmlformats.spreadsheetml.sheet';

/** Every sheet as text, with row 0 = Excel row 1 and column 0 = column A. */
export function bookFromWorkbook(wb: XLSX.WorkBook, fileName: string): Book {
  const sheets: Grid[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return { name, rows: [] };
    const range = XLSX.utils.decode_range(ws['!ref']);
    range.s.r = 0;
    range.s.c = 0;
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '', blankrows: true, range: XLSX.utils.encode_range(range) });
    const rows = raw.map((r) =>
      (r as unknown[]).map((v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? '' : String(v))),
    );
    return { name, rows };
  });
  return { fileName, sheets };
}

export type PickedFile = { book: Book; base64: string; ext: 'xlsx' | 'xls' | 'csv'; fileName: string; localCopy: string };

/** Let the person choose a spreadsheet (Files, OneDrive, Google Drive, email attachment...). */
export async function pickSpreadsheet(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, 'application/vnd.ms-excel', 'text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const file = res.assets[0];
  const fileName = file.name ?? 'spreadsheet.xlsx';
  const lower = fileName.toLowerCase();
  const ext: PickedFile['ext'] = lower.endsWith('.csv') ? 'csv' : lower.endsWith('.xls') ? 'xls' : 'xlsx';
  if (!/\.(xlsx|xlsm|xls|csv)$/.test(lower)) throw new Error('Choose an Excel (.xlsx) or CSV file.');
  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  const wb = readBase64(base64, ext);
  // Keep a copy so an updated version can be made later.
  const dir = `${FileSystem.documentDirectory ?? ''}excel/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const localCopy = `${dir}${Date.now()}-${fileName.replace(/[^\w.\- ]+/g, '_')}`;
  await FileSystem.writeAsStringAsync(localCopy, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { book: bookFromWorkbook(wb, fileName), base64, ext, fileName, localCopy };
}

function readBase64(base64: string, ext: string): XLSX.WorkBook {
  if (ext === 'csv') {
    // CSV is text; decode then let SheetJS split it.
    const text = XLSX.read(base64, { type: 'base64', raw: true });
    return text;
  }
  return XLSX.read(base64, { type: 'base64', cellDates: true });
}

export async function readLocalCopy(uri: string, ext: string, fileName: string): Promise<{ wb: XLSX.WorkBook; book: Book }> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const wb = readBase64(base64, ext);
  return { wb, book: bookFromWorkbook(wb, fileName) };
}

const typed = (v: string): string | number => (/^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim().length < 15 ? Number(v) : v);

/** Put the app's changes into the workbook (new rows under each table, updated hours). */
export function applyToWorkbook(wb: XLSX.WorkBook, book: Book, w: Writeback) {
  for (const e of w.edits) {
    const ws = wb.Sheets[e.sheet];
    if (ws) XLSX.utils.sheet_add_aoa(ws, [[typed(e.value)]], { origin: { r: e.row, c: e.col } });
  }
  const next = new Map<string, number>();
  for (const a of w.appends) {
    const ws = wb.Sheets[a.sheet];
    if (!ws) continue;
    const grid = book.sheets.find((g) => g.name === a.sheet);
    let r = next.get(a.sheet) ?? lastRow(grid) + 1;
    XLSX.utils.sheet_add_aoa(ws, [a.values.map(typed)], { origin: { r, c: 0 } });
    next.set(a.sheet, ++r);
  }
}

export function lastRow(g?: Grid): number {
  if (!g) return 0;
  for (let r = g.rows.length - 1; r >= 0; r--) if ((g.rows[r] ?? []).some((v) => String(v).trim())) return r;
  return 0;
}

async function shareBase64(base64: string, fileName: string, mime: string, uti?: string) {
  const path = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(path, { mimeType: mime, UTI: uti, dialogTitle: fileName });
  return path;
}

/** Save/share the updated copy of an imported file. */
export async function shareWorkbook(wb: XLSX.WorkBook, fileName: string, ext: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = fileName.replace(/\.(xlsx|xlsm|xls|csv)$/i, '');
  if (ext === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    const path = `${FileSystem.cacheDirectory ?? ''}${base} ${stamp}.csv`;
    await FileSystem.writeAsStringAsync(path, csv);
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: base });
    return;
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  await shareBase64(b64, `${base} ${stamp}.xlsx`, XLSX_MIME, XLSX_UTI);
}

/** The app's machines, service history, schedule and parts as a workbook in the Service Ceo layout. */
export function appWorkbook(assets: Asset[], logs: ServiceLog[], tasks: ServiceTask[], categories: Category[]): XLSX.WorkBook {
  const cat = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const byId = new Map(assets.map((a) => [a.id, a]));
  const wb = XLSX.utils.book_new();
  const machines = [
    TEMPLATE_MACHINE_HEADERS,
    ...assets.map((a) => [a.name, a.make ?? '', a.model ?? '', a.year ?? '', a.serial, a.barcode ?? '', cat(a.category), a.currentHours, a.notes ?? '']),
  ];
  const history = [
    TEMPLATE_LOG_HEADERS,
    ...logs
      .filter((l) => byId.has(l.assetId))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => {
        const a = byId.get(l.assetId)!;
        const parts = (l.parts ?? []).map((p) => [p.quantity && `${p.quantity} x`, p.name, p.partNumber].filter(Boolean).join(' ')).join(', ');
        return [usDate(l.date), a.name, a.serial, l.hoursAtService, l.taskName, l.performedBy, l.description ?? '', parts, l.notes ?? ''];
      }),
  ];
  const schedule = [
    ['Machine', 'Serial number', 'Item', 'Kind', 'Every (hours)', 'Every (days)', 'Last done (hours)', 'Last done (date)', 'Notes'],
    ...tasks
      .filter((t) => byId.has(t.assetId))
      .map((t) => {
        const a = byId.get(t.assetId)!;
        return [a.name, a.serial, t.name, t.kind === 'routine' ? 'Routine' : 'Scheduled', t.intervalHours ?? '', t.intervalDays ?? '', t.lastDoneHours, usDate(t.lastDoneDate), t.notes ?? ''];
      }),
  ];
  const parts = [
    ['Machine', 'Serial number', 'Part', 'Part number'],
    ...assets.flatMap((a) => a.specs.filters.map((f) => [a.name, a.serial, f.label, f.partNumber])),
  ];
  const specs = [
    ['Machine', 'Serial number', 'Spec', 'Value'],
    ...assets.flatMap((a) => {
      const fields = categories.find((c) => c.id === a.category)?.fields ?? [];
      return fields.filter((f) => a.specs.values[f.id]).map((f) => [a.name, a.serial, f.label, a.specs.values[f.id]]);
    }),
  ];
  const add = (rows: (string | number)[][], name: string, widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(machines, 'Machines', [18, 12, 12, 6, 16, 12, 22, 8, 30]);
  add(history, 'Service Log', [11, 18, 16, 8, 26, 14, 30, 30, 24]);
  add(schedule, 'Schedule', [18, 16, 26, 10, 12, 12, 14, 14, 30]);
  add(parts, 'Parts', [18, 16, 22, 18]);
  add(specs, 'Specs', [18, 16, 24, 28]);
  return wb;
}

export async function shareAppWorkbook(wb: XLSX.WorkBook, fleetName: string) {
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  const name = `${fleetName.replace(/[^\w\- ]+/g, '')} - Service Ceo ${new Date().toISOString().slice(0, 10)}.xlsx`;
  await shareBase64(b64, name, XLSX_MIME, XLSX_UTI);
}

/** Save a workbook to a local file (for uploading to OneDrive). */
export async function workbookToFile(wb: XLSX.WorkBook, fileName: string): Promise<string> {
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  const path = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

/** Overwrite the saved copy so the next updated copy builds on this one. */
export async function saveWorkbookTo(wb: XLSX.WorkBook, uri: string, ext: string) {
  if (ext === 'csv') {
    await FileSystem.writeAsStringAsync(uri, XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
    return;
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
}
