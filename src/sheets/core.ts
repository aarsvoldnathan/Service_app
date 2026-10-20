// Spreadsheet engine: understand a workbook's columns, turn rows into machines and service
// history, and work out which cells to write back when things change in the app.
// No file or network code here, so the same logic serves files and live OneDrive workbooks.
import type { Asset, Category, ServiceLog } from '../types';

/** A workbook as plain text cells. rows[r][c] uses absolute positions (row 0 = Excel row 1). */
export type Grid = { name: string; rows: string[][]; id?: string; tables?: { id: string; headerRow: number; firstCol: number; lastCol: number }[] };
export type Book = { fileName: string; sheets: Grid[] };

export const MACHINE_FIELDS = ['name', 'make', 'model', 'year', 'serial', 'barcode', 'category', 'hours', 'notes'] as const;
export const LOG_FIELDS = ['date', 'machine', 'serial', 'make', 'model', 'hours', 'service', 'performedBy', 'description', 'parts', 'notes'] as const;
export type MachineField = (typeof MACHINE_FIELDS)[number];
export type LogField = (typeof LOG_FIELDS)[number];

export const FIELD_LABEL: Record<string, string> = {
  name: 'Machine name / unit #',
  machine: 'Machine name / unit #',
  make: 'Make',
  model: 'Model',
  year: 'Year',
  serial: 'Serial number',
  barcode: 'Barcode / asset tag',
  category: 'Type / category',
  hours: 'Hours',
  notes: 'Notes',
  date: 'Service date',
  service: 'Service done',
  performedBy: 'Done by',
  description: 'Description',
  parts: 'Parts used',
};

/** Where one kind of table sits: sheet, header row and column index for each field. */
export type TableMap<F extends string> = { sheet: string; headerRow: number; columns: Partial<Record<F, number>> };

export type SheetMapping = {
  machines?: TableMap<MachineField> & { specs?: Record<string, number> };
  logs?: TableMap<LogField>;
  /** Text in the type column -> category id. */
  categoryMap?: Record<string, string>;
  /** Who worked it out. */
  by?: 'auto' | 'ai' | 'template';
  notes?: string;
};

// ---------- small helpers ----------

export const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();
const cell = (g: Grid, r: number, c: number | undefined) => (c === undefined || c < 0 ? '' : String(g.rows[r]?.[c] ?? '').trim());
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Hours like "1,234.5 hrs" -> 1234.5. */
export function parseHours(v: string): number | undefined {
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Dates as ISO, US m/d/y, y-m-d, "14-Mar-25", "Mar 14 2025" or an Excel day number. Returns ISO or undefined. */
export function parseDate(v: string): string | undefined {
  const s = String(v).trim();
  if (!s) return undefined;
  const mk = (y: number, m: number, d: number) => {
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return undefined;
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return mk(+m[3], +m[1], +m[2]);
  m = s.match(/^(\d{1,2})[\s-]([a-z]{3})[a-z]*[\s-,]*(\d{2,4})/i);
  if (m && MONTHS.includes(m[2].toLowerCase())) return mk(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})/i);
  if (m && MONTHS.includes(m[1].toLowerCase())) return mk(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) return new Date(Math.round((n - 25569) * 86400000) + 12 * 3600000).toISOString();
  }
  return undefined;
}

export const dayKey = (iso: string) => iso.slice(0, 10);
export const usDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
};

// ---------- automatic column matching ----------

