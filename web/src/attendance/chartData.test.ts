import { describe, expect, it } from 'vitest';
import { dailyAttendance, targetProgress, weeklyTrend, type AttendanceMember } from './chartData';

const period = {
  start: '2026-10-19T00:00:00+07:00',
  end: '2026-10-25T00:00:00+07:00',
  days: ['2026-10-21', '2026-10-19', '2026-10-20'],
};

function member(days: AttendanceMember['days']): AttendanceMember {
  return {
    fullName: 'Bima',
    totalMinutes: 120,
    targetMinutes: 600,
    days,
    averageWeeklyHours: 2,
    attendanceRate: 0.5,
    overNightSessionCount: 0,
    overNightSessionRatio: 0,
  };
}

describe('dailyAttendance', () => {
  it('mengikuti urutan periode dan menggabungkan hari anggota tanpa menghitung hari di luar periode', () => {
    const result = dailyAttendance(period, [
      member([
        { date: '2026-10-19', minutes: 30, sessionCount: 1 },
        { date: '2026-10-21', minutes: 45, sessionCount: 1 },
        { date: '2026-10-18', minutes: 90, sessionCount: 1 },
      ]),
      {
        ...member([{ date: '2026-10-19', minutes: 15, sessionCount: 2 }]),
        fullName: 'Rani',
      },
    ]);

    expect(result).toEqual([
      { date: '2026-10-21', minutes: 45, sessionCount: 1 },
      { date: '2026-10-19', minutes: 45, sessionCount: 3 },
      { date: '2026-10-20', minutes: 0, sessionCount: 0 },
    ]);
  });

  it('mempertahankan hari kosong sebagai nol dan tidak menduplikasi tanggal pada payload tidak valid', () => {
    expect(dailyAttendance({ ...period, days: ['2026-10-19', '2026-10-19'] }, [])).toEqual([
      { date: '2026-10-19', minutes: 0, sessionCount: 0 },
    ]);
    expect(dailyAttendance({ ...period, days: [] }, [])).toEqual([]);
  });
});

describe('targetProgress', () => {
  it('memisahkan persen aktual dari rasio visual yang dibatasi', () => {
    expect(targetProgress(900, 600)).toEqual({ ratio: 1, percent: 150, remainingMinutes: 0 });
    expect(targetProgress(150, 600)).toEqual({ ratio: 0.25, percent: 25, remainingMinutes: 450 });
  });

  it('menghasilkan nol yang aman saat target nol atau negatif', () => {
    expect(targetProgress(120, 0)).toEqual({ ratio: 0, percent: 0, remainingMinutes: 0 });
    expect(targetProgress(120, -600)).toEqual({ ratio: 0, percent: 0, remainingMinutes: 0 });
  });
});

describe('weeklyTrend', () => {
  it('memetakan metrik minggu dan menyediakan skala aman untuk seri nol', () => {
    expect(
      weeklyTrend([
        {
          period,
          totalHours: 0,
          memberCount: 0,
          belowTargetCount: 0,
          attendanceRate: 0,
          sessionCount: 0,
        },
      ]),
    ).toEqual([
      {
        date: '2026-10-19',
        totalHours: 0,
        memberCount: 0,
        belowTargetCount: 0,
        attendanceRate: 0,
        sessionCount: 0,
        averageWeeklyHours: 0,
        overNightSessionCount: 0,
        overNightSessionRatio: 0,
        maxHours: 1,
      },
    ]);
  });

  it('menampilkan tanggal awal minggu dalam WIB, bukan tanggal UTC', () => {
    const result = weeklyTrend([
      {
        period: { ...period, start: '2026-10-18T17:00:00Z' },
        totalHours: 1,
        memberCount: 1,
        belowTargetCount: 0,
        attendanceRate: 1,
        sessionCount: 1,
      },
    ]);
    expect(result[0].date).toBe('2026-10-19');
  });

  it('menggunakan nilai maksimum seri sebagai skala, termasuk satu titik', () => {
    const result = weeklyTrend([
      {
        period,
        totalHours: 4.5,
        memberCount: 2,
        belowTargetCount: 1,
        attendanceRate: 0.75,
        sessionCount: 3,
      },
      {
        period: { ...period, start: '2026-10-12T00:00:00+07:00' },
        totalHours: 8,
        memberCount: 3,
        belowTargetCount: 0,
        attendanceRate: 1,
        sessionCount: 5,
      },
    ]);

    expect(result.map((week) => [week.date, week.maxHours])).toEqual([
      ['2026-10-19', 8],
      ['2026-10-12', 8],
    ]);
  });
});
