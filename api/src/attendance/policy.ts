/** Business-time constants for attendance monitoring. */
export const NIGHT_LIMIT_HOUR = 21;
export const TZ = 'Asia/Jakarta';

const hhmmFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Minutes since midnight in lab time. */
export function minutesOfDay(instant: Date): number {
  const [hour, minute] = hhmmFormatter.format(instant).split(':');
  return Number(hour) * 60 + Number(minute);
}

/**
 * True when an open session has passed the night limit (21:00 WIB).
 * A session that ended before the limit is never flagged.
 */
export function isOverNightLimit(
  session: { checkedInAt: Date; checkedOutAt: Date | null },
  now: Date,
): boolean {
  const reference = session.checkedOutAt ?? now;
  return minutesOfDay(reference) >= NIGHT_LIMIT_HOUR * 60;
}
