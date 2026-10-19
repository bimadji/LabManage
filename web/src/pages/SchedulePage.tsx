import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { formatDay, formatTime, groupByDay } from '../lib/datetime';
import type { Reservation, Room } from '../types';

export function SchedulePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomFilter, setRoomFilter] = useState('semua');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    const from = new Date();
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);

    Promise.all([
      apiFetch<Room[]>('/rooms'),
      apiFetch<Reservation[]>(
        `/reservations?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      ),
    ])
      .then(([roomList, reservationList]) => {
        if (!active) return;
        setRooms(roomList);
        setReservations(reservationList);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const roomName = useMemo(() => new Map(rooms.map((room) => [room.id, room.name])), [rooms]);

  const visible = reservations.filter(
    (reservation) => roomFilter === 'semua' || reservation.roomId === roomFilter,
  );
  const days = groupByDay(visible);

  return (
    <section>
      <div className="page-head">
        <h1>Jadwal</h1>
        <Link className="button" to="/reservasi/baru">
          Reservasi baru
        </Link>
      </div>

      <label className="filter" htmlFor="filter-ruang">
        <span>Ruang</span>
        <select
          id="filter-ruang"
          value={roomFilter}
          onChange={(event) => setRoomFilter(event.target.value)}
        >
          <option value="semua">Semua ruang</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </label>

      {status === 'loading' && <p className="muted">Memuat jadwal…</p>}
      {status === 'error' && (
        <p className="error" role="alert">
          Jadwal gagal dimuat. Muat ulang halaman.
        </p>
      )}
      {status === 'ready' && days.length === 0 && (
        <p className="muted">Belum ada reservasi dalam dua minggu ke depan.</p>
      )}

      {days.map(([day, items]) => (
        <div key={day} className="day">
          <h2>{formatDay(items[0].startsAt)}</h2>
          <ul className="cards">
            {items.map((reservation) => (
              <li key={reservation.id} className="card reservation">
                <p className="reservation-time">
                  {formatTime(reservation.startsAt)}–{formatTime(reservation.endsAt)}
                </p>
                <p className="reservation-room">{roomName.get(reservation.roomId) ?? 'Ruang'}</p>
                <p className="muted">{reservation.team}</p>
                {reservation.status === 'dibatalkan' && <span className="badge">Dibatalkan</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
