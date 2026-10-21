import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { formatDay, formatTime } from '../lib/datetime';

interface PersonalSummary {
  userId: string;
  totalHours: number;
  sessionCount: number;
  status: 'KURANG' | 'TERCAPAI';
  daysPresent: number;
  elapsedDays: number;
  attendanceRate: number;
  days: { date: string; minutes: number; sessionCount: number }[];
}
interface SummaryResponse {
  period: { kind: 'week' | 'month'; start: string; end: string; days: string[] };
  weeklyTargetMinutes: number;
  targetMinutes: number;
  members: PersonalSummary[];
}
interface AttendanceWarning {
  id: string;
  userId: string;
  weekStart: string;
  message: string;
  totalMinutes: number;
  targetMinutes: number;
  createdAt: string;
}
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const hours = (minutes: number) => `${number.format(minutes / 60)} jam`;
const calendarDay = (day: string) => formatDay(`${day}T00:00:00+07:00`);

// Setiap filter/akun merender panel baru; respons lama diabaikan setelah unmount.
function useRead<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiFetch<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof ApiRequestError ? reason.message : 'Koneksi gagal. Coba lagi.',
          );
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error };
}

function LoadError({
  message,
  retry,
  label,
}: {
  message: string;
  retry: () => void;
  label: string;
}) {
  return (
    <div className="card">
      <p className="error" role="alert">
        {message}
      </p>
      <button type="button" onClick={retry}>
        {label}
      </button>
    </div>
  );
}