const SYN: Record<string, string[]> = {
  name: ['machine', 'machine name', 'unit', 'unit #', 'unit number', 'unit no', 'asset', 'asset name', 'equipment', 'equipment name', 'name', 'description of unit', 'id', 'stock #', 'fleet #'],
  make: ['make', 'manufacturer', 'brand', 'mfr', 'mfg'],
  model: ['model', 'model #', 'model number', 'model no'],
  year: ['year', 'model year', 'yr'],
  serial: ['serial', 'serial #', 'serial number', 'serial no', 's n', 'sn', 'vin', 'pin', 'vin pin'],
  barcode: ['barcode', 'bar code', 'qr', 'qr code', 'asset tag', 'tag', 'tag #'],
  category: ['type', 'category', 'equipment type', 'machine type', 'class', 'kind'],
  hours: ['hours', 'hrs', 'hour meter', 'hourmeter', 'meter', 'engine hours', 'current hours', 'hours at service', 'machine hours', 'smu'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
  date: ['date', 'service date', 'date of service', 'date serviced', 'completed', 'date completed', 'done on', 'work date'],
  service: ['service', 'service done', 'service performed', 'work performed', 'work done', 'maintenance', 'maintenance performed', 'task', 'job', 'repair', 'service type', 'work'],
  performedBy: ['tech', 'technician', 'mechanic', 'performed by', 'done by', 'serviced by', 'by', 'employee', 'initials'],
  description: ['description', 'details', 'work description', 'what was done'],
  parts: ['parts', 'parts used', 'part #', 'part number', 'part numbers', 'filters', 'parts filters'],
};

function scoreHeader(h: string, field: string): number {
  const n = norm(h);
  if (!n) return 0;
  const list = SYN[field] ?? [];
  if (list.includes(n)) return 3;
  if (list.some((x) => x.length > 2 && (n.startsWith(x + ' ') || n.endsWith(' ' + x)))) return 2;
  if (list.some((x) => x.length > 3 && n.includes(x))) return 1;
  return 0;
}

function bestColumns<F extends string>(headers: string[], fields: readonly F[]): Partial<Record<F, number>> {
  const out: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  // Strongest matches first so "Hours at service" doesn't steal "Service".
  const cands: { f: F; c: number; s: number }[] = [];
  fields.forEach((f) => headers.forEach((h, c) => {
    const s = scoreHeader(h, f === ('machine' as F) ? 'name' : f);
    if (s) cands.push({ f, c, s });
  }));
  cands.sort((a, b) => b.s - a.s);
  for (const { f, c } of cands) {
    if (out[f] !== undefined || used.has(c)) continue;
    out[f] = c;
    used.add(c);
  }
  return out;
}

function findHeaderRow(g: Grid): number {
  let best = -1;
  let bestScore = 0;
  for (let r = 0; r < Math.min(g.rows.length, 15); r++) {
    const row = g.rows[r] ?? [];
    let score = 0;
    row.forEach((h) => {
      const all = Object.keys(SYN).reduce((m, f) => Math.max(m, scoreHeader(h, f)), 0);
      score += all;
    });
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 3 ? best : -1;
}

/** Best guess at which sheets hold machines and service history. */
export function autoMap(book: Book, categories: Category[]): SheetMapping {
  let machines: SheetMapping['machines'];
  let logs: SheetMapping['logs'];
  let mScore = 0;
  let lScore = 0;
  for (const g of book.sheets) {
    const hr = findHeaderRow(g);
    if (hr < 0) continue;
    const headers = (g.rows[hr] ?? []).map(String);
    const dataRows = g.rows.length - hr - 1;
    const lc = bestColumns(headers, LOG_FIELDS);
    const isLog = lc.date !== undefined && (lc.service !== undefined || lc.description !== undefined);
    if (isLog) {
      const s = Object.keys(lc).length * 10 + Math.min(dataRows, 50);
      if (s > lScore) {
        lScore = s;
        logs = { sheet: g.name, headerRow: hr, columns: lc };
      }
    } else {
      const mc = bestColumns(headers, MACHINE_FIELDS);
      if (mc.name === undefined && mc.serial === undefined && mc.model === undefined) continue;
      const specs = specColumns(headers, mc, categories);
      const s = Object.keys(mc).length * 10 + Math.min(dataRows, 50);
      if (s > mScore) {
        mScore = s;
        machines = { sheet: g.name, headerRow: hr, columns: mc, specs };
      }
    }
  }
  return { machines, logs, by: 'auto' };
}

/** Columns whose header matches a spec line (e.g. "Oil filter", "Lug nut torque"). */
function specColumns(headers: string[], taken: Partial<Record<string, number>>, categories: Category[]) {
  const usedCols = new Set(Object.values(taken).filter((x): x is number => x !== undefined));
  const fields = new Map<string, string>();
  categories.forEach((c) => c.fields.forEach((f) => fields.set(norm(f.label), f.id)));
  const out: Record<string, number> = {};
  headers.forEach((h, c) => {
    if (usedCols.has(c)) return;
    const id = fields.get(norm(h));
    if (id && out[id] === undefined) out[id] = c;
  });
  return out;
}

/** Category id for free text such as "Skid Steer" or "Mini Ex". */
export function guessCategory(text: string, categories: Category[], map?: Record<string, string>): string | undefined {
  const t = norm(text);
  if (!t) return undefined;
  if (map?.[text] && categories.some((c) => c.id === map[text])) return map[text];
  const direct = categories.find((c) => norm(c.name) === t || c.id === t.replace(/ /g, '_'));
  if (direct) return direct.id;
  const words: [RegExp, string][] = [
    [/skid|track loader|ctl|mtl|svl|compact track|loader/, 'skid_steer'],
    [/excavat|mini ex|digger|backhoe/, 'excavator'],
    [/chipper/, 'wood_chipper'],
    [/lift|boom|scissor|telehandler|mt ?\d/, 'lift'],
    [/attach|bucket|auger|breaker|grapple|forks/, 'attachment'],
    [/trailer/, 'trailer'],
    [/mow/, 'mower'],
  ];
  for (const [re, id] of words) if (re.test(t) && categories.some((c) => c.id === id)) return id;
  const loose = categories.find((c) => norm(c.name).split(' ').some((w) => w.length > 3 && t.includes(w)));
  return loose?.id;
}

// ---------- import plan ----------

export type MachineRow = {
  row: number;
  /** Key used to link service rows to a machine created by this import. */
  key: string;
  existingId?: string;
  name: string;
  make?: string;
  model?: string;
  year?: string;
  serial: string;
  barcode?: string;
  category?: string;
  hours?: number;
  notes?: string;
  specs: Record<string, string>;
  /** What will change on an existing machine. */
  changes: string[];
};
export type LogRow = {
  row: number;
  /** Existing machine id, or the key of a machine created by this import. */
  assetId?: string;
  machineKey: string;
  date: string;
  hours: number;
  taskName: string;
  performedBy: string;
  description?: string;
  partsText?: string;
  notes?: string;
  duplicate: boolean;
};
export type ImportPlan = {
  newMachines: MachineRow[];
  updatedMachines: MachineRow[];
  logs: LogRow[];
  skipped: string[];
};

const keyOfMachine = (serial: string, name: string) => (serial ? `s:${norm(serial)}` : `n:${norm(name)}`);

export function findAsset(assets: Asset[], serial?: string, name?: string, barcode?: string): Asset | undefined {
  const s = norm(serial);
  const n = norm(name);
  const b = norm(barcode);
  return (
    (s && assets.find((a) => norm(a.serial) === s)) ||
    (b && assets.find((a) => norm(a.barcode) === b)) ||
    (n && assets.find((a) => norm(a.name) === n)) ||
    undefined
  );
}

export const sameService = (log: { assetId: string; date: string; taskName: string }, other: { assetId?: string; date: string; taskName: string }) =>
  log.assetId === other.assetId && dayKey(log.date) === dayKey(other.date) && norm(log.taskName) === norm(other.taskName);

export function buildImportPlan(book: Book, map: SheetMapping, assets: Asset[], logs: ServiceLog[], categories: Category[]): ImportPlan {
  const plan: ImportPlan = { newMachines: [], updatedMachines: [], logs: [], skipped: [] };
  const created = new Map<string, MachineRow>();

  const addMachine = (m: Omit<MachineRow, 'changes' | 'existingId' | 'key'>) => {
    const existing = findAsset(assets, m.serial, m.name, m.barcode);
    if (existing) {
      const ch: string[] = [];
      const row: MachineRow = { ...m, key: existing.id, existingId: existing.id, changes: ch };
      if (m.hours !== undefined && m.hours > existing.currentHours) ch.push(`hours ${existing.currentHours} → ${m.hours}`);
      if (m.make && !existing.make) ch.push(`make: ${m.make}`);
      if (m.model && !existing.model) ch.push(`model: ${m.model}`);
      if (m.year && !existing.year) ch.push(`year: ${m.year}`);
      if (m.serial && !existing.serial) ch.push(`serial: ${m.serial}`);
      if (m.barcode && !existing.barcode) ch.push(`barcode: ${m.barcode}`);
      Object.entries(m.specs).forEach(([k, v]) => v && !existing.specs.values[k] && ch.push(`${k}: ${v}`));
      if (ch.length && !plan.updatedMachines.some((x) => x.existingId === existing.id)) plan.updatedMachines.push(row);
      return existing.id;
    }
    const key = keyOfMachine(m.serial, m.name);
    const prior = created.get(key) ?? (m.name ? created.get(keyOfMachine('', m.name)) : undefined);
    if (prior) {
      if (m.hours !== undefined && (prior.hours ?? 0) < m.hours) prior.hours = m.hours;
      prior.make ||= m.make;
      prior.model ||= m.model;
      prior.serial ||= m.serial;
      if (m.serial && !created.has(keyOfMachine(m.serial, ''))) created.set(keyOfMachine(m.serial, ''), prior);
      return prior.key;
    }
    const row: MachineRow = { ...m, key, changes: [] };
    created.set(key, row);
    if (m.name) created.set(keyOfMachine('', m.name), row);
    plan.newMachines.push(row);
    return key;
  };

  // Machines table
  const mt = map.machines;
  const mg = mt && book.sheets.find((g) => g.name === mt.sheet);
  if (mt && mg) {
    const c = mt.columns;
    for (let r = mt.headerRow + 1; r < mg.rows.length; r++) {
      const name = cell(mg, r, c.name);
      const serial = cell(mg, r, c.serial);
      const model = cell(mg, r, c.model);
      if (!name && !serial && !model) continue;
      const make = cell(mg, r, c.make) || undefined;
      const specs: Record<string, string> = {};
      Object.entries(mt.specs ?? {}).forEach(([id, col]) => {
        const v = cell(mg, r, col);
        if (v) specs[id] = v;
      });
      addMachine({
        row: r,
        name: name || [make, model].filter(Boolean).join(' ') || serial,
        make,
        model: model || undefined,
        year: cell(mg, r, c.year) || undefined,
        serial,
        barcode: cell(mg, r, c.barcode) || undefined,
        category: guessCategory(cell(mg, r, c.category), categories, map.categoryMap),
        hours: parseHours(cell(mg, r, c.hours)),
        notes: cell(mg, r, c.notes) || undefined,
        specs,
      });
    }
  }

  // Service history table
  const lt = map.logs;
  const lg = lt && book.sheets.find((g) => g.name === lt.sheet);
  if (lt && lg) {
    const c = lt.columns;
    for (let r = lt.headerRow + 1; r < lg.rows.length; r++) {
      const name = cell(lg, r, c.machine);
      const serial = cell(lg, r, c.serial);
      const service = cell(lg, r, c.service) || cell(lg, r, c.description);
      const rawDate = cell(lg, r, c.date);
      if (!name && !serial && !service && !rawDate) continue;
      const date = parseDate(rawDate);
      if (!date) {
        plan.skipped.push(`Row ${r + 1}: no readable date ("${rawDate}")`);
        continue;
      }
      if (!service) {
        plan.skipped.push(`Row ${r + 1}: no service described`);
        continue;
      }
      if (!name && !serial) {
        // One machine per sheet: use the only machine if there is exactly one.
        if (assets.length + plan.newMachines.length !== 1) {
          plan.skipped.push(`Row ${r + 1}: which machine? (no machine or serial column)`);
          continue;
        }
      }
      const hours = parseHours(cell(lg, r, c.hours));
      const make = cell(lg, r, c.make) || undefined;
      const model = cell(lg, r, c.model) || undefined;
      const machineKey =
        name || serial
          ? addMachine({ row: -1, name: name || [make, model].filter(Boolean).join(' ') || serial, make, model, serial, hours, specs: {} })
          : (assets[0]?.id ?? plan.newMachines[0].key);
      const assetId = assets.some((a) => a.id === machineKey) ? machineKey : undefined;
      const entry: LogRow = {
        row: r,
        assetId,
        machineKey,
        date,
        hours: hours ?? 0,
        taskName: service.slice(0, 120),
        performedBy: cell(lg, r, c.performedBy) || 'From spreadsheet',
        description: c.service !== undefined && c.description !== undefined ? cell(lg, r, c.description) || undefined : undefined,
        partsText: cell(lg, r, c.parts) || undefined,
        notes: cell(lg, r, c.notes) || undefined,
        duplicate: false,
      };
      entry.duplicate =
        (!!assetId && logs.some((l) => sameService(l, { ...entry, assetId }))) ||
        plan.logs.some((x) => x.machineKey === machineKey && dayKey(x.date) === dayKey(date) && norm(x.taskName) === norm(entry.taskName));
      plan.logs.push(entry);
    }
  }
  return plan;
}

/** "Oil filter 7023589 x1, Air filter 7286328" -> parts. */
export function parseParts(text?: string) {
  if (!text) return undefined;
  const parts = text
    .split(/[;,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const qty = p.match(/\b(?:x\s?(\d+)|(\d+)\s?x)\b/i);
      const pn = p.match(/\b([A-Z0-9]*\d[A-Z0-9-]{3,})\b/i);
      const name = p.replace(qty?.[0] ?? '', '').replace(pn?.[0] ?? '', '').replace(/[#:()-]+$/g, '').trim();
      return { name: name || p, partNumber: pn?.[1], quantity: qty ? qty[1] ?? qty[2] : undefined };
    });
  return parts.length ? parts : undefined;
}

// ---------- write back ----------

export type CellEdit = { sheet: string; row: number; col: number; value: string };
export type RowAppend = { sheet: string; headerRow: number; values: string[] };
export type Writeback = { edits: CellEdit[]; appends: RowAppend[]; logIds: string[]; summary: string[] };

const partsText = (l: ServiceLog) =>
  (l.parts ?? []).map((p) => [p.quantity && `${p.quantity} x`, p.name, p.partNumber].filter(Boolean).join(' ')).join(', ');

/**
 * What to write so the sheet matches the app: higher hours on machine rows, missing machines,
 * and service entries the sheet doesn't have yet. Never deletes or overwrites other cells.
 */
export function computeWriteback(
  book: Book,
  map: SheetMapping,
  assets: Asset[],
  logs: ServiceLog[],
  categories: Category[],
  knownLogIds: Set<string>,
): Writeback {
  const out: Writeback = { edits: [], appends: [], logIds: [], summary: [] };
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const mt = map.machines;
  const mg = mt && book.sheets.find((g) => g.name === mt.sheet);
  if (mt && mg) {
    const c = mt.columns;
    const width = Math.max(mg.rows[mt.headerRow]?.length ?? 0, ...Object.values(c).map((x) => (x ?? 0) + 1));
    const seen = new Set<string>();
    for (let r = mt.headerRow + 1; r < mg.rows.length; r++) {
      const a = findAsset(assets, cell(mg, r, c.serial), cell(mg, r, c.name), cell(mg, r, c.barcode));
      if (!a) continue;
      seen.add(a.id);
      if (c.hours !== undefined) {
        const sheetHours = parseHours(cell(mg, r, c.hours));
        if (sheetHours === undefined || a.currentHours > sheetHours) {
          out.edits.push({ sheet: mg.name, row: r, col: c.hours, value: String(a.currentHours) });
          out.summary.push(`${a.name}: hours → ${a.currentHours}`);
        }
      }
    }
    assets
      .filter((a) => !seen.has(a.id))
      .forEach((a) => {
        const v: string[] = Array(width).fill('');
        const put = (col: number | undefined, val?: string) => col !== undefined && (v[col] = val ?? '');
        put(c.name, a.name);
        put(c.make, a.make);
        put(c.model, a.model);
        put(c.year, a.year);
        put(c.serial, a.serial);
        put(c.barcode, a.barcode);
        put(c.category, catName(a.category));
        put(c.hours, String(a.currentHours));
        put(c.notes, a.notes);
        Object.entries(mt.specs ?? {}).forEach(([id, col]) => put(col, a.specs.values[id]));
        out.appends.push({ sheet: mg.name, headerRow: mt.headerRow, values: v });
        out.summary.push(`Added machine ${a.name}`);
      });
  }

  const lt = map.logs;
  const lg = lt && book.sheets.find((g) => g.name === lt.sheet);
  if (lt && lg) {
    const c = lt.columns;
    const width = Math.max(lg.rows[lt.headerRow]?.length ?? 0, ...Object.values(c).map((x) => (x ?? 0) + 1));
    // Rows already in the sheet, as machine + day + service.
    const existing: { assetId?: string; date: string; taskName: string }[] = [];
    for (let r = lt.headerRow + 1; r < lg.rows.length; r++) {
      const date = parseDate(cell(lg, r, c.date));
      const task = cell(lg, r, c.service) || cell(lg, r, c.description);
      if (!date || !task) continue;
      const a = findAsset(assets, cell(lg, r, c.serial), cell(lg, r, c.machine)) ?? (assets.length === 1 ? assets[0] : undefined);
      existing.push({ assetId: a?.id, date, taskName: task });
    }
    const ids = new Set(assets.map((a) => a.id));
    logs
      .filter((l) => ids.has(l.assetId) && !knownLogIds.has(l.id))
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((l) => {
        out.logIds.push(l.id);
        if (existing.some((e) => sameService(l, e))) return;
        const a = assets.find((x) => x.id === l.assetId)!;
        const v: string[] = Array(width).fill('');
        const put = (col: number | undefined, val?: string) => col !== undefined && (v[col] = val ?? '');
        put(c.date, usDate(l.date));
        put(c.machine, a.name);
        put(c.serial, a.serial);
        put(c.make, a.make);
        put(c.model, a.model);
        put(c.hours, String(l.hoursAtService));
        if (c.service !== undefined) {
          put(c.service, l.taskName);
          put(c.description, l.description);
        } else put(c.description, [l.taskName, l.description].filter(Boolean).join(' – '));
        put(c.performedBy, l.performedBy);
        put(c.parts, partsText(l));
        put(c.notes, l.notes);
        out.appends.push({ sheet: lg.name, headerRow: lt.headerRow, values: v });
        out.summary.push(`${a.name}: ${l.taskName} (${usDate(l.date)})`);
      });
  }
  return out;
}

// ---------- Service Ceo layout (export and new workbooks) ----------

export const TEMPLATE_MACHINE_HEADERS = ['Machine', 'Make', 'Model', 'Year', 'Serial number', 'Barcode', 'Type', 'Hours', 'Notes'];
export const TEMPLATE_LOG_HEADERS = ['Date', 'Machine', 'Serial number', 'Hours', 'Service', 'Done by', 'Description', 'Parts used', 'Notes'];

export function templateMapping(): SheetMapping {
  return {
    by: 'template',
    machines: { sheet: 'Machines', headerRow: 0, columns: { name: 0, make: 1, model: 2, year: 3, serial: 4, barcode: 5, category: 6, hours: 7, notes: 8 }, specs: {} },
    logs: { sheet: 'Service Log', headerRow: 0, columns: { date: 0, machine: 1, serial: 2, hours: 3, service: 4, performedBy: 5, description: 6, parts: 7, notes: 8 } },
  };
}

/** Header names for the review screen. */
export function headersOf(book: Book, sheet: string, headerRow: number): string[] {
  const g = book.sheets.find((x) => x.name === sheet);
  return (g?.rows[headerRow] ?? []).map((h, i) => String(h || `Column ${colLetter(i)}`));
}

export function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "Sheet1!B3:K40" or "B3" -> zero-based start row and column. */
export function parseAddressStart(address: string): { row: number; col: number } {
  const part = address.includes('!') ? address.split('!').pop()! : address;
  const m = part.replace(/\$/g, '').match(/^([A-Z]+)(\d+)/i);
  if (!m) return { row: 0, col: 0 };
  const col = m[1].toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return { row: Number(m[2]) - 1, col };
}

/** Check an AI-made mapping against the real workbook; drop anything that doesn't fit. */
export function cleanMapping(raw: unknown, book: Book, categories: Category[]): SheetMapping | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const table = <F extends string>(t: unknown, fields: readonly F[]): TableMap<F> | undefined => {
    if (!t || typeof t !== 'object') return undefined;
    const o = t as { sheet?: string; header_row?: number; columns?: Record<string, number> };
    const g = book.sheets.find((x) => x.name === o.sheet);
    if (!g || typeof o.header_row !== 'number' || o.header_row < 0 || o.header_row >= g.rows.length) return undefined;
    const width = Math.max(...g.rows.slice(0, o.header_row + 20).map((x) => x.length), 0);
    const columns: Partial<Record<F, number>> = {};
    fields.forEach((f) => {
      const v = o.columns?.[f];
      if (typeof v === 'number' && v >= 0 && v < width) columns[f] = v;
    });
    return Object.keys(columns).length ? { sheet: g.name, headerRow: o.header_row, columns } : undefined;
  };
  const machines = table(r.machines, MACHINE_FIELDS);
  const logs = table(r.logs, LOG_FIELDS);
  if (!machines && !logs) return undefined;
  const specIds = new Set(categories.flatMap((c) => c.fields.map((f) => f.id)));
  const specs: Record<string, number> = {};
  Object.entries(((r.machines as { spec_columns?: Record<string, number> })?.spec_columns) ?? {}).forEach(([id, col]) => {
    if (specIds.has(id) && typeof col === 'number') specs[id] = col;
  });
  const catIds = new Set(categories.map((c) => c.id));
  const categoryMap: Record<string, string> = {};
  Object.entries((r.category_map as Record<string, string>) ?? {}).forEach(([k, v]) => catIds.has(v) && (categoryMap[k] = v));
  return {
    machines: machines ? { ...machines, specs } : undefined,
    logs,
    categoryMap,
    by: 'ai',
    notes: typeof r.notes === 'string' ? r.notes : undefined,
  };
}
