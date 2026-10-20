// Weekly hours: read "8-6" style entries, build the week, and the text sent to the boss.

export const DAY_SHORT = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
/** Day names as they're written in the weekly text. */
export const DAY_TEXT = ['mon', 'tues', 'wed', 'thurs', 'friday', 'saturday', 'sunday'];

/** Monday 00:00 of the week containing d. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export const sameDay = (iso: string, d: Date) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
};

/** Noon local time, so the day never shifts with time zones. */
export const dayIso = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
export const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

function parseTime(t: string): { h: number; ap?: 'a' | 'p' } | null {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?m?\.?$/);
  if (!m) return null;
  const h = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  if (h > 24 || (m[2] && Number(m[2]) > 59)) return null;
  return { h, ap: m[3] as 'a' | 'p' | undefined };
}

export type Span = { hours: number; text: string; note?: string };

/**
 * "8-6" -> 10 h, "7:30-5" -> 9.5 h, "6a-2:30p", "14-22", or just "9" (hours).
 * Without am/pm a start before 5 is read as afternoon, and the end is the first time after the start.
 * Anything after the times ("8-6 Smith job") is kept as a note. Blank or "off" = no hours.
 */
export function parseSpan(raw: string, lunch = 0): Span | null {
  const text = raw.trim();
  if (!text || /^(off|-|0)$/i.test(text)) return null;
  const m = text.match(/^(\d{1,2}(?::?\d{2})?\s*(?:[ap]\.?m?\.?)?)\s*(?:-|–|to)\s*(\d{1,2}(?::?\d{2})?\s*(?:[ap]\.?m?\.?)?)\s*(.*)$/i);
  if (m) {
    const a = parseTime(m[1]);
    const b = parseTime(m[2]);
    if (!a || !b) return null;
    let start = a.h;
    let end = b.h;
    if (a.ap === 'p' && start < 12) start += 12;
    if (a.ap === 'a' && start === 12) start = 0;
    if (!a.ap && start < 5) start += 12;
    if (b.ap === 'p' && end < 12) end += 12;
    if (b.ap === 'a' && end === 12) end = 24;
    if (!b.ap) while (end <= start && end < 24) end += 12;
    if (end <= start) end += 24; // overnight
    const hours = Math.max(0, Math.round((end - start - lunch) * 100) / 100);
    return { hours, text: `${m[1].trim()}-${m[2].trim()}`, note: m[3]?.trim() || undefined };
  }
  const n = text.match(/^(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)?\s*(.*)$/i);
  if (n && Number(n[1]) > 0 && Number(n[1]) <= 24) return { hours: Number(n[1]), text: n[1], note: n[2]?.trim() || undefined };
  return null;
}

export const fmtHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, ''));

/** The text for the boss, as it's usually typed: "mon 8-6, tues 8-6, ... total 60 hours". */
export function weekText(days: { day: Date; text?: string; hours: number }[]): string {
  const parts = days.filter((d) => d.hours > 0).map((d) => `${DAY_TEXT[(d.day.getDay() + 6) % 7]} ${d.text ?? fmtHours(d.hours)}`);
  const total = days.reduce((s, d) => s + d.hours, 0);
  return [...parts, `total ${fmtHours(total)} hours`].join(', ');
}
