import { useState } from 'react';
import { apiFetch } from '../lib/api';
import {
  hours,
  instantWib,
  useAdminMutation,
  useAdminResource,
  type AdminActions,
  type AttendanceTarget,
} from './admin';

function TargetForm({ initial, actions }: { initial: AttendanceTarget; actions: AdminActions }) {
  const [target, setTarget] = useState(initial);
  const [minutes, setMinutes] = useState(String(initial.weeklyTargetMinutes));
  const { error, setError, run } = useAdminMutation(actions);
  return (
    <form
      className="admin-attendance-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Number(minutes);
        if (minutes.trim() === '' || !Number.isInteger(value) || value < 0 || value > 10080) {
          setError('Target harus bilangan bulat 0–10080 menit.');
          return;
        }
        void run(
          () =>
            apiFetch<AttendanceTarget>('/attendance/target', {
              method: 'PUT',
              body: JSON.stringify({ weeklyTargetMinutes: value }),
            }),
          (saved) => {
            setTarget(saved);
            setMinutes(String(saved.weeklyTargetMinutes));
            actions.saved('target', 'Target mingguan disimpan.');
          },
        );
      }}
    >
      <p>Target saat ini: {hours(target.weeklyTargetMinutes / 60)} per minggu.</p>
      <p className="muted">
        Target global berlaku untuk semua anggota, termasuk rekap historis. Target bulanan dihitung
        proporsional terhadap jumlah hari kalender.
      </p>
      <label>
        Target mingguan (menit)
        <input
          type="number"
          required
          min={0}
          max={10080}
          step={1}
          value={minutes}
          disabled={actions.busy}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </label>
      <p className="muted">Terakhir diperbarui: {instantWib(target.updatedAt)}.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={actions.busy}>
        Simpan target
      </button>
    </form>
  );
}

export function AdminTarget({ actions, retry }: { actions: AdminActions; retry: () => void }) {
  const { data, error } = useAdminResource<AttendanceTarget>('/attendance/target');
  if (error)
    return (
      <>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={retry} disabled={actions.busy}>
          Coba lagi target
        </button>
      </>
    );
  if (!data) return <p role="status">Memuat target…</p>;
  return <TargetForm initial={data} actions={actions} />;
}
