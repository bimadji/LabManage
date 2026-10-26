import { useEffect, useRef, useState } from 'react';
import { apiFetch, ApiRequestError } from '../lib/api';
import { formatDay, formatTime } from '../lib/datetime';

export interface ResearchPeriod {
  kind: 'week' | 'month';
  start: string;
  end: string;
  days: string[];
}
export interface ResearchMetrics {
  totalHours: number;
  sessionCount: number;
  averageWeeklyHours: number;
  attendanceRate: number;
  overNightSessionCount: number;
  overNightSessionRatio: number;
}
export interface MemberStatistics extends ResearchMetrics {
  userId: string;
  totalMinutes: number;
  targetMinutes: number;
  days: { date: string; minutes: number; sessionCount: number }[];
  fullName: string;
  status: 'KURANG' | 'TERCAPAI';
  daysPresent: number;
  elapsedDays: number;
}
export interface AggregateStatistics extends ResearchMetrics {
  memberCount: number;
  belowTargetCount: number;
}
export interface StatisticsResponse {
  period: ResearchPeriod;
  weeklyTargetMinutes: number;
  targetMinutes: number;
  aggregate: AggregateStatistics;
  members: MemberStatistics[];
  trend: (AggregateStatistics & { period: ResearchPeriod })[];
}
export interface AttendanceTarget {
  weeklyTargetMinutes: number;
  updatedAt: string;
  updatedBy: string | null;
}
export interface AttendanceCorrection {
  id: string;
  attendanceId: string;
  userId: string;
  actorId: string;
  oldCheckedOutAt: string | null;
  checkedOutAt: string;
  reason: string;
  createdAt: string;
}
export interface AdminActions {
  busy: boolean;
  begin: () => boolean;
  end: () => void;
  saved: (kind: 'target' | 'correction', message: string) => void;
}

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
export const hours = (value: number) => `${number.format(value)} jam`;
export const percent = (value: number) => `${number.format(value * 100)}%`;
export const todayWib = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
export const instantWib = (value: string) => `${formatDay(value)}, ${formatTime(value)} WIB`;
export const periodLabel = (period: ResearchPeriod) =>
  `${formatDay(`${period.days[0]}T00:00:00+07:00`)} — ${formatDay(`${period.days.at(-1)}T00:00:00+07:00`)} (WIB)`;
const failureMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : 'Koneksi gagal. Coba lagi.';

// Pemanggil memakai key periode/percobaan agar data lama tidak muncul saat memuat ulang.
export function useAdminResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiFetch<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(failureMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error };
}

export function useAdminMutation(actions: AdminActions) {
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run<T>(request: () => Promise<T>, success: (value: T) => void) {
    if (!actions.begin()) return;
    setError(null);
    try {
      const result = await request();
      if (active.current) success(result);
    } catch (reason) {
      if (active.current) setError(failureMessage(reason));
    } finally {
      actions.end();
    }
  }
  return { error, setError, run };
}

/** datetime-local di formulir ini selalu waktu lab, bukan zona waktu perangkat. */
export function checkoutInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}:00+07:00`);
  if (!Number.isFinite(milliseconds)) return null;
  if (new Date(milliseconds + 7 * 3600_000).toISOString().slice(0, 16) !== value) return null;
  return new Date(milliseconds).toISOString();
}
