import { NIGHT_LIMIT_HOUR } from './policy.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface AttendancePeriod {
  kind: 'week' | 'month';
  start: string;
  end: string;
  days: string[];
}

export interface SummarySession {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
}

export interface AttendanceSummary {
  totalMinutes: number;
  totalHours: number;
  sessionCount: number;
  targetMinutes: number;
  status: 'KURANG' | 'TERCAPAI';
  days: { date: string; minutes: number; sessionCount: number }[];
  daysPresent: number;
  elapsedDays: number;
  attendanceRate: number;
  averageWeeklyHours: number;
  overNightSessionCount: number;
  overNightSessionRatio: number;
}

function dateLabel(midnight: number): string {
  return new Date(midnight).toISOString().slice(0, 10);
}

export function getPeriod(
  kind: 'week' | 'month',
  date?: string,
  now: Date = new Date(),
): AttendancePeriod {
  const selected = date ?? dateLabel(now.getTime() + WIB_OFFSET_MS);
  const midnight = Date.parse(`${selected}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(selected) ||
    !Number.isFinite(midnight) ||
    dateLabel(midnight) !== selected
  ) {
    throw new RangeError('Tanggal harus valid dengan format YYYY-MM-DD.');
  }

  const day = new Date(midnight);
  let start: number;
  let end: number;
  if (kind === 'week') {
    start = midnight - ((day.getUTCDay() + 6) % 7) * DAY_MS;
    end = start + 7 * DAY_MS;
  } else {
    day.setUTCDate(1);
    start = day.getTime();
    day.setUTCMonth(day.getUTCMonth() + 1);
    end = day.getTime();
  }

  const days: string[] = [];
  for (let cursor = start; cursor < end; cursor += DAY_MS) {
    const label = dateLabel(cursor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(label)) {
      throw new RangeError('Periode berada di luar rentang tahun yang didukung.');
    }
    days.push(label);
  }
  return {
    kind,
    start: new Date(start - WIB_OFFSET_MS).toISOString(),
    end: new Date(end - WIB_OFFSET_MS).toISOString(),
    days,
  };
}

export function summarizeAttendance(
  sessions: SummarySession[],
  period: AttendancePeriod,
  weeklyTargetMinutes: number,
  now: Date = new Date(),
): AttendanceSummary {
  const periodStart = Date.parse(period.start);
  const periodEnd = Date.parse(period.end);
  const nowMs = now.getTime();
  const days = period.days.map((date) => ({
    date,
    start: Date.parse(`${date}T00:00:00.000+07:00`),
    milliseconds: 0,
    sessionCount: 0,
  }));
  const countedIds = new Set<string>();
  let totalMilliseconds = 0;
  let overNightSessionCount = 0;

  for (const session of sessions) {
    if (countedIds.has(session.id)) continue;
    const start = Math.max(Date.parse(session.checkedInAt), periodStart);
    const end = Math.min(
      session.checkedOutAt === null ? nowMs : Date.parse(session.checkedOutAt),
      periodEnd,
      nowMs,
    );
    if (!(end > start)) continue;

    countedIds.add(session.id);
    totalMilliseconds += end - start;
    let overNight = false;
    for (const day of days) {
      const overlapStart = Math.max(start, day.start);
      const overlapEnd = Math.min(end, day.start + DAY_MS);
      if (overlapEnd <= overlapStart) continue;
      day.milliseconds += overlapEnd - overlapStart;
      day.sessionCount += 1;
      if (overlapEnd > Math.max(overlapStart, day.start + NIGHT_LIMIT_HOUR * 60 * MINUTE_MS)) {
        overNight = true;
      }
    }
    if (overNight) overNightSessionCount += 1;
  }

  // Jumlahkan milidetik dahulu agar pecahan menit tidak menggeser batas target.
  const totalMinutes = totalMilliseconds / MINUTE_MS;
  const totalHours = totalMinutes / 60;
  const targetMinutes =
    period.kind === 'month' ? (weeklyTargetMinutes * period.days.length) / 7 : weeklyTargetMinutes;
  const daysPresent = days.filter((day) => day.milliseconds > 0).length;
  const elapsedDays = days.filter((day) => day.start <= nowMs).length;
  const sessionCount = countedIds.size;

  return {
    totalMinutes,
    totalHours,
    sessionCount,
    targetMinutes,
    status: totalMinutes < targetMinutes ? 'KURANG' : 'TERCAPAI',
    days: days.map((day) => ({
      date: day.date,
      minutes: day.milliseconds / MINUTE_MS,
      sessionCount: day.sessionCount,
    })),
    daysPresent,
    elapsedDays,
    attendanceRate: elapsedDays === 0 ? 0 : daysPresent / elapsedDays,
    averageWeeklyHours: totalHours / (period.days.length / 7),
    overNightSessionCount,
    overNightSessionRatio: sessionCount === 0 ? 0 : overNightSessionCount / sessionCount,
  };
}
