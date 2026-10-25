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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const from = new Date();
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);

    Promise.all([
      apiFetch<Room[]>('/rooms').then((roomList) => {
        if (active) setRooms(roomList);
        return roomList;
      }),
      apiFetch<Reservation[]>(
        `/reservations?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      ),
    ])
      .then(([, reservationList]) => {
        if (!active) return;
        setReservations(reservationList);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const roomName = useMemo(() => new Map(rooms.map((room) => [room.id, room.name])), [rooms]);

  const visible = reservations.filter(
    (reservation) => roomFilter === 'semua' || reservation.roomId === roomFilter,
  );
  const days = groupByDay(visible);

  return (
    <section className="schedule-page">
      <div className="page-head">
        <div>
          <h1>Jadwal</h1>
          <p className="muted schedule-intro">Dua minggu ke depan. Semua jam dalam WIB.</p>
        </div>
        <Link className="button" to="/reservasi/baru">
          Reservasi baru
        </Link>
      </div>

      <label className="filter schedule-filter" htmlFor="filter-ruang">
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

      {status === 'loading' && (
        <p className="card schedule-state muted" role="status">
          Memuat jadwal…
        </p>
      )}
      {status === 'error' && (
        <div className="card schedule-state schedule-error">
          <p className="error" role="alert">
            Jadwal gagal dimuat. Periksa koneksi lalu coba lagi.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setReloadKey((key) => key + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {status === 'ready' && days.length === 0 && (
        <div className="card schedule-state">
          <p className="schedule-empty-title">Belum ada reservasi dalam dua minggu ke depan.</p>
          <p className="muted">Pilih ruang lain atau buat reservasi untuk tim Anda.</p>
          <Link className="button" to="/reservasi/baru">
            Buat reservasi
          </Link>
        </div>
      )}

      {status === 'ready' &&
        days.map(([day, items]) => {
          const [weekday, date] = formatDay(items[0].startsAt).split(', ');
          return (
            <section key={day} className="day schedule-day" aria-labelledby={`schedule-${day}`}>
              <h2 id={`schedule-${day}`}>
                <span className="schedule-weekday">{weekday},</span> <span>{date}</span>
              </h2>
              <ul className="cards" aria-labelledby={`schedule-${day}`}>
                {items.map((reservation) => (
                  <li key={reservation.id} className="card reservation">
                    <p className="reservation-time">
                      <time dateTime={reservation.startsAt}>
                        {formatTime(reservation.startsAt)}
                      </time>
                      {'–'}
                      <time dateTime={reservation.endsAt}>{formatTime(reservation.endsAt)}</time>
                    </p>
                    <div className="schedule-reservation-detail">
                      <p className="reservation-room">
                        {roomName.get(reservation.roomId) ?? 'Ruang'}
                      </p>
                      <p className="muted">{reservation.team}</p>
                    </div>
                    <span className={`badge ${reservation.status === 'aktif' ? 'badge-ok' : ''}`}>
                      {reservation.status === 'aktif' ? 'Aktif' : 'Dibatalkan'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </section>
  );
}
