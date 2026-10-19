const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date as YYYY-MM-DD in local time. */
export const todayText = () => dateText(new Date());

export const dateText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-10-18" -> ISO timestamp at local noon, or null if invalid. Future dates (beyond tomorrow) are rejected. */
export function parseDate(text: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date.getTime() > Date.now() + 86_400_000) return null;
  return date.toISOString();
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const money = (n: number) =>
  `$${(Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Parse "12.50" or "$1,234.5" into a number (NaN if invalid). */
export const parseMoney = (s: string) => Number(s.replace(/[$,\s]/g, ''));
