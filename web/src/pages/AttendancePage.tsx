import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { formatDay, formatTime } from '../lib/datetime';
import type { AttendanceSession } from '../types';

function message(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Koneksi gagal. Coba lagi.';
}

function SessionContent() {
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<'check-in' | 'check-out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Serialkan pemuatan dan aksi agar polling tidak menimpa hasil check-in/check-out.
  const pending = useRef(false);

  const readSession = useCallback(async () => {
    try {
      const current = await apiFetch<AttendanceSession | null>('/attendance/me');
      setSession(current);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(message(err));
    }
  }, []);

  const reload = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true);
    setError(null);
    try {
      await readSession();
    } finally {
      setRefreshing(false);
      pending.current = false;
    }
  }, [readSession]);

  useEffect(() => {
    void reload();
    // Durasi berasal dari perhitungan backend yang sama dengan monitoring.
    const timer = window.setInterval(() => void reload(), 30_000);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload]);

  async function submit(nextAction: 'check-in' | 'check-out') {
    if (pending.current) return;
    pending.current = true;
    setAction(nextAction);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/attendance/${nextAction}`, { method: 'POST' });
      setSuccess(nextAction === 'check-in' ? 'Check-in berhasil.' : 'Check-out berhasil.');
    } catch (err) {
      setError(message(err));
    }
    // Sinkronkan juga setelah konflik dari tab lain atau respons tulis terputus.
    await readSession();
    setAction(null);
    pending.current = false;
  }

  const isOpen = session !== null && session.checkedOutAt === null;
  const minutes = session?.durationMinutes ?? 0;
  const duration =
    minutes >= 60 ? `${Math.floor(minutes / 60)} jam ${minutes % 60} menit` : `${minutes} menit`;

  return (
    <section className="attendance-page personal-attendance-page">
      <h1>Kehadiran saya</h1>
      <p className="muted">Check-in saat mulai riset di lab dan check-out saat selesai.</p>
      {status === 'loading' && <p role="status">Memuat sesi kehadiran…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {status === 'error' && (
        <button
          type="button"
          disabled={refreshing || action !== null}
          onClick={() => void reload()}
        >
          {refreshing ? 'Memuat…' : 'Coba lagi'}
        </button>
      )}
      {status === 'ready' && (
        <div className="card attendance-session" aria-labelledby="attendance-session-heading">
          <div className="attendance-session-heading">
            <h2 id="attendance-session-heading">{isOpen ? 'Sesi berjalan' : 'Sesi terakhir'}</h2>
            {session && (
              <span className={isOpen ? 'badge badge-live' : 'badge'}>
                {isOpen ? 'Sedang di lab' : 'Selesai'}
              </span>
            )}
          </div>
          {session ? (
            <>
              <dl className="attendance-session-details">
                <div>
                  <dt>Mulai</dt>
                  <dd>
                    {formatDay(session.checkedInAt)}, {formatTime(session.checkedInAt)} WIB
                  </dd>
                </div>
                {session.checkedOutAt && (
                  <div>
                    <dt>Selesai</dt>
                    <dd>
                      {formatDay(session.checkedOutAt)}, {formatTime(session.checkedOutAt)} WIB
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{isOpen ? 'Durasi berjalan' : 'Durasi akhir'}</dt>
                  <dd className="reservation-time">{duration}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="muted">
              Belum ada sesi kehadiran. Mulai dengan check-in saat berada di lab.
            </p>
          )}
          <div className="attendance-session-actions">
            <button
              type="button"
              disabled={refreshing || action !== null}
              onClick={() => void submit(isOpen ? 'check-out' : 'check-in')}
            >
              {action ? 'Memproses…' : isOpen ? 'Check-out' : 'Check-in'}
            </button>
          </div>
          <p className="muted">
            Sesi dan durasi diperbarui setiap 30 detik serta saat kembali ke tab ini.
          </p>
        </div>
      )}
    </section>
  );
}

export function AttendancePage() {
  const { profile, loading } = useProfile();
  if (loading) return <p role="status">Memuat profil…</p>;
  if (!profile)
    return (
      <p className="error" role="alert">
        Profil tidak dapat dimuat. Muat ulang halaman.
      </p>
    );
  if (profile.role === 'advisor') {
    return (
      <section>
        <h1>Kehadiran saya</h1>
        <p>Kehadiran pribadi hanya tersedia untuk anggota dan admin.</p>
        <Link className="button" to="/monitor">
          Lihat monitoring lab
        </Link>
      </section>
    );
  }
  return (
    <>
      {profile.role === 'anggota' && (
        <Link className="button attendance-summary-link" to="/kehadiran/rekap">
          Rekap dan peringatan saya
        </Link>
      )}
      <SessionContent key={profile.id} />
    </>
  );
}
