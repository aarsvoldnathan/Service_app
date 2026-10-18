import { Asset, ServiceLog, ServiceTask } from './types';

const DAY = 86_400_000;

/** An asset's hours are considered stale after this many days without an update. */
export const STALE_HOURS_DAYS = 7;
/** A date-based service is "due soon" within this many days. */
export const DUE_SOON_DAYS = 14;

export type Status = 'overdue' | 'dueSoon' | 'ok';

export type DueInfo = {
  task: ServiceTask;
  asset: Asset;
  status: Status;
  detail: string;
  /** Sorting key: lower = more urgent. */
  urgency: number;
};

const statusRank: Record<Status, number> = { overdue: 0, dueSoon: 1, ok: 2 };

function describe(value: number, unit: string): string {
  const abs = Math.abs(Math.round(value));
  return value < 0 ? `Overdue by ${abs} ${unit}` : `Due in ${abs} ${unit}`;
}

export function computeDue(task: ServiceTask, asset: Asset, now: Date): DueInfo {
  const parts: { remaining: number; ratio: number; soon: boolean; text: string }[] = [];

  if (task.intervalHours) {
    const remaining = task.lastDoneHours + task.intervalHours - asset.currentHours;
    const soonThreshold = Math.max(10, task.intervalHours * 0.1);
    parts.push({
      remaining,
      ratio: remaining / task.intervalHours,
      soon: remaining <= soonThreshold,
      text: describe(remaining, 'h'),
    });
  }

  if (task.intervalDays) {
    const dueMs = new Date(task.lastDoneDate).getTime() + task.intervalDays * DAY;
    const remaining = Math.ceil((dueMs - now.getTime()) / DAY);
    parts.push({
      remaining,
      ratio: remaining / task.intervalDays,
      soon: remaining <= DUE_SOON_DAYS,
      text: describe(remaining, 'd'),
    });
  }

  // A task with no interval can never come due.
  if (parts.length === 0) {
    return { task, asset, status: 'ok', detail: 'No schedule set', urgency: Infinity };
  }

  const overdue = parts.some((p) => p.remaining < 0);
  const soon = parts.some((p) => p.soon);
  const status: Status = overdue ? 'overdue' : soon ? 'dueSoon' : 'ok';

  // The most urgent trigger (smallest remaining ratio) leads the label.
  const sorted = [...parts].sort((a, b) => a.ratio - b.ratio);
  const detail = sorted.map((p) => p.text).join('  ·  ');

  return { task, asset, status, detail, urgency: sorted[0].ratio };
}

/** All tasks that are overdue or due soon, most urgent first. */
export function getDueList(assets: Asset[], tasks: ServiceTask[], now: Date): DueInfo[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  return tasks
    .map((t) => {
      const asset = byId.get(t.assetId);
      return asset ? computeDue(t, asset, now) : null;
    })
    .filter((d): d is DueInfo => d !== null && d.status !== 'ok')
    .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.urgency - b.urgency);
}

export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

/** Assets whose hours have not been updated recently. */
export function getStaleAssets(assets: Asset[], now: Date): Asset[] {
  return assets
    .filter((a) => daysSince(a.hoursUpdatedAt, now) >= STALE_HOURS_DAYS)
    .sort((a, b) => a.hoursUpdatedAt.localeCompare(b.hoursUpdatedAt));
}

/** Services completed within the last `days` days, newest first. */
export function getRecentLogs(logs: ServiceLog[], now: Date, days = 30): ServiceLog[] {
  return logs
    .filter((l) => daysSince(l.date, now) <= days)
    .sort((a, b) => b.date.localeCompare(a.date));
}
