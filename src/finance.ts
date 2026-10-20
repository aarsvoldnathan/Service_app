import { Expense, Job, TimeEntry } from './types';

export type JobTotals = { hours: number; labor: number; expenses: number; total: number };

export function jobTotals(job: Job, entries: TimeEntry[], expenses: Expense[]): JobTotals {
  const hours = entries.filter((e) => e.jobId === job.id).reduce((s, e) => s + e.hours, 0);
  const exp = expenses.filter((e) => e.jobId === job.id).reduce((s, e) => s + e.amount, 0);
  const labor = hours * job.rate;
  return { hours, labor, expenses: exp, total: labor + exp };
}

/** Hours on the running clock right now (0 when stopped). */
export function runningHours(job: Job, now: Date = new Date()): number {
  if (!job.clockStartedAt) return 0;
  const ms = now.getTime() - new Date(job.clockStartedAt).getTime();
  return ms > 0 ? ms / 3600000 : 0;
}

/** Totals including the time on a running clock. */
export function liveTotals(job: Job, entries: TimeEntry[], expenses: Expense[], now: Date = new Date()): JobTotals & { running: number } {
  const t = jobTotals(job, entries, expenses);
  const running = runningHours(job, now);
  return { ...t, running, hours: t.hours + running, labor: t.labor + running * job.rate, total: t.total + running * job.rate };
}

/** 1.5 h -> "1:30:00". */
export function clockText(hours: number): string {
  const total = Math.max(0, Math.floor(hours * 3600));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type Period = 'week' | 'month' | 'quarter' | 'year';

export const PERIOD_LABEL: Record<Period, string> = {
  week: 'Weekly',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Annually',
};

/** How many past periods the chart shows. */
const COUNT: Record<Period, number> = { week: 8, month: 12, quarter: 8, year: 5 };

export type Bucket = {
  label: string;
  start: Date;
  end: Date;
  hours: number;
  income: number;
  expenses: number;
};

function startOf(period: Period, d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === 'week') {
    const day = (x.getDay() + 6) % 7; // Monday = 0
    x.setDate(x.getDate() - day);
  } else if (period === 'month') {
    x.setDate(1);
  } else if (period === 'quarter') {
    x.setMonth(Math.floor(x.getMonth() / 3) * 3, 1);
  } else {
    x.setMonth(0, 1);
  }
  return x;
}

function add(period: Period, d: Date, n: number): Date {
  const x = new Date(d);
  if (period === 'week') x.setDate(x.getDate() + 7 * n);
  else if (period === 'month') x.setMonth(x.getMonth() + n);
  else if (period === 'quarter') x.setMonth(x.getMonth() + 3 * n);
  else x.setFullYear(x.getFullYear() + n);
  return x;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function label(period: Period, start: Date): string {
  if (period === 'week') return `${start.getMonth() + 1}/${start.getDate()}`;
  if (period === 'month') return MONTHS[start.getMonth()];
  if (period === 'quarter') return `Q${Math.floor(start.getMonth() / 3) + 1} '${String(start.getFullYear()).slice(2)}`;
  return String(start.getFullYear());
}

/**
 * Income (hours × job rate) and expenses per period, oldest first.
 * technicianId filters to one person; undefined = everyone.
 */
export function buckets(
  period: Period,
  jobs: Job[],
  entries: TimeEntry[],
  expenses: Expense[],
  technicianId?: string,
  now = new Date(),
): Bucket[] {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const who = (techId: string | undefined, jobId: string) => techId ?? jobById.get(jobId)?.technicianId;
  const current = startOf(period, now);
  const list: Bucket[] = [];
  for (let i = COUNT[period] - 1; i >= 0; i--) {
    const start = add(period, current, -i);
    list.push({ label: label(period, start), start, end: add(period, start, 1), hours: 0, income: 0, expenses: 0 });
  }
  const find = (iso: string) => {
    const t = new Date(iso).getTime();
    return list.find((b) => t >= b.start.getTime() && t < b.end.getTime());
  };
  entries.forEach((e) => {
    if (technicianId && who(e.technicianId, e.jobId) !== technicianId) return;
    const job = jobById.get(e.jobId);
    const b = find(e.date);
    if (!job || !b) return;
    b.hours += e.hours;
    b.income += e.hours * job.rate;
  });
  expenses.forEach((e) => {
    if (technicianId && who(e.technicianId, e.jobId) !== technicianId) return;
    const b = find(e.date);
    if (b) b.expenses += e.amount;
  });
  return list;
}
