import { useState } from 'react';
import { apiFetch } from '../lib/api';
import type { PresentSession } from '../monitor/applyAttendanceChange';
import {
  checkoutInstant,
  hours,
  instantWib,
  useAdminMutation,
  useAdminResource,
  type AdminActions,
  type AttendanceCorrection,
  type MemberStatistics,
} from './admin';

function CorrectionForm({ session, actions }: { session: PresentSession; actions: AdminActions }) {
  const [finished, setFinished] = useState('');
  const [reason, setReason] = useState('');
  const { error, setError, run } = useAdminMutation(actions);
  return (
    <form
      className="admin-attendance-form"
      onSubmit={(event) => {
        event.preventDefault();
        const checkedOutAt = checkoutInstant(finished);
        if (
          !checkedOutAt ||
          Date.parse(checkedOutAt) <= Date.parse(session.checkedInAt) ||
          Date.parse(checkedOutAt) > Date.now()
        ) {
          setError('Waktu selesai harus setelah mulai dan tidak melebihi waktu sekarang (WIB).');
          return;
        }
        const trimmed = reason.trim();
        if (trimmed.length < 5 || trimmed.length > 1000) {
          setError('Alasan koreksi wajib 5–1000 karakter.');
          return;
        }
        void run(
          () =>
            apiFetch(`/attendance/${encodeURIComponent(session.id)}/correct-check-out`, {
              method: 'PATCH',
              body: JSON.stringify({ checkedOutAt, reason: trimmed }),
            }),
          () => actions.saved('correction', 'Koreksi check-out tersimpan.'),
        );
      }}
    >
      <label>
        Waktu check-out {session.fullName} (WIB)
        <input
          type="datetime-local"
          required
          step={60}
          value={finished}
          disabled={actions.busy}
          onChange={(event) => setFinished(event.target.value)}
        />
      </label>
      <label>
        Alasan koreksi {session.fullName}
        <textarea
          required
          minLength={5}
          maxLength={1000}
          rows={3}
          value={reason}
          disabled={actions.busy}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={actions.busy}>
        Simpan koreksi {session.fullName}
      </button>
    </form>
  );
}

export function AdminOpenSessions({
  actions,
  retry,
}: {
  actions: AdminActions;
  retry: () => void;
}) {
  const { data, error } = useAdminResource<PresentSession[]>('/attendance/present');
  if (error)
    return (
      <>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={retry} disabled={actions.busy}>
          Coba lagi sesi
        </button>
      </>
    );
  if (!data) return <p role="status">Memuat sesi terbuka…</p>;
  return (
    <>
      <button onClick={retry} disabled={actions.busy}>
        Muat ulang sesi
      </button>
      <p className="muted">
        Koreksi hanya untuk sesi yang lupa check-out. Isi waktu selesai yang sebenarnya dalam WIB
        dan alasan; tindakan tercatat di riwayat. Muat ulang sesi jika anggota telah check-out
        sendiri.
      </p>
      {data.length === 0 ? (
        <p>Tidak ada sesi terbuka untuk dikoreksi.</p>
      ) : (
        <div className="admin-attendance-list">
          {data.map((session) => (
            <article className="card" key={session.id} aria-label={`Sesi ${session.fullName}`}>
              <h3>{session.fullName}</h3>
              <p>Mulai: {instantWib(session.checkedInAt)}</p>
              <p>Durasi saat dimuat: {hours(session.durationMinutes / 60)}</p>
              {session.overNightLimit && <span className="badge badge-warn">Lewat 21:00 WIB</span>}
              <CorrectionForm session={session} actions={actions} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function AdminCorrectionHistory({
  retry,
  members,
  actor,
  busy,
}: {
  retry: () => void;
  members: MemberStatistics[];
  actor: { id: string; fullName: string };
  busy: boolean;
}) {
  const { data, error } = useAdminResource<AttendanceCorrection[]>('/attendance/corrections');
  if (error)
    return (
      <>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={retry} disabled={busy}>
          Coba lagi riwayat
        </button>
      </>
    );
  if (!data) return <p role="status">Memuat riwayat koreksi…</p>;
  if (!data.length) return <p>Belum ada riwayat koreksi.</p>;
  return (
    <ol className="admin-attendance-list">
      {data.map((entry) => (
        <li className="card" key={entry.id}>
          <p>
            Anggota:{' '}
            {members.find((member) => member.userId === entry.userId)?.fullName ?? entry.userId}
          </p>
          <p>Check-out: {instantWib(entry.checkedOutAt)}</p>
          <p>{entry.reason}</p>
          <p className="muted">
            Dicatat {instantWib(entry.createdAt)} oleh{' '}
            {entry.actorId === actor.id ? actor.fullName : entry.actorId}.
          </p>
          <details className="advisor-days">
            <summary>Identitas audit</summary>
            <dl>
              <dt>ID sesi</dt>
              <dd>{entry.attendanceId}</dd>
              <dt>ID anggota</dt>
              <dd>{entry.userId}</dd>
              <dt>ID admin</dt>
              <dd>{entry.actorId}</dd>
            </dl>
          </details>
        </li>
      ))}
    </ol>
  );
}
