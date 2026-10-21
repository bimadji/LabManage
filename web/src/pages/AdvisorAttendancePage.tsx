import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { formatDay } from '../lib/datetime';

interface MemberSummary {
  userId: string;
  fullName: string;
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
  members: MemberSummary[];
}
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const hours = (minutes: number) => `${number.format(minutes / 60)} jam`;
const calendarDay = (day: string) => formatDay(`${day}T00:00:00+07:00`);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const currentWeek = (period: SummaryResponse['period']) =>
  period.kind === 'week' &&
  Date.now() >= Date.parse(period.start) &&
  Date.now() < Date.parse(period.end);
const failureMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : 'Koneksi gagal. Coba lagi.';

function WarningForm({
  member,
  period,
}: {
  member: MemberSummary;
  period: SummaryResponse['period'];
}) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function send() {
    if (locked.current || sent || alreadySent) return;
    // Halaman dapat tetap terbuka melewati batas minggu; server tetap otoritatif.
    if (!currentWeek(period)) {
      setError('Minggu sudah berganti. Muat ulang rekap sebelum mengirim peringatan.');
      return;
    }
    locked.current = true;
    setSending(true);
    setError(null);
    try {
      await apiFetch('/attendance/warnings', {
        method: 'POST',
        body: JSON.stringify({ userId: member.userId, note: note.trim() }),
      });
      if (active.current) {
        setSent(true);
        setNote('');
      }
    } catch (reason) {
      if (active.current) {
        setError(failureMessage(reason));
        if (reason instanceof ApiRequestError && reason.code === 'WARNING_ALREADY_SENT')
          setAlreadySent(true);
      }
    } finally {
      locked.current = false;
      if (active.current) setSending(false);
    }
  }

  return (
    <form
      className="advisor-warning-form"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label>
        Catatan untuk {member.fullName} (opsional)
        <textarea
          value={note}
          maxLength={1000}
          rows={3}
          disabled={sending || sent || alreadySent}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sent && <p role="status">Peringatan terkirim untuk {member.fullName}.</p>}
      <button
        type="submit"
        disabled={sending || sent || alreadySent}
        aria-label={
          sending
            ? `Mengirim peringatan untuk ${member.fullName}`
            : sent || alreadySent
              ? `Sudah diperingatkan hari ini: ${member.fullName}`
              : `Kirim peringatan untuk ${member.fullName}`
        }
      >
        {sending
          ? 'Mengirim…'
          : sent || alreadySent
            ? 'Sudah diperingatkan hari ini'
            : 'Kirim peringatan'}
      </button>
    </form>
  );
}

function SummaryPanel({
  period,
  date,
  retry,
}: {
  period: string;
  date: string;
  retry: () => void;
}) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiFetch<SummaryResponse>(`/attendance/summary?${new URLSearchParams({ period, date })}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(failureMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [period, date]);
  if (error)
    return (
      <div className="card">
        <p role="alert" className="error">
          {error}
        </p>
        <button type="button" onClick={retry}>
          Coba lagi rekap
        </button>
      </div>
    );
  if (!data) return <p role="status">Memuat rekap…</p>;
  if (data.members.length === 0)
    return (
      <p className="card">
        Belum ada anggota untuk ditampilkan. Muat ulang setelah anggota terdaftar.
      </p>
    );
  const canWarn = currentWeek(data.period);
  return (
    <>
      <p className="summary-period">
        {calendarDay(data.period.days[0])} — {calendarDay(data.period.days.at(-1)!)} (WIB)
      </p>
      <p className="muted">
        Target mingguan: {hours(data.weeklyTargetMinutes)}.{' '}
        {data.period.kind === 'month' && 'Target bulanan mengikuti jumlah hari kalender.'}
      </p>
      <p className="muted advisor-warning-hint">
        Peringatan hanya untuk minggu berjalan, maksimal satu per anggota per hari.{' '}
        {canWarn
          ? 'Status KURANG diperiksa kembali saat dikirim.'
          : 'Pilih Minggu ini untuk mengirim peringatan.'}
      </p>
      <div className="advisor-members">
        {data.members.map((member) => (
          <article
            className="card advisor-member"
            key={member.userId}
            aria-label={`Rekap ${member.fullName}`}
          >
            <h3>{member.fullName}</h3>
            <span className={member.status === 'KURANG' ? 'badge badge-warn' : 'badge badge-ok'}>
              {member.status}
            </span>
            <dl className="summary-metrics">
              <div>
                <dt>Total riset</dt>
                <dd>{number.format(member.totalHours)} jam</dd>
              </div>
              <div>
                <dt>Target periode</dt>
                <dd>{hours(data.targetMinutes)}</dd>
              </div>
              <div>
                <dt>Jumlah sesi</dt>
                <dd>{member.sessionCount}</dd>
              </div>
              <div>
                <dt>Hari hadir</dt>
                <dd>
                  {member.daysPresent} dari {member.elapsedDays} hari berlalu
                </dd>
              </div>
              <div>
                <dt>Tingkat kehadiran</dt>
                <dd>{number.format(member.attendanceRate * 100)}%</dd>
              </div>
            </dl>
            {member.sessionCount === 0 && <p className="muted">Belum ada sesi pada periode ini.</p>}
            <details className="advisor-days">
              <summary>Rincian harian</summary>
              <ul>
                {member.days.map((day) => (
                  <li key={day.date}>
                    <time dateTime={day.date}>{calendarDay(day.date)}</time>: {hours(day.minutes)} ·{' '}
                    {day.sessionCount} sesi
                  </li>
                ))}
              </ul>
            </details>
            {canWarn && member.status === 'KURANG' && (
              <WarningForm member={member} period={data.period} />
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function AdvisorContent() {
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState(() => ({ period: 'week', date: today() }));
  const [attempt, setAttempt] = useState(0);
  const reload = () => setAttempt((value) => value + 1);
  return (
    <>
      <div className="summary-actions">
        <Link className="button" to="/monitor">
          Monitoring langsung
        </Link>
        <button type="button" onClick={reload}>
          Muat ulang rekap
        </button>
        <button
          type="button"
          onClick={() => {
            const value = today();
            setPeriod('week');
            setDate(value);
            setSelected({ period: 'week', date: value });
            reload();
          }}
        >
          Minggu ini
        </button>
      </div>
      <p className="muted">
        Pantau durasi dan target riset semua anggota. Muat ulang untuk melihat perubahan kehadiran
        terbaru. Status memakai durasi penuh sebelum pembulatan tampilan.
      </p>
      <form
        className="summary-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setSelected({ period, date });
          reload();
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
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button type="submit">Tampilkan</button>
      </form>
      <h2>Rekap riset anggota</h2>
      <SummaryPanel
        key={`${selected.period}:${selected.date}:${attempt}`}
        {...selected}
        retry={reload}
      />
    </>
  );
}

export function AdvisorAttendancePage() {
  const { profile, loading } = useProfile();
  return (
    <section className="advisor-summary-page">
      <h1>Rekap kehadiran anggota</h1>
      {loading ? (
        <p role="status">Memuat profil…</p>
      ) : !profile ? (
        <p role="alert" className="error">
          Profil gagal dimuat. Muat ulang halaman.
        </p>
      ) : profile.role !== 'advisor' ? (
        <p>Halaman ini khusus advisor. Gunakan halaman yang sesuai dengan peran Anda.</p>
      ) : (
        <AdvisorContent key={profile.id} />
      )}
    </section>
  );
}
