const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** e.g. "Selasa, 20 Oktober 2026" in lab time. */
export function formatDay(instant: string): string {
  return dateFormatter.format(new Date(instant));
}

/** e.g. "09:00" in lab time. */
export function formatTime(instant: string): string {
  return timeFormatter.format(new Date(instant));
}

/** Groups reservations by their WIB calendar day, keeping input order. */
export function groupByDay<T extends { startsAt: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = new Date(item.startsAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()];
}

/** Converts a `datetime-local` value (lab local time, no offset) to an ISO instant. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
