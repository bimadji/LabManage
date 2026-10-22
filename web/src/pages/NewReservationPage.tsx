import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiRequestError } from '../lib/api';
import { localInputToIso } from '../lib/datetime';
import type { Reservation, Room } from '../types';

export function NewReservationPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [team, setTeam] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [roomStatus, setRoomStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const fieldsDisabled = roomStatus !== 'ready' || rooms.length === 0 || submitting;

  useEffect(() => {
    let active = true;
    apiFetch<Room[]>('/rooms')
      .then((list) => {
        if (!active) return;
        setRooms(list);
        if (list.length > 0) setRoomId(list[0].id);
        setRoomStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setRoomStatus('error');
        setError('Daftar ruang gagal dimuat. Muat ulang halaman.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (fieldsDisabled) return;
    setError(null);

    // Local check first: no request is sent for an invalid range.
    if (startsAt === '' || endsAt === '') {
      setError('Waktu mulai dan selesai wajib diisi.');
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('Waktu selesai harus setelah waktu mulai.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<Reservation>('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          team: team.trim(),
          startsAt: localInputToIso(startsAt),
          endsAt: localInputToIso(endsAt),
        }),
      });
      navigate('/jadwal');
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Reservasi gagal disimpan. Coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="reservation-page">
      <div className="page-head">
        <div>
          <h1>Reservasi baru</h1>
          <p className="muted">Tentukan ruang atau alat dan waktu penggunaan untuk tim Anda.</p>
        </div>
        <Link className="link-back" to="/jadwal">
          Kembali ke jadwal
        </Link>
      </div>

      <form className="card reservation-form" onSubmit={onSubmit} noValidate>
        <p className="reservation-hours">
          Jam operasional lab <strong>07:00–21:00 WIB.</strong>
        </p>
        {roomStatus === 'loading' && (
          <p className="muted reservation-message" role="status">
            Memuat daftar ruang atau alat…
          </p>
        )}
        {roomStatus === 'ready' && rooms.length === 0 && (
          <p className="muted reservation-message" role="status">
            Belum ada ruang atau alat yang dapat dipilih. Hubungi admin untuk informasi
            ketersediaan.
          </p>
        )}

        <div className="reservation-form-sections">
          <fieldset disabled={fieldsDisabled}>
            <legend>Ruang dan tim</legend>
            <div className="reservation-fields">
              <div className="reservation-field">
                <label htmlFor="ruang">Ruang atau alat</label>
                <select
                  id="ruang"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="reservation-field">
                <label htmlFor="tim">Tim</label>
                <input
                  id="tim"
                  value={team}
                  onChange={(event) => setTeam(event.target.value)}
                  maxLength={100}
                  required
                />
              </div>
            </div>
          </fieldset>

          <fieldset disabled={fieldsDisabled}>
            <legend>Waktu penggunaan</legend>
            <div className="reservation-fields">
              <div className="reservation-field">
                <label htmlFor="mulai">Mulai</label>
                <input
                  id="mulai"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  aria-describedby="reservation-time-hint"
                  required
                />
              </div>
              <div className="reservation-field">
                <label htmlFor="selesai">Selesai</label>
                <input
                  id="selesai"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  aria-describedby="reservation-time-hint"
                  required
                />
              </div>
            </div>
            <p id="reservation-time-hint" className="muted hint">
              Tanggal dan jam isian mengikuti zona waktu perangkat Anda.
            </p>
          </fieldset>
        </div>

        {error && (
          <p className="error reservation-message" role="alert">
            {error}
          </p>
        )}

        <div className="reservation-submit">
          <button type="submit" disabled={fieldsDisabled}>
            {submitting ? 'Menyimpan…' : 'Simpan reservasi'}
          </button>
        </div>
      </form>
    </section>
  );
}
