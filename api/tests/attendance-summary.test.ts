import { describe, expect, it } from 'vitest';
import { getPeriod, summarizeAttendance } from '../src/attendance/summary.js';

describe('getPeriod', () => {
  it('minggu WIB dimulai Senin dan dapat melintasi tahun', () => {
    expect(getPeriod('week', '2025-01-01')).toEqual({
      kind: 'week',
      start: '2024-12-29T17:00:00.000Z',
      end: '2025-01-05T17:00:00.000Z',
      days: [
        '2024-12-30',
        '2024-12-31',
        '2025-01-01',
        '2025-01-02',
        '2025-01-03',
        '2025-01-04',
        '2025-01-05',
      ],
    });
    expect(getPeriod('week', '2025-01-05').start).toBe('2024-12-29T17:00:00.000Z');
    expect(getPeriod('week', '2025-01-06').start).toBe('2025-01-05T17:00:00.000Z');
  });

  it('tanggal default mengikuti pergantian hari WIB, bukan UTC', () => {
    expect(getPeriod('week', undefined, new Date('2026-10-18T16:59:59Z')).days[0]).toBe(
      '2026-10-12',
    );
    expect(getPeriod('week', undefined, new Date('2026-10-18T17:00:00Z')).days[0]).toBe(
      '2026-10-19',
    );
  });

  it.each([
    ['2024-02-29', 29, '2024-01-31T17:00:00.000Z', '2024-02-29T17:00:00.000Z'],
    ['2026-02-15', 28, '2026-01-31T17:00:00.000Z', '2026-02-28T17:00:00.000Z'],
    ['2026-12-31', 31, '2026-11-30T17:00:00.000Z', '2026-12-31T17:00:00.000Z'],
    ['2000-02-29', 29, '2000-01-31T17:00:00.000Z', '2000-02-29T17:00:00.000Z'],
  ])('bulan kalender %s memiliki %i hari', (date, days, start, end) => {
    const period = getPeriod('month', date);
    expect(period.kind).toBe('month');
    expect(period.start).toBe(start);
    expect(period.end).toBe(end);
    expect(period.days).toHaveLength(days);
    expect(period.days[0]).toBe(`${date.slice(0, 7)}-01`);
    expect(period.days.at(-1)).toBe(`${date.slice(0, 7)}-${days}`);
  });

  it.each([
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
    '2026-10-00',
    '2026-1-01',
    '26-10-20',
    '2026-10-20T00:00:00Z',
    ' 2026-10-20',
    '',
  ])('menolak tanggal yang tidak tepat YYYY-MM-DD: %s', (date) => {
    expect(() => getPeriod('week', date)).toThrow();
  });
});

