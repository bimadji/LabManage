/**
 * Minutes between check-in and check-out, or between check-in and `now` for a
 * still-open session. `now` is a parameter (not `Date.now()`) so callers and
 * tests control the clock.
 */
export function durationMinutes(
  session: { checkedInAt: Date; checkedOutAt: Date | null },
  now: Date,
): number {
  const end = session.checkedOutAt ?? now;
  const ms = end.getTime() - session.checkedInAt.getTime();
  return Math.max(0, Math.round(ms / 60_000));
}
