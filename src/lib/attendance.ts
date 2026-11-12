/**
 * Perhitungan jam riset dari data nyata `attendance_sessions`.
 * Semua durasi dihitung dari timestamp check_in/check_out di database,
 * tidak dari state browser.
 */

export interface AttendanceSessionLike {
  userId: string;
  checkIn: string;
  checkOut: string | null;
}

const TZ = "Asia/Jakarta";

/** Awal & akhir minggu berjalan (Senin 00:00 - Senin berikutnya 00:00, zona Jakarta). */
export function getWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  // Tanggal kalender lokal di zona Jakarta.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;

  // Hari kerja dihitung dari tanggal kalender (bukan dari instant UTC midnight WIB,
  // yang jatuh ke hari sebelumnya).
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Minggu
  const daysSinceMonday = (weekday + 6) % 7;

  const midnightWib = new Date(`${iso}T00:00:00+07:00`);
  const start = new Date(midnightWib.getTime() - daysSinceMonday * 86400000);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { start, end };
}

/** Menit sesi yang berada di dalam rentang [start, end). Sesi terbuka dihitung sampai `now`. */
export function minutesWithin(
  session: AttendanceSessionLike,
  start: Date,
  end: Date,
  now: Date = new Date()
): number {
  const checkIn = new Date(session.checkIn);
  if (Number.isNaN(checkIn.getTime())) return 0;
  const checkOut = session.checkOut ? new Date(session.checkOut) : now;
  if (Number.isNaN(checkOut.getTime())) return 0;

  const from = checkIn > start ? checkIn : start;
  const to = checkOut < end ? checkOut : end;
  if (to <= from) return 0;

  return Math.round((to.getTime() - from.getTime()) / 60000);
}

/** Total jam (desimal) untuk satu user dalam rentang tertentu. */
export function hoursForUser(
  sessions: AttendanceSessionLike[],
  userId: string,
  start: Date,
  end: Date,
  now: Date = new Date()
): number {
  const minutes = sessions
    .filter((s) => s.userId === userId)
    .reduce((acc, s) => acc + minutesWithin(s, start, end, now), 0);
  return Math.round((minutes / 60) * 100) / 100;
}

/** Sesi milik user yang belum ditutup (lupa check-out). */
export function openSessionFor(
  sessions: AttendanceSessionLike[],
  userId: string
): AttendanceSessionLike | null {
  return sessions.find((s) => s.userId === userId && !s.checkOut) ?? null;
}
