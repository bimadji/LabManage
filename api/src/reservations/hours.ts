/** Lab opening hours. Weekday follows JS conventions: 0 = Sunday. */
export interface LabHours {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export const TZ = 'Asia/Jakarta';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface WibParts {
  dateKey: string;
  weekday: number;
  minutes: number;
}

const wibFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Wall-clock date, weekday, and minutes since midnight of `instant` in Asia/Jakarta. */
export function wibParts(instant: Date): WibParts {
  const parts = wibFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAY_INDEX[get('weekday')] ?? -1,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

/**
 * True when the whole reservation fits inside one day's opening hours in WIB.
 * A reservation that crosses midnight, or a day with no configured hours, is outside.
 */
export function isWithinLabHours(startsAt: Date, endsAt: Date, hours: LabHours[]): boolean {
  const start = wibParts(startsAt);
  const end = wibParts(endsAt);
  if (start.dateKey !== end.dateKey) return false;

  const row = hours.find((entry) => entry.weekday === start.weekday);
  if (!row) return false;

  return start.minutes >= toMinutes(row.opensAt) && end.minutes <= toMinutes(row.closesAt);
}
