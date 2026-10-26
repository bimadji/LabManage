export interface AttendanceDay {
  date: string;
  minutes: number;
  sessionCount: number;
}

export interface AttendanceMember {
  fullName: string;
  totalMinutes: number;
  targetMinutes: number;
  days: AttendanceDay[];
  averageWeeklyHours: number;
  attendanceRate: number;
  overNightSessionCount: number;
  overNightSessionRatio: number;
}

export interface AttendancePeriod {
  start: string;
  end: string;
  days: string[];
}

/** Periode tren menerima periode admin/advisor tanpa mengubah tipe bersama. */
export interface TrendPeriod {
  start: string;
  end?: string;
  days?: string[];
  kind?: string;
}

export interface TargetProgress {
  ratio: number;
  percent: number;
  remainingMinutes: number;
}

export interface TrendPoint {
  date: string;
  totalHours: number;
  memberCount: number;
  belowTargetCount: number;
  attendanceRate: number;
  sessionCount: number;
  maxHours: number;
  averageWeeklyHours: number;
  overNightSessionCount: number;
  overNightSessionRatio: number;
}

export interface AttendanceWeek {
  period: TrendPeriod;
  totalHours: number;
  memberCount: number;
  belowTargetCount: number;
  attendanceRate: number;
  sessionCount: number;
  averageWeeklyHours?: number;
  overNightSessionCount?: number;
  overNightSessionRatio?: number;
}

/** Jumlah durasi tiap tanggal periode; tanggal anggota di luar periode diabaikan. */
export function dailyAttendance(
  period: AttendancePeriod,
  members: AttendanceMember[],
): AttendanceDay[] {
  const totals = new Map<string, AttendanceDay>();
  for (const date of period.days) {
    if (!totals.has(date)) totals.set(date, { date, minutes: 0, sessionCount: 0 });
  }
  for (const member of members) {
    for (const day of member.days) {
      const total = totals.get(day.date);
      if (!total) continue;
      total.minutes += day.minutes;
      total.sessionCount += day.sessionCount;
    }
  }
  return [...totals.values()];
}

/** Rasio visual 0..1, persen aktual (skala 0..100), dan sisa menit; target nol menghasilkan nol semua. */
export function targetProgress(actualMinutes: number, targetMinutes: number): TargetProgress {
  const actual = Number.isFinite(actualMinutes) ? Math.max(0, actualMinutes) : 0;
  const target = Number.isFinite(targetMinutes) ? targetMinutes : 0;
  if (target <= 0) return { ratio: 0, percent: 0, remainingMinutes: 0 };
  return {
    ratio: Math.min(1, actual / target),
    percent: (actual / target) * 100,
    remainingMinutes: Math.max(0, target - actual),
  };
}

/** Titik tren mingguan dengan skala maksimum yang aman walau seluruh nilai nol. */
export function weeklyTrend(weeks: AttendanceWeek[]): TrendPoint[] {
  const maxHours = Math.max(
    1,
    ...weeks.map((week) => (Number.isFinite(week.totalHours) ? week.totalHours : 0)),
  );
  return weeks.map((week) => {
    const parsed = Date.parse(week.period.start);
    const date = Number.isFinite(parsed)
      ? new Date(parsed).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      : (week.period.days?.[0] ?? '');
    return {
      date,
      totalHours: week.totalHours,
      memberCount: week.memberCount,
      belowTargetCount: week.belowTargetCount,
      attendanceRate: week.attendanceRate,
      sessionCount: week.sessionCount,
      averageWeeklyHours: week.averageWeeklyHours ?? 0,
      overNightSessionCount: week.overNightSessionCount ?? 0,
      overNightSessionRatio: week.overNightSessionRatio ?? 0,
      maxHours,
    };
  });
}
