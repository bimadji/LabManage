import type { PresentSession } from './applyAttendanceChange';

/** Menit penuh sesi yang masih berjalan; durationMinutes dari response tidak dijadikan timer. */
export function elapsedMinutes(session: Pick<PresentSession, 'checkedInAt'>, now: number): number {
  const checkedIn = Date.parse(session.checkedInAt);
  if (!Number.isFinite(checkedIn) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.floor((now - checkedIn) / 60_000));
}

export function liveDurationLabel(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return hours > 0 ? `${hours} jam ${rest} menit` : `${rest} menit`;
}

export function liveMetrics(sessions: PresentSession[]) {
  return {
    present: sessions.length,
    late: sessions.filter((session) => session.overNightLimit).length,
  };
}
