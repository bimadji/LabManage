import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import { formatDay, formatTime } from '../lib/datetime';
import type { UserNotification } from '../types';

const KIND_LABELS: Record<string, string> = {
  reservasi: 'Reservasi',
  lembur: 'Lembur',
  laporan: 'Laporan fasilitas',
  inventaris: 'Inventaris',
};

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Koneksi gagal. Coba lagi.';
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<UserNotification[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    pending.current = true;
    apiFetch<UserNotification[]>('/notifications')
      .then((list) => {
        if (active) setNotifications(list);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) pending.current = false;
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function reload() {
    if (pending.current) return;
    pending.current = true;
    setNotifications(null);
    setLoadError(null);
    setActionError(null);
    setNotice(null);
    setAttempt((value) => value + 1);
  }

  async function markRead(id: string) {
    if (pending.current) return;
    pending.current = true;
    setSavingId(id);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await apiFetch<UserNotification>(`/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setNotifications((list) => list!.map((item) => (item.id === updated.id ? updated : item)));
      setNotice('Notifikasi ditandai sudah dibaca.');
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      pending.current = false;
      setSavingId(null);
    }
  }

  return (
    <>
      <p className="muted">
        Pesan untuk akun Anda, dari yang terbaru. Muat ulang untuk melihat pembaruan.
      </p>
      {loadError ? (
        <div className="card">
          <p className="error" role="alert">
            {loadError}
          </p>
          <button type="button" onClick={reload}>
            Coba lagi
          </button>
        </div>
      ) : notifications === null ? (
        <p role="status">Memuat notifikasi…</p>
      ) : (
        <>
          <button
            className="notifications-refresh"
            type="button"
            onClick={reload}
            disabled={savingId !== null}
          >
            Muat ulang
          </button>
          {actionError && (
            <p className="error" role="alert">
              {actionError}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {notifications.length === 0 ? (
            <p className="card muted">
              Belum ada notifikasi. Gunakan Muat ulang untuk memeriksa pesan baru.
            </p>
          ) : (
            <ul className="cards" aria-label="Daftar notifikasi">
              {notifications.map((item) => (
                <li key={item.id}>
                  <article
                    className="card notification-card"
                    data-read={item.readAt ? 'true' : 'false'}
                    aria-labelledby={`notification-${item.id}`}
                  >
                    <header className="notification-heading">
                      <h2 id={`notification-${item.id}`}>
                        {KIND_LABELS[item.kind] ?? 'Notifikasi'}
                      </h2>
                      <span className={item.readAt ? 'badge' : 'badge badge-warn'}>
                        {item.readAt ? 'Sudah dibaca' : 'Belum dibaca'}
                      </span>
                    </header>
                    <p className="notification-message">{item.message}</p>
                    <p className="muted">
                      <time dateTime={item.createdAt}>
                        {formatDay(item.createdAt)}, {formatTime(item.createdAt)} WIB
                      </time>
                    </p>
                    {!item.readAt && (
                      <button
                        className="notification-read"
                        type="button"
                        onClick={() => void markRead(item.id)}
                        disabled={savingId !== null}
                      >
                        {savingId === item.id ? 'Menyimpan…' : 'Tandai sudah dibaca'}
                      </button>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

export function NotificationsPage() {
  const { profile, loading } = useProfile();
  return (
    <section>
      <h1>Notifikasi saya</h1>
      {loading ? (
        <p role="status">Memuat profil…</p>
      ) : !profile ? (
        <p className="error" role="alert">
          Profil gagal dimuat. Muat ulang halaman untuk mencoba lagi.
        </p>
      ) : (
        <NotificationsContent key={profile.id} />
      )}
    </section>
  );
}