function SummaryPanel({
  userId,
  period,
  date,
  retry,
}: {
  userId: string;
  period: string;
  date: string;
  retry: () => void;
}) {
  const query = new URLSearchParams({ period, date, userId });
  const { data, error } = useRead<SummaryResponse>(`/attendance/summary?${query}`);
  if (error) return <LoadError message={error} retry={retry} label="Coba lagi rekap" />;
  if (!data) return <p role="status">Memuat rekap…</p>;
  const own = data.members.find((member) => member.userId === userId);
  if (!own) return <p className="card">Rekap pribadi belum tersedia untuk periode ini.</p>;
  return (
    <>
      <p className="summary-period">
        {calendarDay(data.period.days[0])} — {calendarDay(data.period.days.at(-1)!)} (WIB)
      </p>
      <div className="card summary-total">
        <span className={own.status === 'KURANG' ? 'badge badge-warn' : 'badge badge-ok'}>
          {own.status}
        </span>
        <dl className="summary-metrics">
          <div>
            <dt>Total riset</dt>
            <dd>{number.format(own.totalHours)} jam</dd>
          </div>
          <div>
            <dt>Target periode</dt>
            <dd>{hours(data.targetMinutes)}</dd>
          </div>
          <div>
            <dt>Jumlah sesi</dt>
            <dd>{own.sessionCount}</dd>
          </div>
          <div>
            <dt>Hari hadir</dt>
            <dd>
              {own.daysPresent} dari {own.elapsedDays} hari berlalu
            </dd>
          </div>
          <div>
            <dt>Tingkat kehadiran</dt>
            <dd>{number.format(own.attendanceRate * 100)}%</dd>
          </div>
        </dl>
        <p className="muted">
          Target mingguan: {hours(data.weeklyTargetMinutes)}.{' '}
          {data.period.kind === 'month' && 'Target bulanan mengikuti jumlah hari kalender.'}
        </p>
        <p className="muted hint">
          Status memakai durasi penuh sebelum pembulatan tampilan. Hari berjalan termasuk dalam
          tingkat kehadiran.
        </p>
        {own.sessionCount === 0 && (
          <p>Belum ada sesi pada periode ini. Gunakan Check-in / check-out saat mulai riset.</p>
        )}
      </div>
      <h3>Kehadiran per hari</h3>
      <ul className="cards summary-days" aria-label="Kehadiran per hari">
        {own.days.map((day) => (
          <li className="card" key={day.date}>
            <h4>
              <time dateTime={day.date}>{calendarDay(day.date)}</time>
            </h4>
            <p>
              {hours(day.minutes)} · {day.sessionCount} sesi
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function WarningsPanel({ userId, retry }: { userId: string; retry: () => void }) {
  const { data, error } = useRead<AttendanceWarning[]>(
    `/attendance/warnings?${new URLSearchParams({ userId })}`,
  );
  if (error) return <LoadError message={error} retry={retry} label="Coba lagi peringatan" />;
  if (!data) return <p role="status">Memuat peringatan…</p>;
  const own = data.filter((warning) => warning.userId === userId);
  if (own.length === 0)
    return (
      <p className="card muted">Belum ada peringatan. Muat ulang untuk memeriksa pesan baru.</p>
    );
  return (
    <ul className="cards" aria-label="Riwayat peringatan">
      {own.map((warning) => (
        <li className="card notification-card" key={warning.id}>
          <h3>Minggu mulai {calendarDay(warning.weekStart)}</h3>
          <p className="notification-message">{warning.message}</p>
          <p>
            Saat dikirim: {hours(warning.totalMinutes)} dari target {hours(warning.targetMinutes)}.
          </p>
          <p className="muted">
            <time dateTime={warning.createdAt}>
              {formatDay(warning.createdAt)}, {formatTime(warning.createdAt)} WIB
            </time>
          </p>
        </li>
      ))}
    </ul>
  );
}

function PersonalContent({ userId }: { userId: string }) {
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState(() => ({ period: 'week', date: today() }));
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  const [warningAttempt, setWarningAttempt] = useState(0);
  const reloadSummary = () => setSummaryAttempt((value) => value + 1);
  const reloadWarnings = () => setWarningAttempt((value) => value + 1);
  return (
    <>
      <div className="summary-actions">
        <Link className="button" to="/kehadiran">
          Check-in / check-out
        </Link>
        <button
          type="button"
          onClick={() => {
            reloadSummary();
            reloadWarnings();
          }}
        >
          Muat ulang
        </button>
      </div>
      <p className="muted">
        Lihat durasi riset dan target pribadi. Muat ulang untuk melihat sesi berjalan, perubahan
        target, atau peringatan terbaru.
      </p>
      <form
        className="summary-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setSelected({ period, date });
          reloadSummary();
        }}
      >
        <label>
          Periode
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
          </select>
        </label>
        <label>
          Tanggal dalam periode (WIB)
          <input
            type="date"
            value={date}
            required
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button type="submit">Tampilkan</button>
      </form>
      <section aria-labelledby="personal-summary-heading">
        <h2 id="personal-summary-heading">Rekap riset</h2>
        <SummaryPanel
          key={`${selected.period}:${selected.date}:${summaryAttempt}`}
          userId={userId}
          {...selected}
          retry={reloadSummary}
        />
      </section>
      <section className="summary-warnings" aria-labelledby="personal-warnings-heading">
        <div className="page-head">
          <h2 id="personal-warnings-heading">Peringatan saya</h2>
          <Link className="button" to="/notifikasi">
            Buka notifikasi
          </Link>
        </div>
        <p className="muted">
          Riwayat semua periode. Nilai target dan durasi adalah nilai saat peringatan dikirim.
        </p>
        <WarningsPanel key={warningAttempt} userId={userId} retry={reloadWarnings} />
      </section>
    </>
  );
}

export function MyAttendanceSummaryPage() {
  const { profile, loading } = useProfile();
  return (
    <section className="personal-summary-page">
      <h1>Rekap kehadiran saya</h1>
      {loading ? (
        <p role="status">Memuat profil…</p>
      ) : !profile ? (
        <p role="alert" className="error">
          Profil gagal dimuat. Muat ulang halaman.
        </p>
      ) : profile.role !== 'anggota' ? (
        <p>Halaman ini khusus anggota. Gunakan halaman monitoring untuk memantau kehadiran lab.</p>
      ) : (
        <PersonalContent key={profile.id} userId={profile.id} />
      )}
    </section>
  );
}
