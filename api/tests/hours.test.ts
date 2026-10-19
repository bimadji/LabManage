import { describe, expect, it } from 'vitest';
import { isWithinLabHours, wibParts, type LabHours } from '../src/reservations/hours.js';

// 2026-10-20 is a Tuesday (weekday 2).
const WEEKDAY = 2;
const hours: LabHours[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: '07:00',
  closesAt: '21:00',
}));

const wib = (time: string) => new Date(`2026-10-20T${time}+07:00`);

describe('wibParts', () => {
  it('membaca waktu UTC sebagai WIB', () => {
    const parts = wibParts(new Date('2026-10-20T02:30:00Z'));
    expect(parts).toEqual({ dateKey: '2026-10-20', weekday: WEEKDAY, minutes: 9 * 60 + 30 });
  });

  it('melewati tengah malam WIB sebagai tanggal berbeda', () => {
    const parts = wibParts(new Date('2026-10-20T17:30:00Z'));
    expect(parts.dateKey).toBe('2026-10-21');
    expect(parts.minutes).toBe(30);
  });
});

describe('isWithinLabHours', () => {
  it('menerima reservasi di dalam jam operasional', () => {
    expect(isWithinLabHours(wib('09:00:00'), wib('10:00:00'), hours)).toBe(true);
  });

  it('menerima reservasi yang mulai tepat saat lab buka dan selesai tepat saat tutup', () => {
    expect(isWithinLabHours(wib('07:00:00'), wib('21:00:00'), hours)).toBe(true);
  });

  it('menolak reservasi yang selesai lewat 21:00 WIB', () => {
    expect(isWithinLabHours(wib('20:00:00'), wib('21:30:00'), hours)).toBe(false);
  });

  it('menolak reservasi yang mulai sebelum 07:00 WIB', () => {
    expect(isWithinLabHours(wib('06:30:00'), wib('08:00:00'), hours)).toBe(false);
  });

  it('menilai input UTC terhadap WIB, bukan zona server', () => {
    // 14:00Z = 21:00 WIB (masih boleh), 14:01Z = 21:01 WIB (ditolak).
    expect(
      isWithinLabHours(new Date('2026-10-20T13:00:00Z'), new Date('2026-10-20T14:00:00Z'), hours),
    ).toBe(true);
    expect(
      isWithinLabHours(new Date('2026-10-20T13:00:00Z'), new Date('2026-10-20T14:01:00Z'), hours),
    ).toBe(false);
  });

  it('menolak reservasi yang melewati tengah malam', () => {
    expect(isWithinLabHours(wib('20:00:00'), new Date('2026-10-20T22:00:00+07:00'), hours)).toBe(
      false,
    );
  });

  it('menolak hari yang tidak punya jam operasional', () => {
    const onlyMonday = hours.filter((entry) => entry.weekday === 1);
    expect(isWithinLabHours(wib('09:00:00'), wib('10:00:00'), onlyMonday)).toBe(false);
  });
});
