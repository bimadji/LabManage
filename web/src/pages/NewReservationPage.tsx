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

  useEffect(() => {
    apiFetch<Room[]>('/rooms')
      .then((list) => {
        setRooms(list);
        if (list.length > 0) setRoomId(list[0].id);
      })
      .catch(() => setError('Daftar ruang gagal dimuat. Muat ulang halaman.'));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
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
    <section>
      <div className="page-head">
        <h1>Reservasi baru</h1>
        <Link className="link-back" to="/jadwal">
          Kembali ke jadwal
        </Link>
      </div>

      <form className="card form" onSubmit={onSubmit} noValidate>
        <label htmlFor="ruang">Ruang atau alat</label>
        <select id="ruang" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>

        <label htmlFor="tim">Tim</label>
        <input
          id="tim"
          value={team}
          onChange={(event) => setTeam(event.target.value)}
          maxLength={100}
          required
        />

        <label htmlFor="mulai">Mulai</label>
        <input
          id="mulai"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />

        <label htmlFor="selesai">Selesai</label>
        <input
          id="selesai"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          required
        />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan…' : 'Simpan reservasi'}
        </button>
        <p className="muted hint">Jam operasional lab 07:00–21:00 WIB.</p>
      </form>
    </section>
  );
}
