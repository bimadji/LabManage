import { getPeriod } from './summary.js';

/** Riwayat minggu lalu, sehingga seed tetap masuk akal pada awal minggu/tahun. */
export function researchDemo(now: Date) {
  const lastMonday = Date.parse(getPeriod('week', undefined, now).start) - 7 * 86400_000;
  const at = (day: number, hour: number) =>
    new Date(lastMonday + (day * 24 + hour) * 3600_000).toISOString();
  const label = (instant: string) =>
    new Date(Date.parse(instant) + 7 * 3600_000).toISOString().slice(0, 10);
  return {
    sessions: [
      { checkedInAt: at(0, 9), checkedOutAt: at(0, 11) },
      { checkedInAt: at(1, 22), checkedOutAt: at(2, 1) },
      { checkedInAt: at(2, 9), checkedOutAt: at(2, 10) },
    ],
    warning: {
      weekStart: label(at(0, 0)),
      warningDate: label(at(2, 12)),
      createdAt: at(2, 12),
      totalMinutes: 360,
      targetMinutes: 600,
      note: 'Jadwalkan riset berikutnya bersama tim.',
      message:
        'Kehadiran riset minggu ini 360 dari target 600 menit. Tingkatkan kehadiran Anda. Catatan advisor: Jadwalkan riset berikutnya bersama tim.',
    },
  };
}
