import { Asset, Fleet, ServiceLog, ServiceTask } from './types';

const DAY = 86_400_000;

/** A major item is "due soon" within this many days. */
export const DUE_SOON_DAYS = 14;

export type Status = 'overdue' | 'dueSoon' | 'ok';
export type Level = 'green' | 'yellow' | 'orange' | 'red';

export const LEVEL_RANK: Record<Level, number> = { red: 0, orange: 1, yellow: 2, green: 3 };
export const LEVEL_LABEL: Record<Level, string> = {
  red: 'Service overdue',
  orange: 'Routine care well overdue',
  yellow: 'Routine care due',
  green: 'Good',
};

export type Thresholds = Pick<Fleet, 'orangeOverdueHours' | 'majorWarnHours'>;
export const DEFAULT_THRESHOLDS: Thresholds = { orangeOverdueHours: 10, majorWarnHours: 10 };

export type DueInfo = {
  task: ServiceTask;
  asset: Asset;
  status: Status;
  /** Color for this single item. */
  level: Level;
  detail: string;
  /** Sorting key: lower = more urgent. */
  urgency: number;
  /** Hours left (negative = overdue), if the item repeats by hours. */
  hoursLeft?: number;
  /** Days left (negative = overdue), if the item repeats by days. */
  daysLeft?: number;
};

function describe(value: number, unit: string): string {
  const abs = Math.abs(Math.round(value));
  if (value === 0) return `Due now (${unit === 'h' ? 'hours' : 'days'})`;
  return value < 0 ? `Overdue by ${abs} ${unit}` : `Due in ${abs} ${unit}`;
}

export function computeDue(
  task: ServiceTask,
  asset: Asset,
  now: Date,
  th: Thresholds = DEFAULT_THRESHOLDS,
): DueInfo {
  const parts: { remaining: number; ratio: number; text: string }[] = [];
  let hoursLeft: number | undefined;
  let daysLeft: number | undefined;

  if (task.intervalHours) {
    hoursLeft = task.lastDoneHours + task.intervalHours - asset.currentHours;
    parts.push({ remaining: hoursLeft, ratio: hoursLeft / task.intervalHours, text: describe(hoursLeft, 'h') });
  }
  if (task.intervalDays) {
    const dueMs = new Date(task.lastDoneDate).getTime() + task.intervalDays * DAY;
    daysLeft = Math.ceil((dueMs - now.getTime()) / DAY);
    parts.push({ remaining: daysLeft, ratio: daysLeft / task.intervalDays, text: describe(daysLeft, 'd') });
  }

  if (parts.length === 0) {
    return { task, asset, status: 'ok', level: 'green', detail: 'No schedule set', urgency: Infinity };
  }

  const hoursOverdue = hoursLeft !== undefined && hoursLeft <= 0;
  const daysOverdue = daysLeft !== undefined && daysLeft < 0;
  let status: Status;
  let level: Level;

  if (task.kind === 'routine') {
    // Routine care: due = yellow, well past due = orange.
    const late = hoursOverdue || daysOverdue;
    const veryLate = hoursLeft !== undefined && hoursLeft <= -th.orangeOverdueHours;
    status = late ? 'overdue' : 'ok';
    level = veryLate ? 'orange' : late ? 'yellow' : 'green';
  } else {
    // Major service: past due = red, coming up soon = yellow.
    const late = (hoursLeft !== undefined && hoursLeft < 0) || daysOverdue;
    const soon =
      (hoursLeft !== undefined && hoursLeft <= th.majorWarnHours) ||
      (daysLeft !== undefined && daysLeft <= DUE_SOON_DAYS);
    status = late ? 'overdue' : soon ? 'dueSoon' : 'ok';
    level = late ? 'red' : soon ? 'yellow' : 'green';
  }

  const sorted = [...parts].sort((a, b) => a.ratio - b.ratio);
  return {
    task,
    asset,
    status,
    level,
    detail: sorted.map((p) => p.text).join('  ·  '),
    urgency: LEVEL_RANK[level] * 1000 + sorted[0].ratio,
    hoursLeft,
    daysLeft,
  };
}

export type MachineStatus = {
  asset: Asset;
  level: Level;
  /** Items that are not green, most urgent first. */
  needs: DueInfo[];
  all: DueInfo[];
};

export function machineStatus(
  asset: Asset,
  tasks: ServiceTask[],
  now: Date,
  th: Thresholds = DEFAULT_THRESHOLDS,
): MachineStatus {
  const all = tasks
    .filter((t) => t.assetId === asset.id)
    .map((t) => computeDue(t, asset, now, th))
    .sort((a, b) => a.urgency - b.urgency);
  const needs = all.filter((d) => d.level !== 'green');
  const level = needs.length ? needs[0].level : 'green';
  return { asset, level, needs, all };
}

/** All tasks that are overdue or due soon, most urgent first. */
export function getDueList(
  assets: Asset[],
  tasks: ServiceTask[],
  now: Date,
  th: Thresholds = DEFAULT_THRESHOLDS,
): DueInfo[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  return tasks
    .map((t) => {
      const asset = byId.get(t.assetId);
      return asset ? computeDue(t, asset, now, th) : null;
    })
    .filter((d): d is DueInfo => d !== null && d.level !== 'green')
    .sort((a, b) => a.urgency - b.urgency);
}

export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

/** Assets whose hours have not been updated recently. */
export function getStaleAssets(assets: Asset[], now: Date, staleDays: number): Asset[] {
  return assets
    .filter((a) => daysSince(a.hoursUpdatedAt, now) >= staleDays)
    .sort((a, b) => a.hoursUpdatedAt.localeCompare(b.hoursUpdatedAt));
}

/** Services completed within the last `days` days, newest first. */
export function getRecentLogs(logs: ServiceLog[], now: Date, days = 30): ServiceLog[] {
  return logs
    .filter((l) => daysSince(l.date, now) <= days)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Match a scanned or typed code against barcode, serial number or name. */
export function findAssets(assets: Asset[], query: string): Asset[] {
  const q = query.trim().toLowerCase();
  if (!q) return assets;
  const exact = assets.filter(
    (a) => a.barcode?.toLowerCase() === q || a.serial.toLowerCase() === q,
  );
  if (exact.length) return exact;
  return assets.filter((a) =>
    [a.name, a.serial, a.barcode, a.make, a.model]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q)),
  );
}