describe('summarizeAttendance', () => {
  const week = getPeriod('week', '2026-10-20');
  const afterWeek = new Date('2026-10-26T00:00:00+07:00');

  it('memotong sesi pada periode dan membagi durasi pada tengah malam WIB', () => {
    const result = summarizeAttendance(
      [
        {
          id: 'before',
          checkedInAt: '2026-10-18T23:30:00+07:00',
          checkedOutAt: '2026-10-19T00:30:00+07:00',
        },
        {
          id: 'cross-day',
          checkedInAt: '2026-10-19T23:45:00+07:00',
          checkedOutAt: '2026-10-20T00:15:00+07:00',
        },
        {
          id: 'after',
          checkedInAt: '2026-10-25T23:30:00+07:00',
          checkedOutAt: '2026-10-26T00:30:00+07:00',
        },
      ],
      week,
      600,
      afterWeek,
    );
    expect(result).toEqual({
      totalMinutes: 90,
      totalHours: 1.5,
      sessionCount: 3,
      targetMinutes: 600,
      status: 'KURANG',
      days: [
        { date: '2026-10-19', minutes: 45, sessionCount: 2 },
        { date: '2026-10-20', minutes: 15, sessionCount: 1 },
        { date: '2026-10-21', minutes: 0, sessionCount: 0 },
        { date: '2026-10-22', minutes: 0, sessionCount: 0 },
        { date: '2026-10-23', minutes: 0, sessionCount: 0 },
        { date: '2026-10-24', minutes: 0, sessionCount: 0 },
        { date: '2026-10-25', minutes: 30, sessionCount: 1 },
      ],
      daysPresent: 3,
      elapsedDays: 7,
      attendanceRate: 3 / 7,
      averageWeeklyHours: 1.5,
      overNightSessionCount: 2,
      overNightSessionRatio: 2 / 3,
    });
  });

  it('memotong sesi terbuka dan tertutup pada sekarang serta mengabaikan sesi future', () => {
    const result = summarizeAttendance(
      [
        { id: 'open', checkedInAt: '2026-10-20T09:30:00+07:00', checkedOutAt: null },
        {
          id: 'closed-future',
          checkedInAt: '2026-10-20T10:00:00+07:00',
          checkedOutAt: '2026-10-20T12:00:00+07:00',
        },
        { id: 'future', checkedInAt: '2026-10-21T09:00:00+07:00', checkedOutAt: null },
      ],
      week,
      600,
      new Date('2026-10-20T10:30:30+07:00'),
    );
    expect(result.totalMinutes).toBe(91);
    expect(result.sessionCount).toBe(2);
    expect(result.days[1]).toEqual({ date: '2026-10-20', minutes: 91, sessionCount: 2 });
    expect(result.daysPresent).toBe(1);
    expect(result.elapsedDays).toBe(2);
    expect(result.attendanceRate).toBe(0.5);
    expect(result.overNightSessionRatio).toBe(0);
  });

  it.each([
    ['2026-10-19T09:59:59.999+07:00', 'KURANG', 59.99998333333333],
    ['2026-10-19T10:00:00.000+07:00', 'TERCAPAI', 60],
    ['2026-10-19T10:00:00.001+07:00', 'TERCAPAI', 60.00001666666667],
  ])('membandingkan target tanpa pembulatan pada %s', (checkedOutAt, status, minutes) => {
    const result = summarizeAttendance(
      [{ id: 'target', checkedInAt: '2026-10-19T09:00:00+07:00', checkedOutAt }],
      week,
      60,
      afterWeek,
    );
    expect(result.status).toBe(status);
    expect(result.totalMinutes).toBe(minutes);
    expect(result.days[0].minutes).toBe(minutes);
  });

  it('menjumlahkan milidetik sebelum konversi menit agar tepat target tetap TERCAPAI', () => {
    const result = summarizeAttendance(
      Array.from({ length: 6 }, (_, i) => ({
        id: `fraction-${i}`,
        checkedInAt: `2026-10-19T09:00:${i}0+07:00`,
        checkedOutAt: `2026-10-19T09:00:${i}9.999+07:00`,
      })).concat([
        {
          id: 'remainder',
          checkedInAt: '2026-10-19T09:01:00.000+07:00',
          checkedOutAt: '2026-10-19T09:01:00.006+07:00',
        },
      ]),
      week,
      1,
      afterWeek,
    );
    expect(result.totalMinutes).toBe(1);
    expect(result.days[0].minutes).toBe(1);
    expect(result.status).toBe('TERCAPAI');
  });

  it('sesi tanpa irisan positif tidak dihitung', () => {
    const result = summarizeAttendance(
      [
        { id: 'before', checkedInAt: '2026-10-18T23:00:00+07:00', checkedOutAt: week.start },
        { id: 'after', checkedInAt: week.end, checkedOutAt: null },
        {
          id: 'zero',
          checkedInAt: '2026-10-20T09:00:00+07:00',
          checkedOutAt: '2026-10-20T09:00:00+07:00',
        },
        {
          id: 'negative',
          checkedInAt: '2026-10-20T10:00:00+07:00',
          checkedOutAt: '2026-10-20T09:00:00+07:00',
        },
      ],
      week,
      0,
      afterWeek,
    );
    expect(result.totalMinutes).toBe(0);
    expect(result.sessionCount).toBe(0);
    expect(result.daysPresent).toBe(0);
    expect(result.attendanceRate).toBe(0);
    expect(result.status).toBe('TERCAPAI');
    expect(result.overNightSessionRatio).toBe(0);
  });

  it.each([
    ['2026-10-18T23:59:59+07:00', 0],
    ['2026-10-19T00:00:00+07:00', 1],
    ['2026-10-20T00:00:00+07:00', 2],
    ['2026-10-25T00:00:00+07:00', 7],
    ['2026-11-01T00:00:00+07:00', 7],
  ])('denominator hari kalender termasuk hari berjalan pada %s', (now, elapsedDays) => {
    const result = summarizeAttendance([], week, 600, new Date(now));
    expect(result.elapsedDays).toBe(elapsedDays);
    expect(result.attendanceRate).toBe(0);
    expect(result.totalMinutes).toBe(0);
  });

  it.each([
    ['2024-02-15', 29, 290],
    ['2026-02-15', 28, 280],
    ['2026-10-15', 31, 310],
  ])('target dan rata-rata mingguan proporsional hari bulan %s', (date, days, target) => {
    const period = getPeriod('month', date);
    const result = summarizeAttendance(
      [
        {
          id: 'month',
          checkedInAt: `${date}T09:00:00+07:00`,
          checkedOutAt: `${date}T16:00:00+07:00`,
        },
      ],
      period,
      70,
      new Date(period.end),
    );
    expect(result.targetMinutes).toBe(target);
    expect(result.averageWeeklyHours).toBe(7 / (days / 7));
    expect(result.elapsedDays).toBe(days);
    expect(result.attendanceRate).toBe(1 / days);
  });

  it('target bulan mempertahankan pecahan menit', () => {
    expect(
      summarizeAttendance([], getPeriod('month', '2026-10-20'), 600, afterWeek).targetMinutes,
    ).toBe(600 * (31 / 7));
  });

  it.each([
    ['2026-10-19T20:00:00+07:00', '2026-10-19T21:00:00+07:00', 0],
    ['2026-10-19T21:00:00+07:00', '2026-10-19T21:00:00.001+07:00', 1],
    ['2026-10-19T23:00:00+07:00', '2026-10-20T01:00:00+07:00', 1],
    ['2026-10-19T01:00:00+07:00', '2026-10-19T02:00:00+07:00', 0],
    ['2026-10-18T23:00:00+07:00', '2026-10-19T01:00:00+07:00', 0],
  ])('malam dihitung hanya dari irisan setelah 21:00: %s sampai %s', (start, end, count) => {
    const result = summarizeAttendance(
      [{ id: 'night', checkedInAt: start, checkedOutAt: end }],
      week,
      600,
      afterWeek,
    );
    expect(result.overNightSessionCount).toBe(count);
    expect(result.overNightSessionRatio).toBe(count);
  });

  it('satu sesi panjang tetap dihitung sekali meski melewati beberapa malam', () => {
    const session = {
      id: 'long',
      checkedInAt: '2026-10-18T23:00:00+07:00',
      checkedOutAt: '2026-10-27T01:00:00+07:00',
    };
    const result = summarizeAttendance([session, session], week, 600, afterWeek);
    expect(result.totalMinutes).toBe(10080);
    expect(result.sessionCount).toBe(1);
    expect(result.daysPresent).toBe(7);
    expect(result.overNightSessionCount).toBe(1);
    expect(result.overNightSessionRatio).toBe(1);
    expect(result.days.every((day) => day.minutes === 1440 && day.sessionCount === 1)).toBe(true);
  });

  it('tidak menghitung malam di bagian sesi yang masih future', () => {
    const result = summarizeAttendance(
      [
        {
          id: 'future-night',
          checkedInAt: '2026-10-19T20:00:00+07:00',
          checkedOutAt: '2026-10-19T22:00:00+07:00',
        },
      ],
      week,
      600,
      new Date('2026-10-19T21:00:00+07:00'),
    );
    expect(result.totalMinutes).toBe(60);
    expect(result.overNightSessionCount).toBe(0);
  });
});
